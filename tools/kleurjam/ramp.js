"use strict";
/* easier rungs of the ladder: fewer blocks, no densify */
const fs=require("fs"), G=require("./gen"), S=require("./solver");
const CAREFUL={tries:4, cap:90000, weight:2.0, maxMoves:900};
const base={rows:12, cols:12, minColored:4, colors:8, stones:2, pushDeep:4, slides:2, finalSlides:8,
  insertDepth:3, wallClusters:2, restricted:.3, awayBias:.9, spanSlack:1,
  shapes:"I2,I3,L3,O,T4,S4,Z4,L4,J4,P5,U5,X5".split(","), stoneShapes:["I2","L3","O"]};
const outFile=process.argv[2]||"ramp.json";
const seedBase=+(process.argv[3]||0);
const out=[];
const plan=[[4,2],[6,2],[8,2],[10,3],[13,3],[16,4],[20,5],[24,6]];
for(const [colored,stones] of plan){
  for(let s=1;s<=14;s++){
    const P=Object.assign({},base,{colored,stones,minColored:Math.min(4,colored)});
    const lvl=G.generate(seedBase+s*53+colored*7, P);
    if(!lvl) continue;
    const p=S.solve(lvl, CAREFUL);
    if(!p) continue;
    if(!S.verify(lvl,p).ok) continue;
    lvl.par=p.length; lvl.seed=seedBase+s*53+colored*7; lvl.tier=colored;
    out.push(lvl);
    console.log(`c${colored} seed${lvl.seed} blocks=${lvl.blocks.length} par=${p.length}`);
    fs.writeFileSync(outFile, JSON.stringify(out));
  }
}
console.log("done", out.length);
