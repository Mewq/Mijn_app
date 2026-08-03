"use strict";
/* Pick a difficulty ladder out of the generated pools and splice it into the
   game's LEVELS array. */

const fs = require("fs");
const S = require("./solver");

const NAMES = [
  ["Eerste kleur",      "Sleep elk blok naar de poort met dezelfde kleur."],
  ["Voorrang",          "Eén blok staat het andere in de weg. Wie eerst?"],
  ["Alle kanten op",    "De stipjes op een blok verklappen welke kant het op mag."],
  ["Om de muur",        "Door de gestreepte muren kun je niet heen."],
  ["Grijze stenen",     "Grijze stenen hoeven niet weg, maar ze zitten wel in de weg."],
  ["Smalle poort",      "Een blok past alleen door een poort die breed genoeg is."],
  ["Kettingreactie",    "Zoek het blok dat als eerste naar buiten kan."],
  ["Even terug",        "Soms moet een blok eerst de verkeerde kant op."],
  ["Vierkant probleem", "Grote vierkanten hebben veel ruimte nodig."],
  ["Haakse bocht",      "L-vormen passen maar op één manier door de poort."],
  ["Vaste koers",       "Sommige blokken mogen maar één richting op."],
  ["Spitsuur",          "Ruim eerst op wat je later nodig hebt."],
  ["Wisselplaats",      "Twee blokken moeten van plek ruilen."],
  ["Doorgang",          "Alles moet door hetzelfde gat."],
  ["Knooppunt",         "Twee blokken houden elkaar vast. Eentje moet wijken."],
  ["Sluisdeur",         "Eén blok bewaakt de weg naar drie poorten."],
  ["Opstopping",        "Werk van buiten naar binnen: leeg eerst de randen."],
  ["Dubbel op",         "Twee blokken van dezelfde kleur delen één poort."],
  ["Puzzelplein",       "Bijna honderd zetten. Neem de tijd."],
  ["Rangeerterrein",    "Schuif een blok opzij en het volgende komt vrij."],
  ["De grote jam",      "Ruim de poorten leeg voordat je aan het midden begint."],
  ["Vastgelopen",       "Elke vrije plek telt. Verspil er geen."],
  ["Nauwe marge",       "Er is maar net genoeg ruimte om te draaien."],
  ["Rommelzolder",      "Veel kleine blokjes — begin bij de poort die het dichtst bij is."],
  ["Kluwen",            "Denk twee zetten vooruit voor je iets verschuift."],
  ["Uitpuzzelen",       "Er is één volgorde die werkt. Zoek hem."],
  ["Laatste ruimte",    "Nog een handvol lege vakjes. Gebruik ze goed."],
  ["Meesterproef",      "Meer dan honderd zetten. Rustig ademhalen."],
  ["Eindspel",          "Bijna niets kan bewegen. Bijna."],
  ["De Kleurjam",       "Het diepste punt van het bord. Veel succes."]
];

function load(file){
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch(e){ return []; }
}

function levelSig(l){
  return l.blocks.length + ":" + l.walls.length + ":" + l.gates.map(g=>g.side+g.index).join("");
}

const pools = [];
for(const f of process.argv.slice(3)){
  const data = load(f);
  const arr = Array.isArray(data) ? data : [data];
  for(const l of arr) if(l && l.blocks) pools.push(l);
}

// de-duplicate identical levels, keep the better-measured copy
const bySig = new Map();
for(const l of pools){
  const k = levelSig(l) + ":" + JSON.stringify(l.blocks.map(b=>[b.row,b.col]));
  const prev = bySig.get(k);
  if(!prev || l.par < prev.par) bySig.set(k, l);
}
const all = [...bySig.values()].sort((a,b)=>a.par-b.par);
console.error("pool size", all.length, "par range", all.length ? all[0].par + "-" + all[all.length-1].par : "-");

/* target ladder */
const TARGETS = (process.env.TARGETS || "6,9,13,17,22,27,32,38,45,52,60,70,80,88,95,102,108,115,122,130")
  .split(",").map(Number);

/* Every rung is re-solved before it is accepted. If a candidate cannot be
   re-solved, fall through to the next-closest one rather than leaving a hole:
   the search is randomised, so an occasional miss says more about the solver's
   budget than about the level. */
const EFFORT = [
  {tries:2, cap:60000, weight:2.1, maxMoves:1400},
  {tries:2, cap:120000, weight:1.8, maxMoves:1400}
];

function reverify(l){
  for(const cfg of EFFORT){
    const path = S.solve(l, cfg);
    if(path && S.verify(l, path).ok) return path.length;
  }
  return null;
}

const used = new Set();
const finalLevels = [];
for(const t of TARGETS){
  const order = all.map((l, i) => i)
                   .filter(i => !used.has(i))
                   .sort((x, y) => Math.abs(all[x].par - t) - Math.abs(all[y].par - t));
  let taken = false;
  for(const i of order.slice(0, 8)){
    const len = reverify(all[i]);
    if(len === null){
      used.add(i);                       // unreachable for us; never offer it again
      console.error(`pool level (par ${all[i].par}) could not be re-solved — skipped`);
      continue;
    }
    used.add(i);
    all[i].par = Math.min(all[i].par, len);
    finalLevels.push(all[i]);
    taken = true;
    break;
  }
  if(!taken) console.error(`no level left for target ${t}`);
}
finalLevels.sort((a,b)=>a.par-b.par);

const fmt = (l, i) => {
  const [name, hint] = NAMES[i] || ["Level " + (i+1), ""];
  const walls = "[" + l.walls.map(w=>`[${w[0]},${w[1]}]`).join(",") + "]";
  const blocks = l.blocks.map((b,n) =>
    `        {id:"b${n}",color:"${b.color}",move:"${b.move}",row:${b.row},col:${b.col},cells:[` +
    b.cells.map(c=>`[${c[0]},${c[1]}]`).join(",") + `]}`).join(",\n");
  const gates = l.gates.map(g =>
    `{color:"${g.color}",side:"${g.side}",index:${g.index},span:${g.span}}`).join(",");
  return `    {
      name:${JSON.stringify(name)}, par:${l.par},
      rows:${l.rows}, cols:${l.cols},
      walls:${walls},
      blocks:[
${blocks}
      ],
      gates:[${gates}],
      hint:${JSON.stringify(hint)}
    }`;
};

const body = "  const LEVELS = [\n" + finalLevels.map(fmt).join(",\n") + "\n  ];";

const htmlFile = process.argv[2];
const html = fs.readFileSync(htmlFile, "utf8");
const start = html.indexOf("  const LEVELS = [");
const end = html.indexOf("\n  ];", start) + "\n  ];".length;
if(start < 0 || end < start) throw new Error("LEVELS block not found");
fs.writeFileSync(htmlFile, html.slice(0, start) + body + html.slice(end));

console.error("wrote " + finalLevels.length + " levels: " + finalLevels.map(l=>l.par).join(", "));
