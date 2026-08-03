"use strict";
/* Levels met ijs- of pijltegels.

   Die twee mechanics veranderen hoe blokken bewegen, dus ze kunnen niet achteraf
   aan een level geplakt worden zoals in decorate.js. Aanpak: eerst een gewoon
   (dus oplosbaar) level bouwen met gen.js, daar tegels in leggen, en dan met de
   solver kijken of het nog uit te spelen is. Wat niet oplosbaar blijkt gaat weg.

   node genfx.js <ice|arrows> <eersteSeed> <laatsteSeed> <uit.json> [minPar] [maxPar] */

const fs = require("fs");
const G = require("./gen"), S = require("./solver"), E = require("./engine");

const KIND = process.argv[2] || "ice";
const FROM = +process.argv[3], TO = +process.argv[4];
const OUT  = process.argv[5];
const MINPAR = +(process.argv[6] || 8);
const MAXPAR = +(process.argv[7] || 40);

const BASE = {
  rows:12, cols:12, minColored:3, colors:4, stones:2,
  pushDeep:3, slides:2, finalSlides:6, insertDepth:3,
  wallClusters:2, restricted:.25, awayBias:.85, spanSlack:1,
  shapes:"I2,I3,L3,O,T4,S4,L4,J4".split(","), stoneShapes:["I2","L3","O"]
};

/* een aaneengesloten plek ijs: een strook of blokje, geen losse spikkels */
function icePatch(rnd, ROWS, COLS, blocked){
  const cells = [];
  const horiz = rnd() < .5;
  const len = 4 + ((rnd()*5)|0);
  const thick = 1 + ((rnd()*2)|0);
  const r0 = 1 + ((rnd()*(ROWS-2-thick))|0);
  const c0 = 1 + ((rnd()*(COLS-2-len))|0);
  for(let a=0;a<(horiz?thick:len);a++){
    for(let b=0;b<(horiz?len:thick);b++){
      const r = r0 + a, c = c0 + b;
      if(r>=ROWS-1 || c>=COLS-1 || r<1 || c<1) continue;
      if(blocked.has(r+","+c)) continue;
      cells.push([r,c]);
    }
  }
  return cells;
}

/* pijlen die dezelfde kant op wijzen, in één rij of kolom: leesbaar voor de speler */
function arrowRun(rnd, ROWS, COLS, blocked){
  const horiz = rnd() < .5;
  const dir = horiz ? (rnd() < .5 ? "left" : "right") : (rnd() < .5 ? "top" : "bottom");
  const len = 2 + ((rnd()*3)|0);
  const out = [];
  if(horiz){
    const r = 1 + ((rnd()*(ROWS-2))|0);
    const c0 = 1 + ((rnd()*(COLS-1-len))|0);
    for(let k=0;k<len;k++) if(!blocked.has(r+","+(c0+k))) out.push([r, c0+k, dir]);
  } else {
    const c = 1 + ((rnd()*(COLS-2))|0);
    const r0 = 1 + ((rnd()*(ROWS-1-len))|0);
    for(let k=0;k<len;k++) if(!blocked.has((r0+k)+","+c)) out.push([r0+k, c, dir]);
  }
  return out;
}

/* glijdt er ergens in deze oplossing een blok door? */
function pathHasSkid(lvl, path){
  const L = E.makeLevel(lvl);
  let st = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  for(const mv of path){
    if(!mv.exit){
      const from = st.pos[mv.b];
      const r = (from / L.COLS) | 0, c = from % L.COLS;
      const dragR = mv.axis === "V" ? r + mv.d : r;
      const dragC = mv.axis === "H" ? c + mv.d : c;
      if(mv.to !== dragR*L.COLS + dragC) return true;
    }
    st = E.applyMove(L, st, mv);
  }
  return false;
}

const results = [];
for(let seed = FROM; seed <= TO; seed++){
  const rnd = S.mulberry(seed * 7919 + 13);
  const colored = 3 + ((rnd()*6)|0);
  const P = Object.assign({}, BASE, {colored, colors: 2 + ((rnd()*3)|0)});
  let base = null;
  try { base = G.generate(seed, P); } catch(e){ base = null; }
  if(!base) continue;

  const blocked = new Set(base.walls.map(w => w[0]+","+w[1]));
  const lvl = JSON.parse(JSON.stringify(base));
  if(KIND === "ice"){
    lvl.ice = icePatch(rnd, lvl.rows, lvl.cols, blocked);
    if(lvl.ice.length < 3) continue;
  } else {
    lvl.arrows = arrowRun(rnd, lvl.rows, lvl.cols, blocked);
    if(lvl.arrows.length < 2) continue;
  }

  const path = S.solve(lvl, {tries:3, cap:60000, weight:2.0, maxMoves:400});
  if(!path) continue;
  const v = S.verify(lvl, path);
  if(!v.ok) continue;
  if(path.length < MINPAR || path.length > MAXPAR) continue;

  // De tegels moeten ook echt iets doen, anders is het geen introductie van de
  // mechanic maar gewoon decoratie.
  let matters;
  if(KIND === "ice"){
    // ergens in de oplossing moet een blok verder glijden dan de speler sleept
    matters = pathHasSkid(lvl, path);
  } else {
    // zonder pijlen moet het aantoonbaar makkelijker zijn
    const plain = S.solve(base, {tries:3, cap:60000, weight:2.0, maxMoves:400});
    matters = !!plain && plain.length < path.length;
  }

  lvl.par = path.length;
  lvl.seed = seed;
  lvl.fx = KIND;
  lvl.fxMatters = matters;
  results.push(lvl);
  console.log(`seed ${seed}: par=${path.length} blokken=${lvl.blocks.length} ` +
    `${KIND}=${(lvl.ice||lvl.arrows).length} ${matters ? "(tegels doen ertoe)" : "(tegels veranderen niets)"}`);
  if(OUT) fs.writeFileSync(OUT, JSON.stringify(results));
}
console.log("klaar:", results.length);
