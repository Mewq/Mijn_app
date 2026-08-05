"use strict";
/* Voegt levels uit een pool toe aan de ladder in kleurjam.html.

   Elk nieuw level wordt opnieuw opgelost, versierd met mechanics die op zijn
   plek in de ladder al ingevoerd zijn, en daarna gecontroleerd. De ladder blijft
   op zwaarte gesorteerd.

   node addlevels.js ../../kleurjam.html aantal pool1.json pool2.json ...       */

const fs = require("fs");
const S = require("./solver");
const D = require("./decorate");

const file = process.argv[2];
const AANTAL = +(process.argv[3] || 5);
// ondergrens op het aantal muren: daar gaat het bij deze lichting juist om
const MINMUREN = +(process.env.MINWALLS || 0);

const html = fs.readFileSync(file, "utf8");
const start = html.indexOf("  const LEVELS = [");
const end = html.indexOf("\n  ];", start) + "\n  ];".length;
const LEVELS = eval(html.slice(html.indexOf("[", start), html.indexOf("\n  ];", start) + 4));

const pool = [];
for(const f of process.argv.slice(4)){
  try {
    const d = JSON.parse(fs.readFileSync(f, "utf8"));
    for(const l of (Array.isArray(d) ? d : [d])){
      if(!l || !l.blocks) continue;
      if(l.fxMatters === false) continue;           // tegels die niets doen
      if(l.walls.length < MINMUREN) continue;
      pool.push(l);
    }
  } catch(e){}
}
if(!pool.length) throw new Error("lege pool");

/* Namen en mechanics voor de nieuwe levels. Alleen mechanics die vroeg in de
   ladder ingevoerd worden, zodat ze hoe dan ook al bekend zijn. */
const NIEUW = [
  {naam:"Gangenstelsel", hint:"Muren maken er een doolhof van. Kies je route voor je sleept.", m:["lock"]},
  {naam:"Nauwe doorgang", hint:"Grote vormen passen maar net door de kier — stuur de kleine er eerst uit.", m:["bomb"]},
  {naam:"Twee kamers",    hint:"Alles moet door dezelfde deuropening.", m:["timer"]},
  {naam:"Binnenhof",      hint:"Wat in de kamer ligt, moet er eerst uit.", m:["frozen"]},
  {naam:"Doolhof",        hint:"Elke omweg kost zetten. Zoek de kortste.", m:["timer","bomb"]}
];

/* een spreiding over de pool, gemeten naar muren en zwaarte */
pool.sort((a,b) => b.walls.length - a.walls.length);
const kandidaten = pool.slice(0, Math.max(AANTAL * 6, 30)).sort((a,b) => a.par - b.par);

const gekozen = [];
const gebruikt = new Set();
for(let n = 0; n < AANTAL && kandidaten.length; n++){
  // gelijkmatig verdeeld over de zwaarte van de kandidaten
  const wens = Math.floor(n * (kandidaten.length - 1) / Math.max(1, AANTAL - 1));
  let genomen = null;
  for(let d = 0; d < kandidaten.length && !genomen; d++){
    for(const i of [wens - d, wens + d]){
      if(i < 0 || i >= kandidaten.length || gebruikt.has(i)) continue;
      const lvl = JSON.parse(JSON.stringify(kandidaten[i]));
      let pad = null;
      for(const cfg of [{tries:2, cap:70000, weight:2.0}, {tries:2, cap:120000, weight:1.7}]){
        const p = S.solve(lvl, Object.assign({maxMoves:1400}, cfg));
        if(p && S.verify(lvl, p).ok){ pad = p; break; }
      }
      if(!pad) continue;
      gebruikt.add(i);
      lvl.par = pad.length;
      genomen = {lvl, pad};
      break;
    }
  }
  if(!genomen){ console.log(`nieuw level ${n+1}: geen bruikbare kandidaat`); continue; }

  const spec = NIEUW[n] || {naam:"Doolhof " + (n+1), hint:"", m:["lock"]};
  const res = D.decorate(genomen.lvl, genomen.pad, spec.m, S.mulberry(5000 + n*131), {
    timer: {secondsPerMove: 3.4, slack: 30},
    bomb:  {type: "moves", slack: 6},
    lock:  {min: 2},
    frozen:{min: 2}
  });
  let level = res.level;
  let controle = S.verify(level, genomen.pad);
  if(!controle.ok){
    const opnieuw = S.solve(level, {tries:2, cap:90000, weight:2.0, maxMoves:1400});
    if(opnieuw && S.verify(level, opnieuw).ok){ level.par = Math.min(level.par, opnieuw.length); controle = {ok:true}; }
  }
  if(!controle.ok){ console.log(`nieuw level ${n+1}: mechanics maken het onspeelbaar — overgeslagen`); continue; }

  level.name = spec.naam;
  level.hint = spec.hint;
  level.starMargin = 0.25;
  gekozen.push(level);
  console.log(`+ ${spec.naam.padEnd(16)} par=${String(level.par).padStart(3)} blokken=${level.blocks.length} muren=${level.walls.length}  ${res.applied.join(", ")}`);
}

const alles = LEVELS.concat(gekozen).sort((a,b) => a.par - b.par);

/* controleer dat elke mechanic nog steeds eerst alleen voorkomt */
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
    console.log(`LET OP: ${k} wordt op ${combi[k]} gecombineerd maar staat solo op ${solo[k] || "-"}`);
    klopt = false;
  }
}
console.log(klopt ? "leerplan klopt: elke mechanic staat solo voor hij gecombineerd wordt" : "");

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
console.log(`\n${alles.length} levels | pars: ${alles.map(l=>l.par).join(" ")}`);
