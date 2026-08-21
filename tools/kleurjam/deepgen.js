"use strict";
/* Genereert levels waar in het begin niets naar buiten kan.

   De eis: geen enkel blok mag binnen N zetten het bord af kunnen. Dat is een
   eigenschap van de beginstand, niet van de oplossing, dus het is het eerste
   waar een kandidaat op afvalt — en dat is meteen de goedkoopste zeef, want de
   meeste borden hebben al bij zet 1 een uitgang klaarliggen.

   Waarom het achterstevoren bouwen dit kan: een blok schuift via zijn poort naar
   binnen en wordt daarna dieper het bord in geduwd. Eindigt die reeks met genoeg
   duwzetten ná de laatste insteek, dan ligt er in de beginstand niets meer voor
   het grijpen. Precies dat wordt hier afgedwongen en daarna nagemeten.

   node deepgen.js <eersteSeed> <laatsteSeed> <uit.json> [minEersteUitgang] [minPar] */

const fs = require("fs");
const G = require("./gen");
const S = require("./solver");
const A = require("./analyse");

const FROM = +process.argv[2], TO = +process.argv[3];
const OUT = process.argv[4];
const MINFIRST = +(process.argv[5] || 9);
const MINPAR = +(process.argv[6] || 60);

/* Samenstelling is hier de knop die telt: in een baan van twaalf vakjes passen
   maar een handvol grote blokken, en juist het aantal losse blokkeerders bepaalt
   hoe ver de eerste uitgang weg ligt. Vandaar de mogelijkheid om via de omgeving
   met kleine stukken te werken. */
const BASIS = {
  rows:12, cols:12, minColored:10,
  colored:34, stones:4, colors:5,
  pushDeep:6, slides:3, insertDepth:2,
  wallClusters:3, restricted:.3,
  awayBias:.95,                 // blokken zo ver mogelijk van hun eigen poort
  finalSlides:60,               // en daarna nog flink doorschudden
  spanSlack:0,                  // krappe poorten: uitlijnen kost een extra zet
  shapes:(process.env.SHAPES || "I2,I3,L3,O,T4,S4,Z4,L4,J4,P5,O6").split(","),
  stoneShapes:(process.env.STONESHAPES || "I2,L3,O,T4").split(","),
  addShapes:["I2","I3","L3","O","T4","S4","Z4","L4","J4"]
};
if(process.env.COLORED) BASIS.colored = +process.env.COLORED;
if(process.env.COLORS)  BASIS.colors  = +process.env.COLORS;
if(process.env.STONES)  BASIS.stones  = +process.env.STONES;
if(process.env.MASK)    BASIS.mask    = process.env.MASK;       // muurpatroon uit masks.js
if(process.env.WALLCLUSTERS) BASIS.wallClusters = +process.env.WALLCLUSTERS;

const RUW = process.env.RUWUIT || null;        // bewaar ook de afvallers
const RUWMIN = +(process.env.RUWMIN || 1);
const resultaten = [], ruw = [];
let bekeken = 0, snelWeg = 0;

for(let seed = FROM; seed <= TO; seed++){
  let lvl = null;
  try { lvl = G.generate(seed, BASIS); } catch(e){ lvl = null; }
  if(!lvl) continue;
  bekeken++;

  // eerst de goedkope zeef: hoe snel kan er iets naar buiten?
  const eerste = A.firstExit(lvl, {cap: 60000});
  if(eerste !== null && eerste < MINFIRST){
    snelWeg++;
    if(RUW && eerste >= RUWMIN) ruw.push(lvl);   // grondstof voor deepen.js
    continue;
  }

  // pas nu de dure controle: is het überhaupt uit te spelen?
  let pad = null;
  for(const cfg of [{tries:2, cap:70000, weight:2.0}, {tries:2, cap:120000, weight:1.7}]){
    const p = S.solve(lvl, Object.assign({maxMoves:1400}, cfg));
    if(p && S.verify(lvl, p).ok){ pad = p; break; }
  }
  if(!pad) continue;
  if(pad.length < MINPAR) continue;

  lvl.par = pad.length;
  lvl.seed = seed;
  lvl.eersteUitgang = eerste;
  resultaten.push(lvl);
  console.log(`seed ${seed}: eerste uitgang ${eerste === null ? ">budget" : "na " + eerste} zetten, ` +
    `par ${pad.length}, ${lvl.blocks.length} blokken`);
  if(OUT) fs.writeFileSync(OUT, JSON.stringify(resultaten));
}
if(RUW) fs.writeFileSync(RUW, JSON.stringify(ruw));
console.log(`\n${bekeken} borden bekeken, ${snelWeg} vielen af omdat er te snel iets weg kon, ${resultaten.length} bruikbaar`);
