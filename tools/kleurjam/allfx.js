"use strict";
/* Zware levels met álle mechanics tegelijk.

   IJs en pijlen moeten bij het genereren mee (ze veranderen hoe blokken
   bewegen), de rest wordt achteraf uit de geverifieerde oplossing afgeleid
   zoals in decorate.js. Vandaar deze volgorde: bord bouwen, tegels leggen,
   oplossen, en pas op die oplossing de klok, bommen, sloten, sleutel, vorst en
   tweekleurige blokken hangen. Klopt de oplossing daarna nog, dan is het level
   aantoonbaar uit te spelen mét alle mechanics erin.

   Tegels zijn hier ook de knop voor lengte: een pijlbaan dwingt omwegen, dus de
   route wordt langer dan de vuistregel van ~2,2 zetten per blok voorspelt. Op
   een 12x12-bord past nu eenmaal maar een beperkt aantal blokken.

   node allfx.js <eersteSeed> <laatsteSeed> <uit.json> [minPar]                */

const fs = require("fs");
const G = require("./gen"), S = require("./solver"), E = require("./engine"), D = require("./decorate");
const DENS = require("./densify"), H = require("./harden");

const FROM = +process.argv[2], TO = +process.argv[3];
const OUT = process.argv[4];
const MINPAR = +(process.argv[5] || 150);
const ADDS = +(process.env.ADDS || 70);
const HARD = +(process.env.HARDEN || 40);

/* Zoals de zware presets in pipeline.js: veel kleine stukken, want juist het
   aantal losse blokkeerders bepaalt de lengte van de route. */
const BASIS = {
  rows:12, cols:12, minColored:10,
  colored:+(process.env.COLORED || 64), stones:+(process.env.STONES || 2),
  colors:+(process.env.COLORS || 6),
  pushDeep:4, slides:1, insertDepth:2,
  wallClusters:+(process.env.WALLCLUSTERS || 2), restricted:.28,
  awayBias:.9, finalSlides:4, spanSlack:1, stoneRatio:.18,
  shapes:(process.env.SHAPES || "D1,D1,I2,I2,I3,L3,O,S4,T4,L4").split(","),
  stoneShapes:(process.env.STONESHAPES || "D1,I2,L3").split(","),
  addShapes:["D1","I2","I3","L3","O","S4","T4","L4","J4","Z4"]
};

const SNEL    = {tries:1, cap:12000, weight:3.2, maxMoves:1600};
const ZORGVULDIG = {tries:2, cap:60000, weight:2.1, maxMoves:1600};

/* een aaneengesloten plek ijs, geen losse spikkels */
function icePatch(rnd, ROWS, COLS, blocked){
  const cells = [];
  const horiz = rnd() < .5;
  const len = 4 + ((rnd()*4)|0), thick = 1 + ((rnd()*2)|0);
  const r0 = 1 + ((rnd()*(ROWS-2-(horiz?thick:len)))|0);
  const c0 = 1 + ((rnd()*(COLS-2-(horiz?len:thick)))|0);
  for(let a=0;a<(horiz?thick:len);a++) for(let b=0;b<(horiz?len:thick);b++){
    const r = r0+a, c = c0+b;
    if(r<1 || c<1 || r>=ROWS-1 || c>=COLS-1) continue;
    if(blocked.has(r+","+c)) continue;
    cells.push([r,c]);
  }
  return cells;
}

/* pijlen die dezelfde kant op wijzen, op één rij of kolom: leesbaar */
function arrowRun(rnd, ROWS, COLS, blocked, bezet){
  const horiz = rnd() < .5;
  const dir = horiz ? (rnd() < .5 ? "left" : "right") : (rnd() < .5 ? "top" : "bottom");
  const len = 2 + ((rnd()*3)|0);
  const out = [];
  if(horiz){
    const r = 1 + ((rnd()*(ROWS-2))|0), c0 = 1 + ((rnd()*(COLS-1-len))|0);
    for(let k=0;k<len;k++){ const key = r+","+(c0+k);
      if(!blocked.has(key) && !bezet.has(key)) out.push([r, c0+k, dir]); }
  } else {
    const c = 1 + ((rnd()*(COLS-2))|0), r0 = 1 + ((rnd()*(ROWS-1-len))|0);
    for(let k=0;k<len;k++){ const key = (r0+k)+","+c;
      if(!blocked.has(key) && !bezet.has(key)) out.push([r0+k, c, dir]); }
  }
  return out;
}

/* glijdt er ergens in deze oplossing een blok verder dan gesleept? */
function heeftGlij(lvl, path){
  const L = E.makeLevel(lvl);
  let st = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  for(const mv of path){
    if(!mv.exit){
      const from = st.pos[mv.b];
      const r = (from / L.COLS)|0, c = from % L.COLS;
      const dr = mv.axis === "V" ? r + mv.d : r, dc = mv.axis === "H" ? c + mv.d : c;
      if(mv.to !== dr*L.COLS + dc) return true;
    }
    st = E.applyMove(L, st, mv);
  }
  return false;
}

/* komt er in deze oplossing een blok over een pijltegel? */
function raaktPijlen(lvl, path){
  const L = E.makeLevel(lvl);
  const gemerkt = new Set((lvl.arrows||[]).map(a => a[0]*L.COLS + a[1]));
  let st = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  for(const mv of path){
    if(!mv.exit && mv.to >= 0){
      const b = L.blocks[mv.b];
      const r = (mv.to / L.COLS)|0, c = mv.to % L.COLS;
      for(const rc of b.cells) if(gemerkt.has((r+rc[0])*L.COLS + (c+rc[1]))) return true;
    }
    st = E.applyMove(L, st, mv);
  }
  return false;
}

const resultaten = [];
for(let seed = FROM; seed <= TO; seed++){
  const t0 = Date.now();
  const rnd = S.mulberry(seed * 7919 + 13);
  let lvl = null;
  try { lvl = G.generate(seed, BASIS); } catch(e){ lvl = null; }
  if(!lvl) continue;

  const muren = new Set(lvl.walls.map(w => w[0]+","+w[1]));
  const bezet = new Set();
  lvl.blocks.forEach(b => b.cells.forEach(c => bezet.add((b.row+c[0])+","+(b.col+c[1]))));

  /* Tegels gaan er nu al in, vóór het verdichten. Densify en harden lossen elke
     tussenstand opnieuw op, dus alles wat daarna volgt houdt rekening met het
     ijs en de pijlen — plakken we ze er achteraf op, dan is de kans groot dat
     het level onoplosbaar wordt. */
  lvl.ice = icePatch(rnd, lvl.rows, lvl.cols, muren);
  lvl.arrows = [];
  for(let k=0;k<3;k++){
    const run = arrowRun(rnd, lvl.rows, lvl.cols, muren, bezet);
    for(const a of run) if(!lvl.arrows.some(x => x[0]===a[0] && x[1]===a[1])
      && !lvl.ice.some(t => t[0]===a[0] && t[1]===a[1])) lvl.arrows.push(a);
  }
  if(lvl.ice.length < 3 || lvl.arrows.length < 2) continue;

  let p = S.solve(lvl, SNEL);
  if(!p){ console.log(`seed ${seed}: basis niet oplosbaar met tegels`); continue; }

  let cur = {level: lvl, len: p.length};
  const d = DENS.densify(cur.level, {
    rnd: S.mulberry(seed*7+1), adds: ADDS, maxFails: Math.max(12, (ADDS/3)|0), startLen: cur.len,
    cap: SNEL.cap, weight: SNEL.weight, maxMoves: SNEL.maxMoves,
    stoneRatio: BASIS.stoneRatio, addShapes: BASIS.addShapes,
    stoneShapes: BASIS.stoneShapes, restricted: BASIS.restricted
  });
  if(d) cur = d;
  const h = H.harden(cur.level, {iters: HARD, rnd: S.mulberry(seed*13+5),
    cap: SNEL.cap, weight: SNEL.weight, maxMoves: SNEL.maxMoves, kick: 3});
  if(h && h.len > cur.len) cur = h;

  lvl = cur.level;
  const pad = S.solve(lvl, ZORGVULDIG);
  if(!pad || !S.verify(lvl, pad).ok){ console.log(`seed ${seed}: eindcontrole faalt`); continue; }
  if(pad.length < MINPAR){
    console.log(`seed ${seed}: par ${pad.length} < ${MINPAR} (${lvl.blocks.length} blokken)`);
    continue;
  }
  // de tegels moeten ook echt iets doen, anders zijn het versierselen
  if(!heeftGlij(lvl, pad) && !raaktPijlen(lvl, pad)){
    console.log(`seed ${seed}: par ${pad.length} maar de route raakt geen tegel`);
    continue;
  }

  /* Nu de rest, allemaal afgeleid uit dezelfde route. Sleutel eerst: die is het
     kieskeurigst (geen bom of vorst op datzelfde blok), daarna de bommen, en de
     klok als laatste omdat die alleen de lengte nodig heeft. */
  const wens = ["key","twocolor","twocolor","frozen","frozen","bomb","bomb","bomb","bomb","lock","lock","timer"];
  const res = D.decorate(lvl, pad, wens, S.mulberry(seed*31+7), {
    timer:  {secondsPerMove: 3.4, slack: 45},
    bomb:   {type:"moves", slack: 5, frac: 0.22},
    lock:   {min: 2},
    frozen: {min: 2},
    key:    {gates: 1}
  });
  const klaar = res.level;
  if(!S.verify(klaar, pad).ok) continue;                  // mechanics breken de route

  klaar.par = pad.length;
  klaar.seed = seed;
  klaar.route = pad.map(m => ({b:m.b, axis:m.axis, d:m.d, to:m.to, exit:!!m.exit, drag:!!m.drag, gate:m.gate}));
  resultaten.push(klaar);
  console.log(`seed ${seed}: par=${pad.length} blokken=${klaar.blocks.length} ` +
    `ijs=${klaar.ice.length} pijlen=${klaar.arrows.length} ${((Date.now()-t0)/1000).toFixed(0)}s | ${res.applied.join(", ")}`);
  if(OUT) fs.writeFileSync(OUT, JSON.stringify(resultaten));
}
console.log("klaar:", resultaten.length);
