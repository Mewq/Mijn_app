"use strict";
/* Kiest levels op eigenschappen die niet uit de par blijken: hoe weinig er
   meteen naar buiten kan, hoeveel blokken pas laat uitgangsklaar staan, en hoe
   lang de oplossing is. Hangt er daarna sloten en bommen aan.

   Gesloten poorten zijn hier het stuurmiddel: zolang een poort dicht is kan
   geen enkel blok van die kleur eruit, dus dat drukt "meteen eruit" direct.
   Bommen met weinig marge maken het bijna dwingend: je hebt een paar zetten
   speling en daarna is het mis.

   node pickhard.js ../../kleurjam.html aantal pool1.json pool2.json ...       */

const fs = require("fs");
const S = require("./solver");
const D = require("./decorate");
const A = require("./analyse");

const file = process.argv[2];
const AANTAL = +(process.argv[3] || 5);
const MINPAR = +(process.env.MINPAR || 60);

const html = fs.readFileSync(file, "utf8");
const start = html.indexOf("  const LEVELS = [");
const end = html.indexOf("\n  ];", start) + "\n  ];".length;
const LEVELS = eval(html.slice(html.indexOf("[", start), html.indexOf("\n  ];", start) + 4));

/* levels die al in het spel zitten niet opnieuw pakken */
const inGebruik = new Set(LEVELS.map(l =>
  JSON.stringify(l.blocks.map(b => [b.row, b.col, b.color]))));

const pool = [];
for(const f of process.argv.slice(4)){
  try {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    for(const l of (Array.isArray(d) ? d : [d])){
      if(!l || !l.blocks || l.par < MINPAR) continue;
      if(inGebruik.has(JSON.stringify(l.blocks.map(b => [b.row, b.col, b.color])))) continue;
      pool.push(l);
    }
  } catch(e){}
}
pool.sort((a,b) => b.par - a.par);
console.log(`${pool.length} kandidaten met par >= ${MINPAR}`);

const NIEUW = [
  {naam:"Kruitdamp",   hint:"Drie tellers tegelijk. Zonder plan haal je er geen één.",
   m:["lock","bomb","bomb","bomb"]},
  {naam:"Lont",        hint:"De poorten gaan pas open als er ruimte is — en dan tikt het al.",
   m:["lock","lock","bomb","bomb","bomb"]},
  {naam:"Doodlopend",  hint:"Eén verkeerde zet en het blok komt er niet meer uit.",
   m:["lock","lock","bomb","bomb"]},
  {naam:"Ontsteking",  hint:"Bijna niets kan meteen weg. Ruim eerst, tel dan af.",
   m:["lock","bomb","bomb","bomb","bomb"]},
  {naam:"Nulmarge",    hint:"Alles moet in de goede volgorde. Er is nauwelijks speling.",
   m:["lock","lock","bomb","bomb","bomb"]}
];

const gekozen = [];
const routes = {};        // naam -> geverifieerde zettenreeks
const gehad = new Set();

for(let n = 0; n < AANTAL; n++){
  let beste = null;
  for(let i = 0; i < pool.length && !beste; i++){
    if(gehad.has(i)) continue;
    const lvl = JSON.parse(JSON.stringify(pool[i]));
    let pad = null;
    for(const cfg of [{tries:2, cap:70000, weight:2.0}, {tries:2, cap:120000, weight:1.7}]){
      const p = S.solve(lvl, Object.assign({maxMoves:1400}, cfg));
      if(p && S.verify(lvl, p).ok){ pad = p; break; }
    }
    if(!pad) { gehad.add(i); continue; }
    gehad.add(i);
    lvl.par = pad.length;
    beste = {lvl, pad, idx:i};
  }
  if(!beste){ console.log(`nieuw level ${n+1}: geen kandidaat meer`); break; }

  const spec = NIEUW[n] || NIEUW[NIEUW.length-1];
  const res = D.decorate(beste.lvl, beste.pad, spec.m, S.mulberry(7000 + n*257), {
    lock: {min: 2},
    bomb: {type: "moves", slack: +(process.env.BOMBSLACK || 3)}
  });
  let level = res.level;

  let controle = S.verify(level, beste.pad);
  if(!controle.ok){
    console.log(`  ${spec.naam}: mechanics maken de route ongeldig (${controle.reason}) — overgeslagen`);
    n--;
    continue;
  }

  level.name = spec.naam;
  level.hint = spec.hint;
  level.starMargin = 0.25;

  const stat = A.analyse(level, beste.pad, {traps:true, sample:10});
  routes[level.name] = beste.pad.map(m => ({b:m.b, axis:m.axis, d:m.d, to:m.to, exit:!!m.exit, drag:!!m.drag, gate:m.gate}));
  gekozen.push(level);
  console.log(`+ ${spec.naam.padEnd(12)} par=${String(level.par).padStart(3)} blokken=${level.blocks.length}` +
    ` | meteen eruit: ${stat.klaar0} | traag: ${stat.traag}/${stat.kleurblokken} (${Math.round(stat.traagDeel*100)}%)` +
    ` | vallen: ${stat.vallen}/${stat.onderzocht}\n    ${res.applied.join(", ")}`);
}

const alles = LEVELS.concat(gekozen).sort((a,b) => a.par - b.par);

const mechVan = l => {
  const d = [];
  if(l.timeLimit) d.push("klok");
  if(l.blocks.some(b=>b.bomb)) d.push("bom");
  if(l.gates.some(g=>g.locked)) d.push("slot");
  if(l.gates.some(g=>g.keyLocked)) d.push("sleutel");
  if(l.blocks.some(b=>b.frozen)) d.push("bevroren");
  if(l.blocks.some(b=>b.colors)) d.push("2-kleur");
  if(l.ice && l.ice.length) d.push("ijs");
  if(l.arrows && l.arrows.length) d.push("pijlen");
  return d;
};
const solo = {}, combi = {};
alles.forEach((l,k) => {
  const m = mechVan(l);
  if(m.length === 1 && solo[m[0]] === undefined) solo[m[0]] = k+1;
  if(m.length > 1) m.forEach(x => { if(combi[x] === undefined) combi[x] = k+1; });
});
let klopt = true;
for(const k of Object.keys(combi)){
  if(!(solo[k] && solo[k] < combi[k])){
    console.log(`LET OP: ${k} gecombineerd op ${combi[k]}, solo op ${solo[k] || "-"}`);
    klopt = false;
  }
}
if(klopt) console.log("leerplan klopt");

const fmt = l => {
  const walls = "[" + l.walls.map(w=>`[${w[0]},${w[1]}]`).join(",") + "]";
  const blocks = l.blocks.map((b,n) => {
    let s = `        {id:"b${n}",color:"${b.color}",move:"${b.move}",row:${b.row},col:${b.col},cells:[`
          + b.cells.map(c=>`[${c[0]},${c[1]}]`).join(",") + "]";
    if(b.colors) s += ",colors:" + JSON.stringify(b.colors);
    if(b.bonusColor) s += `,bonusColor:"${b.bonusColor}"`;
    if(b.bomb) s += `,bomb:{type:"${b.bomb.type}",value:${b.bomb.value}}`;
    if(b.frozen) s += `,frozen:{thawAfter:${b.frozen.thawAfter}}`;
    if(b.key) s += ",key:true";
    return s + "}";
  }).join(",\n");
  const gates = l.gates.map(g => {
    let s = `{color:"${g.color}",side:"${g.side}",index:${g.index},span:${g.span}`;
    if(g.locked) s += `,locked:{openAfter:${g.locked.openAfter}}`;
    if(g.keyLocked) s += ",keyLocked:true";
    return s + "}";
  }).join(",");
  const extra = [];
  if(l.ice && l.ice.length) extra.push("      ice:[" + l.ice.map(t=>`[${t[0]},${t[1]}]`).join(",") + "],");
  if(l.arrows && l.arrows.length) extra.push("      arrows:[" + l.arrows.map(a=>`[${a[0]},${a[1]},"${a[2]}"]`).join(",") + "],");
  if(l.timeLimit) extra.push("      timeLimit:" + l.timeLimit + ",");
  return "    {\n      name:" + JSON.stringify(l.name) + ", par:" + l.par +
    ", starMargin:" + (l.starMargin === undefined ? 0.25 : l.starMargin) +
    ",\n      rows:" + l.rows + ", cols:" + l.cols + ",\n      walls:" + walls + ",\n" +
    extra.join("\n") + (extra.length ? "\n" : "") +
    "      blocks:[\n" + blocks + "\n      ],\n      gates:[" + gates + "],\n      hint:" +
    JSON.stringify(l.hint) + "\n    }";
};

fs.writeFileSync(file, html.slice(0, start) + "  const LEVELS = [\n" + alles.map(fmt).join(",\n") + "\n  ];" + html.slice(end));

/* De route waarmee elk level gebouwd is, wordt bewaard als bewijs. Bij zulke
   strakke bommen vindt een nieuwe zoektocht zelden een route die alles haalt,
   terwijl deze route dat aantoonbaar wel doet — playsolve.js speelt hem na. */
const solFile = __dirname + "/solutions.json";
let bestaand = {};
try { bestaand = JSON.parse(fs.readFileSync(solFile, "utf8")); } catch(e){}
Object.assign(bestaand, routes);
fs.writeFileSync(solFile, JSON.stringify(bestaand));
console.log(`routes bewaard voor: ${Object.keys(routes).join(", ")}`);
console.log(`\n${alles.length} levels | pars: ${alles.map(l=>l.par).join(" ")}`);
