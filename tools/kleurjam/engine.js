"use strict";
/* Rules engine for Kleurjam — mirrors the in-game logic exactly.
   A "move" is one drag of a block along one axis over any distance (>=1 cell),
   or a drag that carries the block out through its own colour gate. */

const SIDE_DIR  = {top:[-1,0], bottom:[1,0], left:[0,-1], right:[0,1]};
const SIDE_AXIS = {top:"V", bottom:"V", left:"H", right:"H"};

function makeLevel(lvl){
  const ROWS = lvl.rows, COLS = lvl.cols;
  const wall = new Uint8Array(ROWS*COLS);
  for(const w of (lvl.walls||[])) wall[w[0]*COLS + w[1]] = 1;
  const gateByColor = {};
  for(const g of lvl.gates) if(!(g.color in gateByColor)) gateByColor[g.color] = g;
  const blocks = lvl.blocks.map((b,i) => ({
    i, id:b.id, color:b.color, move:b.move, cells:b.cells,
    gate: gateByColor[b.color] || null,
    h: Math.max(...b.cells.map(c=>c[0])) + 1,
    w: Math.max(...b.cells.map(c=>c[1])) + 1
  }));
  return {ROWS, COLS, wall, blocks, gates:lvl.gates, gateByColor,
          start:{pos:lvl.blocks.map(b => b.row*COLS + b.col), out:lvl.blocks.map(()=>0)},
          raw:lvl};
}

function stateKey(L, st){
  let s = "";
  for(let i=0;i<st.pos.length;i++) s += (st.out[i] ? "x" : st.pos[i]) + ",";
  return s;
}

function cloneState(st){ return {pos:st.pos.slice(), out:st.out.slice()}; }

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

function outsideOk(L, r, c, gate){
  const lo = gate.index, hi = gate.index + gate.span - 1;
  if(gate.side === "right")  return c >= L.COLS && r >= lo && r <= hi && r >= 0 && r < L.ROWS;
  if(gate.side === "left")   return c < 0       && r >= lo && r <= hi && r >= 0 && r < L.ROWS;
  if(gate.side === "bottom") return r >= L.ROWS && c >= lo && c <= hi && c >= 0 && c < L.COLS;
  if(gate.side === "top")    return r < 0       && c >= lo && c <= hi && c >= 0 && c < L.COLS;
  return false;
}

/* steps needed to leave the board entirely from (r0,c0), or -1 */
function exitSteps(L, b, r0, c0, occ, self){
  const gate = b.gate;
  if(!gate) return -1;
  if(b.move !== "A" && b.move !== SIDE_AXIS[gate.side]) return -1;
  const d = SIDE_DIR[gate.side];
  for(let k=1;k<=L.ROWS+L.COLS+4;k++){
    let allOut = true;
    for(const rc of b.cells){
      const r = r0 + d[0]*k + rc[0];
      const c = c0 + d[1]*k + rc[1];
      const inside = r >= 0 && r < L.ROWS && c >= 0 && c < L.COLS;
      if(inside){
        allOut = false;
        const kk = r*L.COLS + c;
        if(L.wall[kk] || (occ[kk] !== -1 && occ[kk] !== self)) return -1;
      } else if(!outsideOk(L, r, c, gate)) return -1;
    }
    if(allOut) return k;
  }
  return -1;
}

/* All legal moves from a state.
   Each move: {b:blockIndex, axis:"H"|"V", d:offset, exit:bool} */
function moves(L, st, occ){
  occ = occ || buildOcc(L, st);
  const out = [];
  for(let i=0;i<L.blocks.length;i++){
    if(st.out[i]) continue;
    const b = L.blocks[i];
    const r0 = (st.pos[i] / L.COLS) | 0, c0 = st.pos[i] % L.COLS;
    const axes = b.move === "A" ? ["H","V"] : [b.move];
    for(const axis of axes){
      for(const sgn of [-1, 1]){
        for(let k=1;k<=Math.max(L.ROWS,L.COLS);k++){
          const r = axis === "V" ? r0 + sgn*k : r0;
          const c = axis === "H" ? c0 + sgn*k : c0;
          if(!fits(L, b, r, c, occ, i)) break;
          out.push({b:i, axis, d:sgn*k, exit:false});
        }
      }
    }
    if(b.gate){
      const k = exitSteps(L, b, r0, c0, occ, i);
      if(k > 0) out.push({b:i, axis:SIDE_AXIS[b.gate.side], d:k, exit:true});
    }
  }
  return out;
}

function applyMove(L, st, mv){
  const ns = cloneState(st);
  if(mv.exit){ ns.out[mv.b] = 1; return ns; }
  const b = L.blocks[mv.b];
  let r = (st.pos[mv.b] / L.COLS) | 0, c = st.pos[mv.b] % L.COLS;
  if(mv.axis === "H") c += mv.d; else r += mv.d;
  ns.pos[mv.b] = r*L.COLS + c;
  return ns;
}

function solved(L, st){
  for(let i=0;i<L.blocks.length;i++){
    if(L.blocks[i].gate && !st.out[i]) return false;
  }
  return true;
}

/* lower-bound-ish cost to get block i out of the board */
function exitCost(L, st, occ, i){
  const b = L.blocks[i];
  const gate = b.gate;
  if(!gate) return 0;
  if(b.move !== "A" && b.move !== SIDE_AXIS[gate.side]) return Infinity;
  const r0 = (st.pos[i] / L.COLS) | 0, c0 = st.pos[i] % L.COLS;
  const vertGate = (gate.side === "top" || gate.side === "bottom");
  // alignment: which lane must the block sit in?
  let align = 0, tr = r0, tc = c0;
  if(vertGate){
    const lo = gate.index, hi = gate.index + gate.span - b.w;
    if(c0 < lo || c0 > hi){ align = 1; tc = Math.min(Math.max(c0, lo), hi); }
    if(align && b.move === "V") return Infinity;
  } else {
    const lo = gate.index, hi = gate.index + gate.span - b.h;
    if(r0 < lo || r0 > hi){ align = 1; tr = Math.min(Math.max(r0, lo), hi); }
    if(align && b.move === "H") return Infinity;
  }
  // count distinct blocks / walls in the corridor from the aligned spot to the edge
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
  if(walls > 0) return 2 + seen.size + 1; // must detour around a wall
  return 1 + align + seen.size;
}

module.exports = {SIDE_DIR, SIDE_AXIS, makeLevel, stateKey, cloneState, buildOcc,
                  fits, exitSteps, moves, applyMove, solved, exitCost};
