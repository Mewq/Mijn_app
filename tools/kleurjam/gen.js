"use strict";
/* Reverse level generator.
   A level is built by playing the game backwards: blocks slide IN through their
   own gate and are then shuffled deeper into the board. Every level produced is
   therefore solvable by construction; the solver measures how long it takes. */

const E = require("./engine");
const S = require("./solver");

const COLORS = ["red","orange","yellow","green","teal","blue","purple","pink"];

/* ---------- shapes ---------- */

function norm(cells){
  const mr = Math.min(...cells.map(c=>c[0])), mc = Math.min(...cells.map(c=>c[1]));
  return cells.map(c=>[c[0]-mr, c[1]-mc]).sort((a,b)=> a[0]-b[0] || a[1]-b[1]);
}
function rot(cells){ return norm(cells.map(c=>[c[1], -c[0]])); }
function rotations(cells){
  const out = [], seen = new Set();
  let cur = norm(cells);
  for(let i=0;i<4;i++){
    const k = JSON.stringify(cur);
    if(!seen.has(k)){ seen.add(k); out.push(cur); }
    cur = rot(cur);
  }
  return out;
}

const BASE = {
  D1: [[0,0]],
  I2: [[0,0],[0,1]],
  I3: [[0,0],[0,1],[0,2]],
  I4: [[0,0],[0,1],[0,2],[0,3]],
  O:  [[0,0],[0,1],[1,0],[1,1]],
  L3: [[0,0],[1,0],[1,1]],
  L4: [[0,0],[1,0],[2,0],[2,1]],
  J4: [[0,1],[1,1],[2,0],[2,1]],
  S4: [[0,1],[0,2],[1,0],[1,1]],
  Z4: [[0,0],[0,1],[1,1],[1,2]],
  T4: [[0,0],[0,1],[0,2],[1,1]],
  P5: [[0,0],[0,1],[1,0],[1,1],[2,0]],
  U5: [[0,0],[0,2],[1,0],[1,1],[1,2]],
  X5: [[0,1],[1,0],[1,1],[1,2],[2,1]],
  T5: [[0,0],[0,1],[0,2],[1,1],[2,1]],
  L5: [[0,0],[1,0],[2,0],[3,0],[3,1]],
  O6: [[0,0],[0,1],[1,0],[1,1],[2,0],[2,1]]
};

function shapeVariants(names){
  const out = [];
  for(const n of names) for(const cells of rotations(BASE[n])) out.push({name:n, cells});
  return out;
}

/* ---------- helpers ---------- */

function dims(cells){
  return {h: Math.max(...cells.map(c=>c[0]))+1, w: Math.max(...cells.map(c=>c[1]))+1};
}

function pick(rnd, arr){ return arr[(rnd()*arr.length)|0]; }
function shuffle(rnd, arr){
  for(let i=arr.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; const t=arr[i]; arr[i]=arr[j]; arr[j]=t; }
  return arr;
}

/* distance of a block from its own gate (0 = ready to leave) */
function gateDist(L, b, r, c){
  const g = b.gate;
  if(!g) return 0;
  let along, lane, lo, hi;
  if(g.side === "right"){ along = L.COLS - (c + b.w); lo = g.index; hi = g.index + g.span - b.h; lane = r; }
  else if(g.side === "left"){ along = c; lo = g.index; hi = g.index + g.span - b.h; lane = r; }
  else if(g.side === "bottom"){ along = L.ROWS - (r + b.h); lo = g.index; hi = g.index + g.span - b.w; lane = c; }
  else { along = r; lo = g.index; hi = g.index + g.span - b.w; lane = c; }
  const miss = lane < lo ? lo - lane : (lane > hi ? lane - hi : 0);
  return along + miss*2;
}

/* ---------- generation ---------- */

function generate(seed, P){
  const rnd = S.mulberry(seed);
  const ROWS = P.rows, COLS = P.cols;
  const variants = shapeVariants(P.shapes);

  /* --- walls: either a room layout or a handful of small clusters --- */
  const walls = [];
  const wallSet = new Set();
  const addWall = (w) => {
    const key = w[0]+","+w[1];
    if(!wallSet.has(key)){ wallSet.add(key); walls.push(w); }
  };
  if(P.mask){
    const M = require("./masks");
    for(const w of M.MASKS[P.mask](ROWS, COLS, rnd)) addWall(w);
  }
  if(P.wallStyle){
    const R = require("./rooms");
    for(const w of R.rooms(rnd, ROWS, COLS, P.wallStyle)) addWall(w);
  }
  const clusters = P.wallClusters === undefined ? 3 : P.wallClusters;
  for(let i=0;i<clusters;i++){
    let r = 1 + ((rnd()*(ROWS-2))|0), c = 1 + ((rnd()*(COLS-2))|0);
    const len = 1 + ((rnd()*3)|0);
    const dr = rnd() < .5 ? 0 : 1, dc = dr ? 0 : 1;
    for(let k=0;k<len;k++){
      const rr = r + dr*k, cc = c + dc*k;
      if(rr < 1 || cc < 1 || rr > ROWS-2 || cc > COLS-2) break;
      const key = rr+","+cc;
      if(!wallSet.has(key)){ wallSet.add(key); walls.push([rr,cc]); }
    }
  }

  /* --- choose the block roster --- */
  const roster = [];
  const colorCount = Math.min(P.colors || 8, COLORS.length);
  const useColors = shuffle(rnd, COLORS.slice()).slice(0, colorCount);
  for(let i=0;i<P.colored;i++){
    const v = pick(rnd, variants);
    const color = useColors[i % colorCount];
    roster.push({color, cells:v.cells, shape:v.name});
  }
  const stoneVariants = P.stoneShapes ? shapeVariants(P.stoneShapes) : variants;
  for(let i=0;i<P.stones;i++){
    const v = pick(rnd, stoneVariants);
    roster.push({color:"stone", cells:v.cells, shape:v.name});
  }
  // extra stones dropped into the leftover holes once the colour blocks are in;
  // these break the reverse-play guarantee, so such levels are solver-verified
  for(let i=0;i<(P.fillStones||0);i++){
    const v = pick(rnd, stoneVariants);
    roster.push({color:"stone", cells:v.cells, shape:v.name, fill:true});
  }

  /* --- gates: one per used colour, wide enough for every block wearing it --- */
  const sides = P.gateSides || ["top","bottom","left","right"];
  const gates = [];
  const gateByColor = {};
  const taken = {top:[], bottom:[], left:[], right:[]};
  // two gates must never share edge cells, otherwise they render on top of
  // each other and the player cannot tell them apart
  const clashes = (side, index, span, margin) => taken[side].some(
    g => index < g.index + g.span + margin && g.index < index + span + margin);
  for(const color of useColors){
    const mine = roster.filter(b => b.color === color);
    if(!mine.length) continue;
    let ok = null, fallback = null;
    for(let attempt=0; attempt<200 && !ok; attempt++){
      const margin = attempt < 120 ? 1 : 0;
      const side = pick(rnd, sides);
      const vertical = side === "top" || side === "bottom";
      // a block can only reach a top/bottom gate if it may move vertically, etc.
      const need = Math.max(...mine.map(b => vertical ? dims(b.cells).w : dims(b.cells).h));
      const limit = vertical ? COLS : ROWS;
      const slack = P.spanSlack === undefined ? ((rnd() < .5) ? 0 : 1) : ((rnd() * (P.spanSlack + 1)) | 0);
      const span = Math.min(limit, need + slack);
      if(span > limit) continue;
      const index = (rnd()*(limit - span + 1))|0;
      const cand = {color, side, index, span};
      if(clashes(side, index, span, margin)) continue;
      if(!fallback) fallback = cand;
      // the doorway itself must not be bricked up
      let open = false;
      for(const b of mine){
        const d = dims(b.cells);
        const lo = index, hi = index + span - (vertical ? d.w : d.h);
        for(let lane = lo; lane <= hi && !open; lane++){
          let r, c;
          if(side === "right"){ r = lane; c = COLS - d.w; }
          else if(side === "left"){ r = lane; c = 0; }
          else if(side === "bottom"){ c = lane; r = ROWS - d.h; }
          else { c = lane; r = 0; }
          let clear = true;
          for(const rc of b.cells) if(wallSet.has((r+rc[0])+","+(c+rc[1]))) clear = false;
          if(clear) open = true;
        }
      }
      if(open) ok = cand;
    }
    if(!ok) ok = fallback;
    if(!ok || clashes(ok.side, ok.index, ok.span, 0)) continue;   // this colour gets no gate
    gates.push(ok);
    taken[ok.side].push(ok);
    gateByColor[color] = ok;
  }

  // a colour that could not get a gate of its own becomes plain stone
  for(const b of roster) if(b.color !== "stone" && !gateByColor[b.color]) b.color = "stone";

  /* --- movement types: restricted blocks must still be able to reach their gate --- */
  for(const b of roster){
    const g = gateByColor[b.color];
    const r = rnd();
    if(r < (P.restricted || 0.25)){
      const axis = g ? E.SIDE_AXIS[g.side] : (rnd() < .5 ? "H" : "V");
      b.move = axis;
    } else b.move = "A";
  }

  /* --- reverse play --- */
  const level = {rows:ROWS, cols:COLS, walls, blocks:[], gates};
  const L = E.makeLevel({rows:ROWS, cols:COLS, walls, gates,
    blocks: roster.map((b,i)=>({id:"b"+i, color:b.color, move:b.move, cells:b.cells, row:0, col:0}))});

  const placed = [];                      // indices currently on the board
  const st = {pos:new Array(roster.length).fill(0), out:new Array(roster.length).fill(1)};

  function occNow(){ return E.buildOcc(L, st); }

  function tryPlaceStone(i){
    const b = L.blocks[i];
    for(let t=0;t<200;t++){
      const r = (rnd()*(ROWS - b.h + 1))|0, c = (rnd()*(COLS - b.w + 1))|0;
      const occ = occNow();
      if(E.fits(L, b, r, c, occ, i)){ st.pos[i] = r*COLS + c; st.out[i] = 0; return true; }
    }
    return false;
  }

  function tryInsert(i){
    const b = L.blocks[i], g = b.gate;
    if(!g) return tryPlaceStone(i);
    const vertical = g.side === "top" || g.side === "bottom";
    const lanes = [];
    const lo = g.index, hi = g.index + g.span - (vertical ? b.w : b.h);
    for(let l = lo; l <= hi; l++) lanes.push(l);
    shuffle(rnd, lanes);
    const depths = [];
    const maxDepth = P.insertDepth === undefined ? 5 : P.insertDepth;
    for(let d=0; d<=maxDepth; d++) depths.push(d);
    shuffle(rnd, depths);
    const occ = occNow();
    for(const lane of lanes){
      for(const d of depths){
        let r, c;
        if(g.side === "right"){ r = lane; c = COLS - b.w - d; }
        else if(g.side === "left"){ r = lane; c = d; }
        else if(g.side === "bottom"){ c = lane; r = ROWS - b.h - d; }
        else { c = lane; r = d; }
        if(!E.fits(L, b, r, c, occ, i)) continue;
        st.pos[i] = r*COLS + c; st.out[i] = 0;
        if(E.exitSteps(L, b, r, c, occ, i) > 0) return true;
        st.out[i] = 1;
      }
    }
    return false;
  }

  /* cells a block would need in order to slide in through its own gate */
  function doorway(i, maxDepth){
    const b = L.blocks[i], g = b.gate;
    if(!g) return [];
    const vertical = g.side === "top" || g.side === "bottom";
    const lo = g.index, hi = g.index + g.span - (vertical ? b.w : b.h);
    const set = new Set();
    for(let lane = lo; lane <= hi; lane++){
      for(let d=0; d<=maxDepth; d++){
        let r, c;
        if(g.side === "right"){ r = lane; c = COLS - b.w - d; }
        else if(g.side === "left"){ r = lane; c = d; }
        else if(g.side === "bottom"){ c = lane; r = ROWS - b.h - d; }
        else { c = lane; r = d; }
        for(const rc of b.cells){
          const rr = r + rc[0], cc = c + rc[1];
          if(rr>=0 && cc>=0 && rr<ROWS && cc<COLS) set.add(rr*COLS + cc);
        }
      }
    }
    return set;
  }

  /* nudge whoever is squatting in the doorway out of the way */
  function clearDoorway(i, rounds){
    const zone = doorway(i, P.insertDepth === undefined ? 5 : P.insertDepth);
    if(!zone || !zone.size) return;
    for(let t=0;t<rounds;t++){
      const occ = occNow();
      const squatters = new Set();
      for(const k of zone) if(occ[k] !== -1 && occ[k] !== i) squatters.add(occ[k]);
      if(!squatters.size) return;
      const j = pick(rnd, [...squatters]);
      const bj = L.blocks[j];
      const opts = E.moves(L, st, occ).filter(m => m.b === j && !m.exit);
      if(!opts.length) continue;
      let best = Infinity, bests = [];
      for(const m of opts){
        const r = (m.to/COLS)|0, c = m.to%COLS;
        let overlap = 0;
        for(const rc of bj.cells) if(zone.has((r+rc[0])*COLS + (c+rc[1]))) overlap++;
        if(overlap < best){ best = overlap; bests = [m]; }
        else if(overlap === best) bests.push(m);
      }
      st.pos[j] = pick(rnd, bests).to;
    }
  }

  /* drive one block as far from its own gate as possible */
  function pushDeep(i, n){
    for(let t=0;t<n;t++){
      const occ = occNow();
      const b = L.blocks[i];
      const opts = E.moves(L, st, occ).filter(m => m.b === i && !m.exit);
      if(!opts.length) return;
      let best = -Infinity, bests = [];
      for(const m of opts){
        const r = (m.to/COLS)|0, c = m.to%COLS;
        const d = gateDist(L, b, r, c);
        if(d > best){ best = d; bests = [m]; }
        else if(d === best) bests.push(m);
      }
      st.pos[i] = pick(rnd, bests).to;
    }
  }

  function randomSlides(n){
    for(let k=0;k<n;k++){
      if(!placed.length) return;
      const occ = occNow();
      const i = pick(rnd, placed);
      const b = L.blocks[i];
      const opts = E.moves(L, st, occ).filter(m => m.b === i && !m.exit);
      if(!opts.length) continue;
      let chosen;
      if(rnd() < (P.awayBias === undefined ? 0.8 : P.awayBias)){
        let best = -Infinity, bests = [];
        for(const m of opts){
          const r = (m.to/COLS)|0, c = m.to%COLS;
          const d = b.gate ? gateDist(L, b, r, c)
                           : Math.min(r, ROWS-1-r) + Math.min(c, COLS-1-c); // stones drift inward
          if(d > best){ best = d; bests = [m]; }
          else if(d === best) bests.push(m);
        }
        chosen = pick(rnd, bests);
      } else chosen = pick(rnd, opts);
      st.pos[i] = chosen.to;
    }
  }

  // stones first, then the colour blocks slide in one by one
  const stoneIdx = [], colorIdx = [], fillIdx = [];
  roster.forEach((b,i) => {
    if(b.fill) fillIdx.push(i);
    else if(b.color === "stone") stoneIdx.push(i);
    else colorIdx.push(i);
  });
  for(const i of stoneIdx){ if(tryPlaceStone(i)) placed.push(i); }
  shuffle(rnd, colorIdx);
  for(const i of colorIdx){
    let done = false;
    for(let attempt=0; attempt<25 && !done; attempt++){
      if(tryInsert(i)) done = true;
      else { clearDoorway(i, 6); randomSlides(2); }
    }
    if(!done) continue;              // board is full — this block simply stays out
    placed.push(i);
    pushDeep(i, P.pushDeep === undefined ? 2 : P.pushDeep);
    randomSlides(P.slides === undefined ? placed.length : P.slides);
  }
  randomSlides(P.finalSlides === undefined ? placed.length * 3 : P.finalSlides);
  for(const i of fillIdx){ if(tryPlaceStone(i)) placed.push(i); }

  const kept = roster.map((b,i)=>i).filter(i => !st.out[i]);
  if(kept.filter(i => roster[i].color !== "stone").length < (P.minColored || 8)) return null;

  level.blocks = kept.map((i, n) => ({
    id:"b"+n, color:roster[i].color, move:roster[i].move, cells:roster[i].cells,
    row:(st.pos[i]/COLS)|0, col:st.pos[i]%COLS
  }));
  // drop gates for colours nobody wears (cannot happen, but be safe)
  level.gates = gates.filter(g => level.blocks.some(b => b.color === g.color));
  return level;
}

module.exports = {generate, COLORS, BASE, shapeVariants, dims};
