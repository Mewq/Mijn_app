"use strict";
/* Rules engine for Kleurjam — mirrors the in-game logic exactly.

   A "move" is one drag of a block along one axis over any distance (>=1 cell),
   or a drag that carries the block out through a gate of its own colour.

   Optional level mechanics, all backwards compatible (a level without them
   behaves exactly as it did before):

     level.ice      [[r,c], ...]              slippery tiles
     level.arrows   [[r,c,"right"], ...]      one-way tiles
     gate.locked    {openAfter:n}             opens once n blocks have left
     gate.keyLocked true                      opens once the key block has left
     block.frozen   {thawAfter:n}             immovable until n blocks have left
     block.key      true                      the key block
     block.colors   ["red","blue"]            may leave through either gate
     block.bomb     {type:"moves",value:n}    must be out within n moves

   Time-based mechanics (level.timeLimit, bomb type "seconds") live outside
   move-space search; verify() only checks the move-based ones.               */

const SIDE_DIR  = {top:[-1,0], bottom:[1,0], left:[0,-1], right:[0,1]};
const SIDE_AXIS = {top:"V", bottom:"V", left:"H", right:"H"};
const DIR_NAME  = {"-1,0":"top", "1,0":"bottom", "0,-1":"left", "0,1":"right"};

function makeLevel(lvl){
  const ROWS = lvl.rows, COLS = lvl.cols;
  const wall = new Uint8Array(ROWS*COLS);
  for(const w of (lvl.walls||[])) wall[w[0]*COLS + w[1]] = 1;

  const ice = new Uint8Array(ROWS*COLS);
  for(const t of (lvl.ice||[])) ice[t[0]*COLS + t[1]] = 1;

  const arrow = new Array(ROWS*COLS).fill(null);
  for(const a of (lvl.arrows||[])) arrow[a[0]*COLS + a[1]] = a[2];

  const gatesByColor = {};
  for(const g of lvl.gates) if(!(g.color in gatesByColor)) gatesByColor[g.color] = g;

  const blocks = lvl.blocks.map((b,i) => {
    const colors = b.colors && b.colors.length ? b.colors.slice() : [b.color];
    return {
      i, id:b.id, color:b.color, move:b.move, cells:b.cells,
      colors,
      gates: colors.map(c => gatesByColor[c]).filter(Boolean),
      gate: gatesByColor[b.color] || null,     // primary gate, kept for callers
      bonusColor: b.bonusColor || null,
      bomb: b.bomb || null,
      frozen: b.frozen || null,
      key: !!b.key,
      h: Math.max(...b.cells.map(c=>c[0])) + 1,
      w: Math.max(...b.cells.map(c=>c[1])) + 1
    };
  });

  const keyIndex = blocks.findIndex(b => b.key);

  return {ROWS, COLS, wall, ice, arrow, blocks, gates:lvl.gates, gatesByColor, keyIndex,
          hasIce: (lvl.ice||[]).length > 0,
          hasArrows: (lvl.arrows||[]).length > 0,
          start:{pos:Int16Array.from(lvl.blocks.map(b => b.row*COLS + b.col)),
                 out:Uint8Array.from(lvl.blocks.map(()=>0))},
          raw:lvl};
}

/* Eén teken per blok. Scheelt fors geheugen in de zoekboom, waar deze sleutels
   met honderdduizenden tegelijk bewaard worden. */
function stateKey(L, st){
  let s = "";
  for(let i=0;i<st.pos.length;i++) s += String.fromCharCode(st.out[i] ? 0xFFFF : st.pos[i]);
  return s;
}

function cloneState(st){ return {pos:st.pos.slice(), out:st.out.slice()}; }

function exitedCount(st){
  let n = 0;
  for(let i=0;i<st.out.length;i++) if(st.out[i]) n++;
  return n;
}

function buildOcc(L, st){
  const occ = new Int16Array(L.ROWS*L.COLS).fill(-1);
  for(let i=0;i<L.blocks.length;i++){
    if(st.out[i]) continue;
    const b = L.blocks[i];
    const r0 = (st.pos[i] / L.COLS) | 0, c0 = st.pos[i] % L.COLS;
    for(const rc of b.cells) occ[(r0+rc[0])*L.COLS + (c0+rc[1])] = i;
  }
  return occ;
}

/* --- state-dependent mechanics ------------------------------------------- */

function gateOpen(L, gate, st){
  if(!gate) return false;
  if(gate.locked && exitedCount(st) < gate.locked.openAfter) return false;
  if(gate.keyLocked){
    if(L.keyIndex < 0) return false;
    if(!st.out[L.keyIndex]) return false;
  }
  return true;
}

function isFrozen(L, i, st){
  const f = L.blocks[i].frozen;
  return !!f && exitedCount(st) < f.thawAfter;
}

/* --- placement ------------------------------------------------------------ */

function fits(L, b, r0, c0, occ, self){
  for(const rc of b.cells){
    const r = r0 + rc[0], c = c0 + rc[1];
    if(r < 0 || c < 0 || r >= L.ROWS || c >= L.COLS) return false;
    const k = r*L.COLS + c;
    if(L.wall[k]) return false;
    if(occ[k] !== -1 && occ[k] !== self) return false;
  }
  return true;
}

/* a one-way tile may only be entered in the direction it points */
function arrowsAllow(L, b, fromR, fromC, toR, toC, dirName){
  if(!L.hasArrows) return true;
  for(const rc of b.cells){
    const r = toR + rc[0], c = toC + rc[1];
    if(r < 0 || c < 0 || r >= L.ROWS || c >= L.COLS) continue;
    const a = L.arrow[r*L.COLS + c];
    if(!a) continue;
    let wasMine = false;                       // already standing there = not entering
    for(const rc2 of b.cells){
      if(fromR + rc2[0] === r && fromC + rc2[1] === c){ wasMine = true; break; }
    }
    if(wasMine) continue;
    if(a !== dirName) return false;
  }
  return true;
}

function onIce(L, b, r0, c0){
  if(!L.hasIce) return false;
  for(const rc of b.cells){
    const r = r0 + rc[0], c = c0 + rc[1];
    if(r < 0 || c < 0 || r >= L.ROWS || c >= L.COLS) continue;
    if(L.ice[r*L.COLS + c]) return true;
  }
  return false;
}

/* --- leaving the board ---------------------------------------------------- */

function outsideOk(L, r, c, gate){
  const lo = gate.index, hi = gate.index + gate.span - 1;
  if(gate.side === "right")  return c >= L.COLS && r >= lo && r <= hi && r >= 0 && r < L.ROWS;
  if(gate.side === "left")   return c < 0       && r >= lo && r <= hi && r >= 0 && r < L.ROWS;
  if(gate.side === "bottom") return r >= L.ROWS && c >= lo && c <= hi && c >= 0 && c < L.COLS;
  if(gate.side === "top")    return r < 0       && c >= lo && c <= hi && c >= 0 && c < L.COLS;
  return false;
}

/* steps needed to leave through `gate` from (r0,c0), or -1 */
function exitStepsVia(L, b, r0, c0, occ, self, gate, st){
  if(!gate) return -1;
  if(b.move !== "A" && b.move !== SIDE_AXIS[gate.side]) return -1;
  if(st && !gateOpen(L, gate, st)) return -1;
  const d = SIDE_DIR[gate.side];
  const dirName = DIR_NAME[d[0] + "," + d[1]];
  let pr = r0, pc = c0;
  for(let k=1;k<=L.ROWS+L.COLS+4;k++){
    const nr = r0 + d[0]*k, nc = c0 + d[1]*k;
    if(!arrowsAllow(L, b, pr, pc, nr, nc, dirName)) return -1;
    let allOut = true;
    for(const rc of b.cells){
      const r = nr + rc[0], c = nc + rc[1];
      const inside = r >= 0 && r < L.ROWS && c >= 0 && c < L.COLS;
      if(inside){
        allOut = false;
        const kk = r*L.COLS + c;
        if(L.wall[kk] || (occ[kk] !== -1 && occ[kk] !== self)) return -1;
      } else if(!outsideOk(L, r, c, gate)) return -1;
    }
    pr = nr; pc = nc;
    if(allOut) return k;
  }
  return -1;
}

/* cheapest way out for a block, over every gate it may use */
function exitSteps(L, b, r0, c0, occ, self, st){
  let best = -1;
  const gates = b.gates && b.gates.length ? b.gates : (b.gate ? [b.gate] : []);
  for(const g of gates){
    const k = exitStepsVia(L, b, r0, c0, occ, self, g, st);
    if(k > 0 && (best < 0 || k < best)) best = k;
  }
  return best;
}

function exitGateFor(L, b, r0, c0, occ, self, st){
  let best = null, bestK = -1;
  const gates = b.gates && b.gates.length ? b.gates : (b.gate ? [b.gate] : []);
  for(const g of gates){
    const k = exitStepsVia(L, b, r0, c0, occ, self, g, st);
    if(k > 0 && (bestK < 0 || k < bestK)){ bestK = k; best = g; }
  }
  return best ? {gate:best, steps:bestK} : null;
}

/* --- sliding -------------------------------------------------------------- */

function canStep(L, b, r, c, dr, dc, occ, self){
  const nr = r + dr, nc = c + dc;
  if(!fits(L, b, nr, nc, occ, self)) return false;
  return arrowsAllow(L, b, r, c, nr, nc, DIR_NAME[dr + "," + dc]);
}

/* Forced continuation on ice: keeps going in the same direction while the block
   still touches ice. Skidding out through an open gate counts as solved. */
function iceSlide(L, b, r, c, dr, dc, occ, self, st){
  if(!L.hasIce) return {r, c, exit:false};
  let guard = 0;
  while(onIce(L, b, r, c) && guard++ < L.ROWS + L.COLS){
    const info = exitGateFor(L, b, r, c, occ, self, st);
    if(info){
      const d = SIDE_DIR[info.gate.side];
      if(d[0] === dr && d[1] === dc) return {r, c, exit:true, gate:info.gate};
    }
    if(!canStep(L, b, r, c, dr, dc, occ, self)) break;
    r += dr; c += dc;
  }
  return {r, c, exit:false};
}

/* All legal moves from a state.
   {b, axis, d, to, exit} — `d` is the drag the player makes, `to` is where the
   block comes to rest (ice may carry it further). */
function moves(L, st, occ){
  occ = occ || buildOcc(L, st);
  const out = [];
  for(let i=0;i<L.blocks.length;i++){
    if(st.out[i] || isFrozen(L, i, st)) continue;
    const b = L.blocks[i];
    const r0 = (st.pos[i] / L.COLS) | 0, c0 = st.pos[i] % L.COLS;
    const axes = b.move === "A" ? ["H","V"] : [b.move];
    const seen = new Set();
    for(const axis of axes){
      for(const sgn of [-1, 1]){
        const dr = axis === "V" ? sgn : 0, dc = axis === "H" ? sgn : 0;
        let r = r0, c = c0;
        for(let k=1;k<=Math.max(L.ROWS,L.COLS);k++){
          if(!canStep(L, b, r, c, dr, dc, occ, i)) break;
          r += dr; c += dc;
          const rest = iceSlide(L, b, r, c, dr, dc, occ, i, st);
          const to = rest.exit ? -1 : rest.r*L.COLS + rest.c;
          if(!rest.exit && to === st.pos[i]) continue;      // ice put it right back
          const tag = to + ":" + (rest.exit ? 1 : 0);
          if(seen.has(tag)) continue;
          seen.add(tag);
          out.push({b:i, axis, d:sgn*k, to, exit:!!rest.exit});
        }
      }
    }
    const info = exitGateFor(L, b, r0, c0, occ, i, st);   // deliberate drag out
    if(info){
      // `drag:true` betekent: de speler sleept het blok zelf het bord uit. Zonder
      // die vlag zou een uitgang via het ijs (waar de speler maar een stukje
      // sleept en het blok doorglijdt) er hetzelfde uitzien.
      out.push({b:i, axis:SIDE_AXIS[info.gate.side], d:info.steps, to:-1, exit:true,
                drag:true, gate:info.gate.color});
    }
  }
  return out;
}

function applyMove(L, st, mv){
  const ns = cloneState(st);
  if(mv.exit){ ns.out[mv.b] = 1; return ns; }
  ns.pos[mv.b] = mv.to;
  return ns;
}

function solved(L, st){
  for(let i=0;i<L.blocks.length;i++){
    const b = L.blocks[i];
    const hasGate = (b.gates && b.gates.length) || b.gate;
    if(hasGate && !st.out[i]) return false;
  }
  return true;
}

/* Ondergrens voor het aantal zetten om blok i het bord af te krijgen.

   Elke blokkeerder in de baan moet minstens één keer aan de kant, het blok zelf
   moet minstens één keer bewegen om eruit te gaan, en staat het niet uitgelijnd
   met de poort dan kost dat nog een zet. Dat zijn losse zetten, dus de som is
   een echte ondergrens — geen schatting.

   Met `strict` komt er Infinity uit als het blok helemaal niet weg kan; zonder
   die vlag wordt dat 1, wat de zoeker prettiger vindt. */
function exitCost(L, st, occ, i, strict){
  const b = L.blocks[i];
  const gates = (b.gates && b.gates.length ? b.gates : (b.gate ? [b.gate] : []));
  if(!gates.length) return strict ? Infinity : 0;
  let best = Infinity;
  for(const gate of gates){
    if(b.move !== "A" && b.move !== SIDE_AXIS[gate.side]) continue;
    const r0 = (st.pos[i] / L.COLS) | 0, c0 = st.pos[i] % L.COLS;
    const vertGate = (gate.side === "top" || gate.side === "bottom");
    let align = 0, tr = r0, tc = c0;
    if(vertGate){
      const lo = gate.index, hi = gate.index + gate.span - b.w;
      if(c0 < lo || c0 > hi){ align = 1; tc = Math.min(Math.max(c0, lo), hi); }
      if(align && b.move === "V") continue;
    } else {
      const lo = gate.index, hi = gate.index + gate.span - b.h;
      if(r0 < lo || r0 > hi){ align = 1; tr = Math.min(Math.max(r0, lo), hi); }
      if(align && b.move === "H") continue;
    }
    let shut = 0;                                  // a shut gate needs opening first
    if(gate.locked){
      const missing = gate.locked.openAfter - exitedCount(st);
      if(missing > 0) shut = missing;
    }
    if(gate.keyLocked && L.keyIndex >= 0 && !st.out[L.keyIndex]) shut = Math.max(shut, 1);

    const d = SIDE_DIR[gate.side];
    const seen = new Set();
    let walls = 0;
    for(let k=1;k<=L.ROWS+L.COLS;k++){
      let allOut = true;
      for(const rc of b.cells){
        const r = tr + d[0]*k + rc[0], c = tc + d[1]*k + rc[1];
        if(r < 0 || c < 0 || r >= L.ROWS || c >= L.COLS) continue;
        allOut = false;
        const kk = r*L.COLS + c;
        if(L.wall[kk]) walls++;
        else if(occ[kk] !== -1 && occ[kk] !== i) seen.add(occ[kk]);
      }
      if(allOut) break;
    }
    const cost = (walls > 0 ? 3 + seen.size : 1 + align + seen.size) + shut;
    if(cost < best) best = cost;
  }
  return best === Infinity ? (strict ? Infinity : 1) : best;
}

/* --- constraint checking -------------------------------------------------- */

/* the 1-based move number each block leaves on (null if it never does) */
function exitSchedule(L, path){
  const when = new Array(L.blocks.length).fill(null);
  path.forEach((mv, n) => { if(mv.exit && when[mv.b] === null) when[mv.b] = n + 1; });
  return when;
}

/* does this solution respect every move-based bomb? */
function bombsOk(L, path){
  const when = exitSchedule(L, path);
  for(let i=0;i<L.blocks.length;i++){
    const bomb = L.blocks[i].bomb;
    if(!bomb || bomb.type !== "moves") continue;
    if(when[i] === null || when[i] > bomb.value) return false;
  }
  return true;
}

module.exports = {SIDE_DIR, SIDE_AXIS, DIR_NAME, makeLevel, stateKey, cloneState, buildOcc,
                  exitedCount, gateOpen, isFrozen, fits, arrowsAllow, onIce, canStep, iceSlide,
                  outsideOk, exitSteps, exitStepsVia, exitGateFor, moves, applyMove, solved,
                  exitCost, exitSchedule, bombsOk};
