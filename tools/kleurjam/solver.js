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

function heuristic(L, st, occ, goal){
  // Met een doelblok telt alleen dat blok: zo kan de zoeker gericht één bepaald
  // blok naar buiten werken in plaats van het eerstvolgende dat meevalt.
  if(goal !== undefined && goal !== null){
    if(st.out[goal]) return 0;
    const c = E.exitCost(L, st, occ, goal);
    return c === Infinity ? 0 : c;
  }
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
  // Niet het aantal uitgeklapte knopen maar het aantal bewaarde toestanden
  // bepaalt het geheugengebruik: met ~150 opvolgers per knoop loopt dat anders
  // hard op. Boven deze grens zoeken we verder met wat er al in de wachtrij zit.
  // Een toestand van 60 blokken kost veel meer dan een van 10, dus schaalt de
  // grens mee met het aantal blokken.
  const maxOpen = opts.maxOpen || Math.max(40000, Math.floor(1600000 / Math.max(8, L.blocks.length)));
  let pushed = 0;
  const W = opts.weight || 2.2;
  const rnd = opts.rnd || Math.random;
  const goal = opts.goal;
  const seen = new Map();
  const h0 = heuristic(L, st, E.buildOcc(L, st), goal);
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
      if(mv.exit && (goal === undefined || goal === null || mv.b === goal)){
        const path = [mv];
        let p = node;
        while(p && p.mv){ path.push(p.mv); p = p.parent; }
        path.reverse();
        return {path, state:ns, expanded};
      }
      // Boven de grens niets meer bijhouden: ook de bezochte-lijst groeide door
      // terwijl er allang niets meer in de wachtrij ging, en dát liep uit de hand.
      if(pushed >= maxOpen) continue;
      const k = E.stateKey(L, ns);
      const g = node.g + 1;
      const prev = seen.get(k);
      if(prev !== undefined && prev <= g) continue;
      seen.set(k, g);
      pushed++;
      const nocc = E.buildOcc(L, ns);
      open.push({f: g + W*heuristic(L, ns, nocc, goal), g, st:ns, parent:node, mv});
    }
  }
  return null;
}

/* Full solve = chain of phases.

   Elke fase kiest de goedkoopste manier om één blok naar buiten te krijgen, en
   dat is een gok: op een propvol bord kan een blok dat er vroeg uit gaat de rest
   opsluiten. Loopt een fase vast, dan draaien we de vorige terug en zoeken die
   opnieuw met een andere volgorde. Zonder dat terugstappen bleven een paar zware
   levels onvindbaar terwijl er wel degelijk een oplossing was. */
function solveOnce(L, opts){
  opts = opts || {};
  const baseRnd = opts.rnd || Math.random;
  // desgewenst verderspelen vanaf een stand die al een stuk onderweg is
  let st = opts.startState
    ? {pos:opts.startState.pos.slice(), out:opts.startState.out.slice()}
    : {pos:L.start.pos.slice(), out:L.start.out.slice()};
  const all = [];
  const stack = [];
  const maxMoves = opts.maxMoves || 500;
  const maxBack = opts.backtracks === undefined ? 8 : opts.backtracks;
  let guard = 0, backs = 0, salt = 0;

  while(!E.solved(L, st)){
    if(guard++ > (L.blocks.length + 6) * (maxBack + 1)) return null;
    const rnd = salt === 0 ? baseRnd : mulberry(9001 + salt * 7717);
    // Een bom die bijna afloopt krijgt voorrang: anders werkt de zoeker het
    // goedkoopste blok naar buiten en ontploft ondertussen een ander.
    let goal = null;
    if(!opts.ignoreBombs){
      const occ = E.buildOcc(L, st);
      let krapst = Infinity;
      for(let i=0;i<L.blocks.length;i++){
        const bomb = L.blocks[i].bomb;
        if(!bomb || bomb.type !== "moves" || st.out[i]) continue;
        const over = bomb.value - all.length;                 // zetten die resten
        const nodig = E.exitCost(L, st, occ, i);
        const marge = over - nodig;
        if(marge < krapst && marge < 6){ krapst = marge; goal = i; }
      }
    }
    const p = phase(L, st, Object.assign({}, opts, {rnd, goal}));
    if(!p){
      if(backs++ >= maxBack || !stack.length) return null;
      const prev = stack.pop();
      st = prev.state;
      all.length = prev.len;
      salt++;                       // volgende poging kiest een andere volgorde
      continue;
    }
    stack.push({state: st, len: all.length});
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
    // Bij een uitgangszet telt alleen dat het blok eruit kán: via welke poort en
    // over hoeveel vakjes is een detail van de sleep, en dat kan veranderen zodra
    // een blok een tweede kleur krijgt.
    const legal = E.moves(L, st, occ).some(m => mv.exit
      ? (m.b === mv.b && m.exit)
      : (m.b===mv.b && m.axis===mv.axis && m.d===mv.d && !m.exit && m.to===mv.to));
    if(!legal) return {ok:false, reason:"illegal move", mv};
    st = E.applyMove(L, st, mv);
  }
  if(!E.solved(L, st)) return {ok:false, reason:"not solved", moves:path.length};
  if(!E.bombsOk(L, path)) return {ok:false, reason:"a bomb goes off first", moves:path.length};
  return {ok:true, moves: path.length};
}

module.exports = {solve, solveOnce, phase, verify, mulberry, Heap};
