"use strict";
/* Difficulty hill-climber.
   Any legal slide applied to a solvable position keeps it solvable (moves are
   reversible), so we can wander the space of valid start positions freely and
   keep whatever the solver finds hardest. */

const E = require("./engine");
const S = require("./solver");

function toState(L, level){
  return {pos: level.blocks.map(b => b.row*L.COLS + b.col), out: level.blocks.map(()=>0)};
}
function fromState(L, level, st){
  const copy = JSON.parse(JSON.stringify(level));
  copy.blocks.forEach((b,i) => { b.row = (st.pos[i]/L.COLS)|0; b.col = st.pos[i]%L.COLS; });
  return copy;
}

function perturb(L, st, rnd, n){
  const ns = {pos:st.pos.slice(), out:st.out.slice()};
  for(let k=0;k<n;k++){
    const occ = E.buildOcc(L, ns);
    const mvs = E.moves(L, ns, occ).filter(m => !m.exit);
    if(!mvs.length) break;
    const m = mvs[(rnd()*mvs.length)|0];
    let r = (ns.pos[m.b]/L.COLS)|0, c = ns.pos[m.b]%L.COLS;
    if(m.axis === "H") c += m.d; else r += m.d;
    ns.pos[m.b] = r*L.COLS + c;
  }
  return ns;
}

function measure(level, opts){
  const p = S.solve(level, opts);
  return p ? p.length : -1;
}

function harden(level, opts){
  opts = opts || {};
  const iters = opts.iters || 200;
  const rnd = opts.rnd || S.mulberry(12345);
  const fast = {tries:1, cap: opts.cap || 40000, weight: opts.weight || 2.4, maxMoves: opts.maxMoves || 600};
  const L = E.makeLevel(level);

  let cur = toState(L, level);
  let curLen = measure(level, fast);
  if(curLen < 0) return null;
  let best = cur, bestLen = curLen, bestLevel = level;
  let T = opts.T0 || 6;

  for(let it=0; it<iters; it++){
    T = (opts.T0 || 6) * (1 - it/iters) + 0.4;
    const n = 1 + ((rnd()*(opts.kick || 3))|0);
    const ns = perturb(L, cur, rnd, n);
    const cand = fromState(L, level, ns);
    const len = measure(cand, fast);
    if(len < 0) continue;
    if(len >= curLen || rnd() < Math.exp((len - curLen)/T)){
      cur = ns; curLen = len;
      if(len > bestLen){ bestLen = len; best = ns; bestLevel = cand; }
    }
  }
  return {level: bestLevel, len: bestLen};
}

module.exports = {harden, measure, toState, fromState, perturb};
