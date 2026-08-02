"use strict";
/* Phase solver: repeatedly search for the cheapest way to get *some* block out.
   Each phase is a weighted-A-star search; the sum of the phases is a valid, and in
   practice near-optimal, solution to the whole level. */

const E = require("./engine");

class Heap {
  constructor(){ this.a = []; }
  get size(){ return this.a.length; }
  push(n){
    const a = this.a; a.push(n);
    let i = a.length-1;
    while(i > 0){
      const p = (i-1) >> 1;
      if(a[p].f <= a[i].f) break;
      const t = a[p]; a[p] = a[i]; a[i] = t; i = p;
    }
  }
  pop(){
    const a = this.a, top = a[0], last = a.pop();
    if(a.length){
      a[0] = last;
      let i = 0;
      for(;;){
        const l = 2*i+1, r = l+1;
        let m = i;
        if(l < a.length && a[l].f < a[m].f) m = l;
        if(r < a.length && a[r].f < a[m].f) m = r;
        if(m === i) break;
        const t = a[m]; a[m] = a[i]; a[i] = t; i = m;
      }
    }
    return top;
  }
}

function heuristic(L, st, occ){
  let best = Infinity;
  for(let i=0;i<L.blocks.length;i++){
    if(st.out[i] || !L.blocks[i].gate) continue;
    const c = E.exitCost(L, st, occ, i);
    if(c < best) best = c;
  }
  return best === Infinity ? 0 : best;
}

/* one phase: from `st`, find a move sequence ending with an exit */
function phase(L, st, opts){
  const cap = opts.cap || 120000;
  const W = opts.weight || 2.2;
  const rnd = opts.rnd || Math.random;
  const seen = new Map();
  const h0 = heuristic(L, st, E.buildOcc(L, st));
  const open = new Heap();
  open.push({f:W*h0, g:0, st, parent:null, mv:null});
  seen.set(E.stateKey(L, st), 0);
  let expanded = 0;
  while(open.size && expanded < cap){
    const node = open.pop();
    expanded++;
    const occ = E.buildOcc(L, node.st);
    const mvs = E.moves(L, node.st, occ);
    // slight shuffle so repeated runs explore differently
    for(let i=mvs.length-1;i>0;i--){ const j=(rnd()*(i+1))|0; const t=mvs[i]; mvs[i]=mvs[j]; mvs[j]=t; }
    for(const mv of mvs){
      const ns = E.applyMove(L, node.st, mv);
      if(mv.exit){
        const path = [mv];
        let p = node;
        while(p && p.mv){ path.push(p.mv); p = p.parent; }
        path.reverse();
        return {path, state:ns, expanded};
      }
      const k = E.stateKey(L, ns);
      const g = node.g + 1;
      const prev = seen.get(k);
      if(prev !== undefined && prev <= g) continue;
      seen.set(k, g);
      const nocc = E.buildOcc(L, ns);
      open.push({f: g + W*heuristic(L, ns, nocc), g, st:ns, parent:node, mv});
    }
  }
  return null;
}

/* full solve = chain of phases */
function solveOnce(L, opts){
  opts = opts || {};
  let st = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  const all = [];
  const maxMoves = opts.maxMoves || 500;
  let guard = 0;
  while(!E.solved(L, st)){
    if(guard++ > L.blocks.length + 4) return null;
    const p = phase(L, st, opts);
    if(!p) return null;
    for(const mv of p.path) all.push(mv);
    st = p.state;
    if(all.length > maxMoves) return null;
  }
  return all;
}

function mulberry(seed){
  let a = seed >>> 0;
  return function(){
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* best of N randomized runs */
function solve(level, opts){
  opts = opts || {};
  const L = E.makeLevel(level);
  const tries = opts.tries || 3;
  let best = null;
  for(let t=0;t<tries;t++){
    const res = solveOnce(L, Object.assign({}, opts, {rnd: mulberry(1000 + t*7919 + (opts.seed||0))}));
    if(res && (!best || res.length < best.length)) best = res;
  }
  return best;
}

/* replays a move list and asserts every move is legal */
function verify(level, path){
  const L = E.makeLevel(level);
  let st = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  for(const mv of path){
    const occ = E.buildOcc(L, st);
    const legal = E.moves(L, st, occ).some(m => m.b===mv.b && m.axis===mv.axis && m.d===mv.d && !!m.exit===!!mv.exit);
    if(!legal) return {ok:false, reason:"illegal move", mv};
    st = E.applyMove(L, st, mv);
  }
  return {ok: E.solved(L, st), moves: path.length};
}

module.exports = {solve, solveOnce, phase, verify, mulberry, Heap};
