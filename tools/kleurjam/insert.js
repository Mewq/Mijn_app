"use strict";
const fs=require("fs");
const S=require("/home/user/Mijn_app/tools/kleurjam/solver");
const A=require("/home/user/Mijn_app/tools/kleurjam/analyse");
const file="/home/user/Mijn_app/kleurjam.html";
const html=fs.readFileSync(file,"utf8");
const start=html.indexOf("  const LEVELS = [");
const end=html.indexOf("\n  ];", start)+"\n  ];".length;
const LEVELS=eval(html.slice(html.indexOf("[",start), html.indexOf("\n  ];",start)+4));

/* Namen en hints komen uit een sidecar-bestand naast de bundel, zodat dit
   script niet elke lichting opnieuw aangepast hoeft te worden. */
const NAMEN=JSON.parse(fs.readFileSync(process.argv[3]||"namen.json","utf8"));

const nieuw=JSON.parse(fs.readFileSync(process.argv[2]||"pijldiep4.json"));
const routes={};
const klaar=[];
nieuw.forEach((l,k)=>{
  const diep=A.firstExit(l,{cap:400000});
  /* Een meegeleverde bouwroute telt als bewijs: bij zwaar versierde levels vindt
     de solver niet altijd binnen budget zelf een route die alle bommen haalt. */
  let pad=null;
  if(l.route && S.verify(l,l.route).ok) pad=l.route;
  for(const cfg of [{tries:2,cap:70000,weight:2.0},{tries:2,cap:120000,weight:1.7}]){
    if(pad) break;
    const p=S.solve(l,Object.assign({maxMoves:1400},cfg));
    if(p&&S.verify(l,p).ok){ pad=p; break; }
  }
  if(!pad){ console.log(`kandidaat ${k+1}: geen route`); return; }
  l.par=pad.length;
  l.name=NAMEN[k][0]; l.hint=NAMEN[k][1];
  l.starMargin=0.25;
  delete l.route; delete l.eersteUitgang; delete l.ondergrens; delete l.seed; delete l.fx; delete l.fxMatters; delete l.preset;
  routes[l.name]=pad.map(m=>({b:m.b,axis:m.axis,d:m.d,to:m.to,exit:!!m.exit,drag:!!m.drag,gate:m.gate}));
  klaar.push(l);
  console.log(`+ ${l.name.padEnd(12)} par=${l.par} blokken=${l.blocks.length} pijlen=${(l.arrows||[]).length} sloten=${l.gates.filter(g=>g.locked).length} | eerste uitgang: ${diep===null?">400k knopen doorzocht":"na "+diep+" zetten"}`);
});

const alles=LEVELS.concat(klaar).sort((a,b)=>a.par-b.par);
const mechVan=l=>{const d=[];
  if(l.timeLimit)d.push("klok"); if(l.blocks.some(b=>b.bomb))d.push("bom");
  if(l.gates.some(g=>g.locked))d.push("slot"); if(l.gates.some(g=>g.keyLocked))d.push("sleutel");
  if(l.blocks.some(b=>b.frozen))d.push("bevroren"); if(l.blocks.some(b=>b.colors))d.push("2-kleur");
  if(l.ice&&l.ice.length)d.push("ijs"); if(l.arrows&&l.arrows.length)d.push("pijlen"); return d;};
const solo={},combi={};
alles.forEach((l,k)=>{const m=mechVan(l);
  if(m.length===1&&solo[m[0]]===undefined) solo[m[0]]=k+1;
  if(m.length>1) m.forEach(x=>{ if(combi[x]===undefined) combi[x]=k+1; });});
let ok=true;
for(const k of Object.keys(combi)) if(!(solo[k]&&solo[k]<combi[k])){ console.log(`LET OP: ${k} solo ${solo[k]||"-"} / combi ${combi[k]}`); ok=false; }
console.log(ok?"leerplan klopt":"");

const fmt=l=>{
  const walls="["+l.walls.map(w=>`[${w[0]},${w[1]}]`).join(",")+"]";
  const blocks=l.blocks.map((b,n)=>{
    let s=`        {id:"b${n}",color:"${b.color}",move:"${b.move}",row:${b.row},col:${b.col},cells:[`+b.cells.map(c=>`[${c[0]},${c[1]}]`).join(",")+"]";
    if(b.colors) s+=",colors:"+JSON.stringify(b.colors);
    if(b.bonusColor) s+=`,bonusColor:"${b.bonusColor}"`;
    if(b.bomb) s+=`,bomb:{type:"${b.bomb.type}",value:${b.bomb.value}}`;
    if(b.frozen) s+=`,frozen:{thawAfter:${b.frozen.thawAfter}}`;
    if(b.key) s+=",key:true";
    return s+"}";}).join(",\n");
  const gates=l.gates.map(g=>{
    let s=`{color:"${g.color}",side:"${g.side}",index:${g.index},span:${g.span}`;
    if(g.locked) s+=`,locked:{openAfter:${g.locked.openAfter}}`;
    if(g.keyLocked) s+=",keyLocked:true";
    return s+"}";}).join(",");
  const extra=[];
  if(l.ice&&l.ice.length) extra.push("      ice:["+l.ice.map(t=>`[${t[0]},${t[1]}]`).join(",")+"],");
  if(l.arrows&&l.arrows.length) extra.push("      arrows:["+l.arrows.map(a=>`[${a[0]},${a[1]},"${a[2]}"]`).join(",")+"],");
  if(l.timeLimit) extra.push("      timeLimit:"+l.timeLimit+",");
  return "    {\n      name:"+JSON.stringify(l.name)+", par:"+l.par+", starMargin:"+(l.starMargin===undefined?0.25:l.starMargin)+
    ",\n      rows:"+l.rows+", cols:"+l.cols+",\n      walls:"+walls+",\n"+extra.join("\n")+(extra.length?"\n":"")+
    "      blocks:[\n"+blocks+"\n      ],\n      gates:["+gates+"],\n      hint:"+JSON.stringify(l.hint)+"\n    }";
};
fs.writeFileSync(file, html.slice(0,start)+"  const LEVELS = [\n"+alles.map(fmt).join(",\n")+"\n  ];"+html.slice(end));

const solFile="/home/user/Mijn_app/tools/kleurjam/solutions.json";
let best={}; try{ best=JSON.parse(fs.readFileSync(solFile,"utf8")); }catch(e){}
Object.assign(best, routes);
fs.writeFileSync(solFile, JSON.stringify(best));
console.log(`\n${alles.length} levels | pars: ${alles.map(l=>l.par).join(" ")}`);
