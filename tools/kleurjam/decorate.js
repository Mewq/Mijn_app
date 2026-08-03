"use strict";
/* Hangt mechanics aan een level dat al een geverifieerde oplossing heeft.

   De truc: elke mechanic wordt afgeleid uit die oplossing zelf. Een poort gaat
   pas op slot vanaf een moment dat de oplossing hem toch nog niet gebruikte,
   een blok bevriest alleen tot vlak voor de zet waarop de oplossing hem voor
   het eerst aanraakt, en een bom krijgt precies zoveel zetten als de oplossing
   nodig had plus wat marge. Daardoor blijft dezelfde oplossing geldig en is het
   level dus nog steeds uit te spelen — de speler moet die volgorde alleen zelf
   vinden.

   IJs- en pijltegels zitten hier bewust niet in: die veranderen hoe blokken
   bewegen, dus die moeten al bij het genereren meedoen.                      */

const E = require("./engine");

function clone(l){ return JSON.parse(JSON.stringify(l)); }

/* op welke zet verlaat elk blok het bord, en wanneer beweegt het voor het eerst */
function schedule(L, path){
  const exitAt = new Array(L.blocks.length).fill(null);
  const firstMove = new Array(L.blocks.length).fill(null);
  const exitedBefore = new Array(L.blocks.length).fill(null);  // aantal blokken al weg
  let gone = 0;
  path.forEach((mv, n) => {
    if(firstMove[mv.b] === null) firstMove[mv.b] = {move:n+1, gone};
    if(mv.exit && exitAt[mv.b] === null){
      exitAt[mv.b] = n + 1;
      exitedBefore[mv.b] = gone;
      gone++;
    }
  });
  return {exitAt, firstMove, exitedBefore, total:gone};
}

/* --- losse mechanics ------------------------------------------------------ */

function addTimer(lvl, par, opts){
  const perMove = (opts && opts.secondsPerMove) || 3.2;
  const slack   = (opts && opts.slack) || 25;
  lvl.timeLimit = Math.round((par * perMove + slack) / 5) * 5;
  return `klok ${lvl.timeLimit}s`;
}

/* een bom op een blok dat in de oplossing sowieso vroeg naar buiten gaat */
function addBomb(lvl, L, sch, rnd, opts){
  const type = (opts && opts.type) || "moves";
  const slack = (opts && opts.slack) === undefined ? 4 : opts.slack;
  const cands = [];
  for(let i=0;i<L.blocks.length;i++){
    if(sch.exitAt[i] === null) continue;              // stenen blijven liggen
    if(lvl.blocks[i].bomb || lvl.blocks[i].frozen || lvl.blocks[i].key) continue;
    cands.push(i);
  }
  if(!cands.length) return null;
  // niet het allereerste blok: dan is er geen keuze te maken
  cands.sort((a,b) => sch.exitAt[a] - sch.exitAt[b]);
  const pool = cands.slice(Math.min(1, cands.length-1), Math.max(2, Math.ceil(cands.length*0.5)));
  const i = pool[(rnd()*pool.length)|0];
  const value = type === "moves"
    ? sch.exitAt[i] + slack
    : Math.round((sch.exitAt[i] * 3.2 + 20) / 5) * 5;
  lvl.blocks[i].bomb = {type, value};
  return `bom op ${lvl.blocks[i].color} (${value} ${type === "moves" ? "zetten" : "sec"})`;
}

/* een poort die pas opengaat als er al een aantal blokken weg is */
function addLockedGate(lvl, L, sch, rnd, opts){
  const minOpen = (opts && opts.min) || 2;
  const cands = [];
  lvl.gates.forEach((g, gi) => {
    if(g.locked || g.keyLocked) return;
    // eerste moment waarop de oplossing deze poort gebruikt
    let firstUse = Infinity;
    for(let i=0;i<L.blocks.length;i++){
      if(sch.exitAt[i] === null) continue;
      const colors = L.blocks[i].colors;
      if(!colors.includes(g.color)) continue;
      if(sch.exitedBefore[i] < firstUse) firstUse = sch.exitedBefore[i];
    }
    if(firstUse === Infinity) firstUse = sch.total;   // poort wordt nooit gebruikt
    if(firstUse >= minOpen) cands.push({gi, openAfter:firstUse});
  });
  if(!cands.length) return null;
  const pick = cands[(rnd()*cands.length)|0];
  lvl.gates[pick.gi].locked = {openAfter: pick.openAfter};
  return `poort ${lvl.gates[pick.gi].color} op slot tot ${pick.openAfter} blokken weg`;
}

/* een blok dat pas later hoeft te bewegen, mag tot dan bevroren zijn */
function addFrozen(lvl, L, sch, rnd, opts){
  const minThaw = (opts && opts.min) || 2;
  const cands = [];
  for(let i=0;i<L.blocks.length;i++){
    if(lvl.blocks[i].bomb || lvl.blocks[i].frozen || lvl.blocks[i].key) continue;
    const fm = sch.firstMove[i];
    const gone = fm ? fm.gone : sch.total;            // nooit bewogen = altijd veilig
    if(gone >= minThaw) cands.push({i, thawAfter:gone});
  }
  if(!cands.length) return null;
  const pick = cands[(rnd()*cands.length)|0];
  lvl.blocks[pick.i].frozen = {thawAfter: pick.thawAfter};
  return `${lvl.blocks[pick.i].color} bevroren tot ${pick.thawAfter} blokken weg`;
}

/* sleutelblok + poorten die pas opengaan als de sleutel buiten is */
function addKey(lvl, L, sch, rnd, opts){
  const wantGates = (opts && opts.gates) || 1;
  const cands = [];
  for(let i=0;i<L.blocks.length;i++){
    if(sch.exitAt[i] === null) continue;
    if(lvl.blocks[i].bomb || lvl.blocks[i].frozen) continue;
    // ergens in de eerste helft: daarna valt er nog wat open te maken
    if(sch.exitedBefore[i] >= 1 && sch.exitedBefore[i] <= sch.total - 2) cands.push(i);
  }
  if(!cands.length) return null;
  const keyIdx = cands[(rnd()*cands.length)|0];
  const keyGone = sch.exitedBefore[keyIdx];

  // poorten die de oplossing pas ná de sleutel gebruikt, mogen op slot
  const lockable = [];
  lvl.gates.forEach((g, gi) => {
    if(g.locked || g.keyLocked) return;
    if(g.color === lvl.blocks[keyIdx].color) return;   // niet zijn eigen poort
    let firstUse = Infinity;
    for(let i=0;i<L.blocks.length;i++){
      if(sch.exitAt[i] === null) continue;
      if(!L.blocks[i].colors.includes(g.color)) continue;
      if(sch.exitedBefore[i] < firstUse) firstUse = sch.exitedBefore[i];
    }
    if(firstUse === Infinity || firstUse > keyGone) lockable.push(gi);
  });
  if(!lockable.length) return null;

  lvl.blocks[keyIdx].key = true;
  const chosen = lockable.slice(0, wantGates);
  for(const gi of chosen) lvl.gates[gi].keyLocked = true;
  return `sleutel op ${lvl.blocks[keyIdx].color}, ${chosen.length} poort(en) op slot`;
}

/* een blok dat via twee poorten naar buiten mag */
function addTwoColor(lvl, L, sch, rnd){
  const colors = [...new Set(lvl.gates.map(g => g.color))];
  const cands = [];
  for(let i=0;i<L.blocks.length;i++){
    if(sch.exitAt[i] === null) continue;
    const b = lvl.blocks[i];
    if(b.colors || b.key || b.bomb || b.frozen) continue;
    if(b.move !== "A") continue;                       // moet beide kanten op kunnen
    cands.push(i);
  }
  if(!cands.length) return null;
  const i = cands[(rnd()*cands.length)|0];
  const others = colors.filter(c => c !== lvl.blocks[i].color);
  if(!others.length) return null;
  const second = others[(rnd()*others.length)|0];
  lvl.blocks[i].colors = [lvl.blocks[i].color, second];
  lvl.blocks[i].bonusColor = lvl.blocks[i].color;
  return `${lvl.blocks[i].color}/${second} tweekleurig`;
}

const MECHANICS = {
  timer: (lvl, L, sch, rnd, par, o) => addTimer(lvl, par, o),
  bomb:  (lvl, L, sch, rnd, par, o) => addBomb(lvl, L, sch, rnd, o),
  lock:  (lvl, L, sch, rnd, par, o) => addLockedGate(lvl, L, sch, rnd, o),
  frozen:(lvl, L, sch, rnd, par, o) => addFrozen(lvl, L, sch, rnd, o),
  key:   (lvl, L, sch, rnd, par, o) => addKey(lvl, L, sch, rnd, o),
  twocolor:(lvl, L, sch, rnd, par, o) => addTwoColor(lvl, L, sch, rnd)
};

/* `path` moet een geverifieerde oplossing van `level` zijn */
function decorate(level, path, wanted, rnd, opts){
  rnd = rnd || Math.random;
  opts = opts || {};
  const out = clone(level);
  const L = E.makeLevel(level);
  const sch = schedule(L, path);
  const applied = [];
  for(const name of wanted){
    const fn = MECHANICS[name];
    if(!fn) throw new Error("onbekende mechanic: " + name);
    const note = fn(out, L, sch, rnd, path.length, opts[name]);
    if(note) applied.push(note);
  }
  out.starMargin = out.starMargin === undefined ? 0.25 : out.starMargin;
  return {level: out, applied};
}

module.exports = {decorate, schedule, MECHANICS};
