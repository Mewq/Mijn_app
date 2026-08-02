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
  ["Kettingreactie",    "Zoek het blok dat als eerste naar buiten kan."],
  ["Even terug",        "Soms moet een blok eerst de verkeerde kant op."],
  ["Vierkant probleem", "Grote vierkanten hebben veel ruimte nodig om te draaien."],
  ["Haakse bocht",      "L-vormen passen maar op één manier door de poort."],
  ["Spitsuur",          "Ruim eerst op wat je later nodig hebt."],
  ["Doorgang",          "Alles moet door hetzelfde gat."],
  ["Knooppunt",         "Twee blokken houden elkaar vast. Eentje moet wijken."],
  ["Opstopping",        "Werk van buiten naar binnen: leeg eerst de randen."],
  ["Puzzelplein",       "Bijna honderd zetten. Neem de tijd."],
  ["De grote jam",      "Ruim de poorten leeg voordat je aan het midden begint."],
  ["Vastgelopen",       "Elke vrije plek telt. Verspil er geen."],
  ["Rommelzolder",      "Veel kleine blokjes — begin bij de poort die het dichtst bij is."],
  ["Kluwen",            "Denk twee zetten vooruit voor je iets verschuift."],
  ["Meesterproef",      "Meer dan honderd zetten. Rustig ademhalen."],
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

const chosen = [];
const used = new Set();
for(const t of TARGETS){
  let best = null, bestD = Infinity;
  for(let i=0;i<all.length;i++){
    if(used.has(i)) continue;
    const d = Math.abs(all[i].par - t);
    if(d < bestD){ bestD = d; best = i; }
  }
  if(best === null) break;
  used.add(best);
  chosen.push(all[best]);
}
chosen.sort((a,b)=>a.par-b.par);

/* re-verify everything that is about to ship */
const finalLevels = [];
chosen.forEach((l, i) => {
  const path = S.solve(l, {tries:2, cap:60000, weight:2.1, maxMoves:1400});
  if(!path){ console.error(`level ${i+1} (par ${l.par}) could not be re-solved — dropped`); return; }
  const v = S.verify(l, path);
  if(!v.ok){ console.error(`level ${i+1} failed verification — dropped`); return; }
  l.par = Math.min(l.par, path.length);
  finalLevels.push(l);
});

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
