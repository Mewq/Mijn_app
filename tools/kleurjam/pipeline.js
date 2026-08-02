"use strict";
/* generate -> densify -> harden -> measure carefully -> keep
   usage: node pipeline.js <seedFrom> <seedTo> <outfile> [preset] */

const fs = require("fs");
const G = require("./gen"), S = require("./solver"), D = require("./densify"), H = require("./harden");

const PRESETS = {
  small: {
    colored:44, stones:2, colors:8, pushDeep:4, slides:2, finalSlides:8, insertDepth:2,
    wallClusters:2, restricted:.3, awayBias:.9, spanSlack:1,
    shapes:"I2,I3,L3,O,T4,S4,Z4,L4,J4".split(","), stoneShapes:["I2","L3","I3","O"],
    addShapes:["I2","I3","L3","O","T4","S4","Z4","L4","J4"], stoneRatio:.25
  },
  mixed: {
    colored:36, stones:3, colors:8, pushDeep:4, slides:2, finalSlides:10, insertDepth:2,
    wallClusters:3, restricted:.32, awayBias:.9, spanSlack:1,
    shapes:"I2,I3,L3,O,T4,S4,Z4,L4,J4,P5,U5,X5,T5".split(","), stoneShapes:["I2","L3","O","T4"],
    addShapes:["I2","I3","L3","O","T4","S4","Z4","L4","J4","P5"], stoneRatio:.3
  },
  tiny: {
    colored:52, stones:2, colors:8, pushDeep:4, slides:2, finalSlides:6, insertDepth:2,
    wallClusters:2, restricted:.3, awayBias:.9, spanSlack:1,
    shapes:"I2,I3,L3,O,S4,Z4,T4,L4,J4".split(","), stoneShapes:["I2","L3","I3"],
    addShapes:["I2","I3","L3","O","S4","Z4","T4","L4","J4"], stoneRatio:.2
  },
  dust: {
    colored:78, stones:2, colors:8, pushDeep:3, slides:1, finalSlides:3, insertDepth:2,
    wallClusters:2, restricted:.25, awayBias:.9, spanSlack:1,
    shapes:"D1,D1,D1,I2,I2,I3,L3,O,T4".split(","), stoneShapes:["D1","I2"],
    addShapes:["D1","D1","I2","I2","I3","L3","O","T4","L4"], stoneRatio:.15
  },
  swarm: {
    colored:64, stones:2, colors:8, pushDeep:4, slides:1, finalSlides:4, insertDepth:2,
    wallClusters:2, restricted:.28, awayBias:.9, spanSlack:1,
    shapes:"D1,D1,I2,I2,I3,L3,O,S4,T4,L4".split(","), stoneShapes:["D1","I2","L3"],
    addShapes:["D1","I2","I3","L3","O","S4","T4","L4","J4","Z4"], stoneRatio:.18
  },
  chunky: {
    colored:30, stones:3, colors:8, pushDeep:5, slides:2, finalSlides:8, insertDepth:2,
    wallClusters:2, restricted:.35, awayBias:.9, spanSlack:0,
    shapes:"I3,I4,O,L3,L4,J4,S4,Z4,T4,P5,U5,X5,T5,L5,O6".split(","), stoneShapes:["O","L3","I3","T4"],
    addShapes:["O","L3","I3","L4","J4","T4","S4","Z4","P5","U5","X5"], stoneRatio:.35
  }
};

const FAST   = {tries:1, cap:12000, weight:3.2, maxMoves:1400};
const CAREFUL= {tries:2, cap:60000, weight:2.1, maxMoves:1400};

const from = +process.argv[2], to = +process.argv[3];
const outFile = process.argv[4];
const presetName = process.argv[5] || "small";
const ADDS = +(process.argv[6] || 60);
const HARDEN_ITERS = +(process.argv[7] || 40);
const P = Object.assign({rows:12, cols:12, minColored:10}, PRESETS[presetName]);
if(process.argv[8]) P.colored = +process.argv[8];
if(process.argv[9]) P.colors = +process.argv[9];
if(process.argv[10]) P.shapes = process.argv[10].split(',');

const results = [];
for(let seed = from; seed <= to; seed++){
  const t0 = Date.now();
  let lvl = null;
  try { lvl = G.generate(seed, P); } catch(e){ lvl = null; }
  if(!lvl){ console.log(`seed ${seed}: genfail`); continue; }
  let p = S.solve(lvl, FAST);
  if(!p){ console.log(`seed ${seed}: unsolved base`); continue; }

  let cur = {level: lvl, len: p.length};
  const ckpt = {seed, blocks: lvl.blocks.length, len: p.length};
  const d = D.densify(cur.level, {
    rnd: S.mulberry(seed*7+1), adds: ADDS, maxFails: Math.max(12, (ADDS/3)|0), startLen: cur.len,
    cap: FAST.cap, weight: FAST.weight, maxMoves: FAST.maxMoves,
    stoneRatio: P.stoneRatio, addShapes: P.addShapes, stoneShapes: P.stoneShapes, restricted: P.restricted,
    log: (nb, len, lv) => { ckpt.blocks = nb; ckpt.len = len;
      lv.par = len; lv.seed = seed; lv.preset = presetName;
      fs.writeFileSync(outFile.replace(/\.json$/, '') + '.part.json', JSON.stringify(lv)); }
  });
  if(d) cur = d;
  const h = H.harden(cur.level, {iters: HARDEN_ITERS, rnd: S.mulberry(seed*13+5),
    cap: FAST.cap, weight: FAST.weight, maxMoves: FAST.maxMoves, kick: 3});
  if(h && h.len > cur.len) cur = h;

  const best = S.solve(cur.level, CAREFUL);
  if(!best){ console.log(`seed ${seed}: careful pass failed`); continue; }
  const v = S.verify(cur.level, best);
  if(!v.ok){ console.log(`seed ${seed}: verify failed`); continue; }

  const cells = cur.level.blocks.reduce((a,b)=>a+b.cells.length,0);
  const free = 144 - cur.level.walls.length - cells;
  cur.level.par = best.length;
  cur.level.seed = seed;
  cur.level.preset = presetName;
  results.push(cur.level);
  console.log(`seed ${seed}: ckpt=${ckpt.blocks}/${ckpt.len} blocks=${cur.level.blocks.length} free=${free} fast=${cur.len} par=${best.length} ${((Date.now()-t0)/1000).toFixed(0)}s`);
  fs.writeFileSync(outFile, JSON.stringify(results));
}
console.log("done", results.length);
