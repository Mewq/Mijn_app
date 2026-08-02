"use strict";
/* Par = the shortest solution we can actually find, so it is never a number the
   game claims but cannot back up. */
const fs=require("fs"), S=require("./solver");
const file=process.argv[2];
let html=fs.readFileSync(file,"utf8");
const s=html.indexOf("const LEVELS = ["), e=html.indexOf("\n  ];", s);
const LEVELS=eval(html.slice(s+"const LEVELS = ".length, e+4));
const pars=[];
LEVELS.forEach((lvl,i)=>{
  let best=lvl.par;
  for(const cfg of [{tries:3,cap:70000,weight:2.0},{tries:2,cap:90000,weight:1.6},{tries:3,cap:40000,weight:2.6}]){
    const p=S.solve(lvl,Object.assign({maxMoves:1400},cfg));
    if(p && S.verify(lvl,p).ok && p.length<best) best=p.length;
  }
  pars.push(best);
  console.log(`${String(i+1).padStart(2)} ${lvl.name.padEnd(18)} ${lvl.par} -> ${best}`);
});
let head=html.slice(0,s), body=html.slice(s,e+4), tail=html.slice(e+4);
let n=0;
body=body.replace(/par:(\d+),/g, ()=> "par:"+pars[n++]+",");
if(n!==LEVELS.length) throw new Error("par count mismatch "+n);
fs.writeFileSync(file, head+body+tail);
console.log("updated", n, "pars");
