"use strict";
/* Verdeelt de mechanics over de ladder in kleurjam.html.

   Leerplan: elke mechanic krijgt eerst een eigen rustig level waar hij de enige
   nieuwe regel is. Pas daarna wordt hij met andere gecombineerd. IJs en pijlen
   komen uit genfx.js-pools, want die veranderen hoe blokken bewegen en kunnen
   dus niet achteraf op een bestaand level geplakt worden.

   node mechanics.js ../../kleurjam.html ice.json arrows.json                  */

const fs = require("fs");
const S = require("./solver");
const E = require("./engine");
const D = require("./decorate");

const htmlFile = process.argv[2];
const icePool   = process.argv[3] ? JSON.parse(fs.readFileSync(process.argv[3], "utf8")) : [];
const arrowPool = process.argv[4] ? JSON.parse(fs.readFileSync(process.argv[4], "utf8")) : [];

const html = fs.readFileSync(htmlFile, "utf8");
const start = html.indexOf("  const LEVELS = [");
const end = html.indexOf("\n  ];", start) + "\n  ];".length;
const LEVELS = eval(html.slice(html.indexOf("[", start), html.indexOf("\n  ];", start) + 4));

/* Per level: welke mechanics, en welke tekst hoort erbij.
   `fx` betekent: vervang dit level door één uit de ijs- of pijlpool. */
const PLAN = [
  {},                                                            //  1  par 6
  {},                                                            //  2  par 9
  {},                                                            //  3  par 12
  {m:["timer"],   name:"Tegen de klok",       hint:"De klok start pas bij je eerste zet — kijk eerst rustig rond."},
  {m:["lock"],    name:"Gesloten poort",      hint:"Een poort met een cijfer gaat pas open als er genoeg blokken weg zijn."},
  {m:["frozen"],  name:"Bevroren",            hint:"Een blok in het ijs kun je niet verschuiven. Ruim eerst anderen op."},
  {m:["bomb"],    name:"Aftellen",            hint:"Het blok met de teller moet eruit voor die op nul staat."},
  {m:["twocolor"],name:"Twee kleuren",        hint:"Een half-half blok mag door beide poorten. De eigen kleur geeft een bonus."},
  {fx:"arrows",   name:"Eenrichtingsverkeer", hint:"Over een pijltegel mag je alleen mee met de pijl."},
  {fx:"ice",      name:"Glad",                hint:"Op ijs glijdt een blok door tot het ergens tegenaan komt."},
  {m:["key"],     name:"Sleutel",             hint:"Het blok met de sleutel opent de poorten met een slot."},
  {fx:"arrows", m:["bomb"], name:"Rondweg",   hint:"Tegen de pijl in kan niet — en de teller loopt door."},
  {fx:"ice", m:["timer"],   name:"Schaatsbaan", hint:"Reken uit waar een blok stopt voor je het loslaat."},
  {m:["timer","bomb"],       name:"Haastwerk",     hint:"Een klok én een bom. Bepaal eerst de volgorde, dan pas slepen."},
  {m:["lock","frozen"],      name:"Dubbel dicht",  hint:"De poort en het blok wachten op hetzelfde: blokken die weg moeten."},
  {m:["twocolor","lock"],    name:"Omleiding",     hint:"Zit de ene poort dicht, dan is de andere kleur je uitweg."},
  {m:["key","timer"],        name:"Sleutelwerk",   hint:"De sleutel eerst, anders sta je stil terwijl de klok loopt."},
  {m:["bomb","lock"],        name:"Onder druk",    hint:"De bom tikt terwijl de poort nog dicht zit."},
  {m:["frozen","twocolor"],  name:"Ontdooien",     hint:"Elk blok dat vertrekt brengt het bevroren blok dichter bij vrij."},
  {m:["timer","lock"],       name:"Sluiswerk",     hint:"Open de poort ruim voordat de klok krap wordt."},
  {m:["bomb","frozen"],      name:"Kruitvat",      hint:"Ruim eerst op wat de bom in de weg staat."},
  {m:["key","lock"],         name:"Twee sloten",   hint:"Twee soorten sloten door elkaar: een teller en een sleutel."},
  {m:["timer","twocolor"],   name:"Kleurenrace",   hint:"De kortste route is niet altijd je eigen kleur."},
  {m:["bomb","key"],         name:"Tijdslot",      hint:"De sleutel moet eruit voor de bom afgaat."},
  {m:["timer","frozen"],     name:"Vorst",         hint:"Bevroren blokken kosten tijd die je niet hebt."},
  {m:["lock","twocolor","bomb"], name:"Knelpunt",  hint:"Drie regels tegelijk. Werk van buiten naar binnen."},
  {m:["timer","bomb","lock"],    name:"Vuurwerk",  hint:"Alles tikt. Kies je eerste zet met zorg."},
  {m:["key","frozen","timer"],   name:"Diepvries", hint:"De sleutel ligt achter het ijs."},
  {m:["bomb","lock","twocolor"], name:"Eindsprint",hint:"Bijna alles zit vast. Bijna."},
  {m:["timer","bomb","key","lock"], name:"De Kleurjam", hint:"Alles wat je geleerd hebt, in één bord. Veel succes."}
];

/* --- ijs- en pijllevels kiezen ------------------------------------------- */

const usedFx = new Set();
function pickFx(pool, targetPar){
  const order = pool.map((l,i)=>i)
    .filter(i => !usedFx.has(pool[i]) && pool[i].fxMatters)
    .sort((a,b) => Math.abs(pool[a].par - targetPar) - Math.abs(pool[b].par - targetPar));
  for(const i of order){
    const lvl = pool[i];
    const path = S.solve(lvl, {tries:3, cap:70000, weight:2.0, maxMoves:600});
    if(!path || !S.verify(lvl, path).ok) continue;
    usedFx.add(lvl);
    lvl.par = Math.min(lvl.par || path.length, path.length);
    return {level: lvl, path};
  }
  return null;
}

/* --- toepassen ------------------------------------------------------------ */

const out = [];
const report = [];
LEVELS.forEach((lvl, i) => {
  const plan = PLAN[i] || {};
  let level = JSON.parse(JSON.stringify(lvl));
  let path = null;
  let notes = [];

  if(plan.fx){
    const pool = plan.fx === "ice" ? icePool : arrowPool;
    const got = pickFx(pool, lvl.par);
    if(got){
      const keep = {name: plan.name || lvl.name, hint: plan.hint || lvl.hint};
      level = got.level;
      level.name = keep.name;
      level.hint = keep.hint;
      path = got.path;
      notes.push(plan.fx === "ice" ? "ijstegels" : "pijltegels");
    } else {
      report.push(`level ${i+1}: geen bruikbaar ${plan.fx}-level in de pool — origineel behouden`);
    }
  }

  if(!path){
    for(const cfg of [{tries:2, cap:70000, weight:2.0}, {tries:2, cap:130000, weight:1.7}]){
      const p2 = S.solve(level, Object.assign({maxMoves:1400}, cfg));
      if(p2 && S.verify(level, p2).ok){ path = p2; break; }
    }
    if(!path){
      report.push(`level ${i+1}: niet opnieuw op te lossen — ongewijzigd gelaten`);
      out.push(lvl);
      return;
    }
  }
  level.par = Math.min(level.par, path.length);

  if(plan.m && plan.m.length){
    const rnd = S.mulberry(1000 + i*37);
    const res = D.decorate(level, path, plan.m, rnd, {
      timer: {secondsPerMove: 3.4, slack: 30},
      bomb:  {type: (i % 5 === 1 ? "seconds" : "moves"), slack: 5},
      lock:  {min: 2},
      frozen:{min: 2},
      key:   {gates: 1}
    });
    level = res.level;
    notes = notes.concat(res.applied);
  }
  if(plan.name) level.name = plan.name;
  if(plan.hint) level.hint = plan.hint;
  level.starMargin = 0.25;

  // controleren dat het level mét mechanics nog steeds uit te spelen is
  let check = S.verify(level, path);
  if(!check.ok){
    // een tweede kleur kan een kortere uitweg openen; zoek dan opnieuw
    const again = S.solve(level, {tries:2, cap:90000, weight:2.0, maxMoves:1400});
    if(again && S.verify(level, again).ok){
      path = again;
      level.par = Math.min(level.par, again.length);
      check = {ok:true};
    }
  }
  if(!check.ok){
    report.push(`level ${i+1}: mechanics maken de oplossing ongeldig (${check.reason}) — teruggedraaid`);
    out.push(lvl);
    return;
  }
  out.push(level);
  report.push(`level ${String(i+1).padStart(2)} ${(level.name||"").padEnd(20)} par=${String(level.par).padStart(3)}  ${notes.join(", ") || "—"}`);
});

/* --- terugschrijven ------------------------------------------------------- */

const fmt = l => {
  const walls = "[" + l.walls.map(w=>`[${w[0]},${w[1]}]`).join(",") + "]";
  const blocks = l.blocks.map((b,n) => {
    let s = `        {id:"b${n}",color:"${b.color}",move:"${b.move}",row:${b.row},col:${b.col},cells:[`
          + b.cells.map(c=>`[${c[0]},${c[1]}]`).join(",") + `]`;
    if(b.colors) s += `,colors:${JSON.stringify(b.colors)}`;
    if(b.bonusColor) s += `,bonusColor:"${b.bonusColor}"`;
    if(b.bomb) s += `,bomb:{type:"${b.bomb.type}",value:${b.bomb.value}}`;
    if(b.frozen) s += `,frozen:{thawAfter:${b.frozen.thawAfter}}`;
    if(b.key) s += `,key:true`;
    return s + "}";
  }).join(",\n");
  const gates = l.gates.map(g => {
    let s = `{color:"${g.color}",side:"${g.side}",index:${g.index},span:${g.span}`;
    if(g.locked) s += `,locked:{openAfter:${g.locked.openAfter}}`;
    if(g.keyLocked) s += `,keyLocked:true`;
    return s + "}";
  }).join(",");
  const extra = [];
  if(l.ice && l.ice.length) extra.push(`      ice:[` + l.ice.map(t=>`[${t[0]},${t[1]}]`).join(",") + `],`);
  if(l.arrows && l.arrows.length) extra.push(`      arrows:[` + l.arrows.map(a=>`[${a[0]},${a[1]},"${a[2]}"]`).join(",") + `],`);
  if(l.timeLimit) extra.push(`      timeLimit:${l.timeLimit},`);
  return `    {
      name:${JSON.stringify(l.name)}, par:${l.par}, starMargin:${l.starMargin === undefined ? 0.25 : l.starMargin},
      rows:${l.rows}, cols:${l.cols},
      walls:${walls},
${extra.join("\n")}${extra.length ? "\n" : ""}      blocks:[
${blocks}
      ],
      gates:[${gates}],
      hint:${JSON.stringify(l.hint)}
    }`;
};

const body = "  const LEVELS = [\n" + out.map(fmt).join(",\n") + "\n  ];";
fs.writeFileSync(htmlFile, html.slice(0, start) + body + html.slice(end));
report.forEach(r => console.log(r));
console.log("\n" + out.length + " levels weggeschreven");
