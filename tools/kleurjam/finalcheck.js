"use strict";
/* Re-solve every level straight out of the shipped HTML and sanity-check it. */
const fs=require("fs"), S=require("./solver"), E=require("./engine");
const html=fs.readFileSync(process.argv[2],"utf8");
const s=html.indexOf("const LEVELS = ["), e=html.indexOf("\n  ];", s);
const LEVELS=eval(html.slice(s+"const LEVELS = ".length, e+4));
let bad=0;
LEVELS.forEach((lvl,i)=>{
  const issues=[];
  if(lvl.rows!==12||lvl.cols!==12) issues.push("not 12x12");
  const ids=new Set(lvl.blocks.map(b=>b.id));
  if(ids.size!==lvl.blocks.length) issues.push("duplicate ids");
  // every colour block must have a gate; stones must not
  for(const b of lvl.blocks){
    const g=lvl.gates.find(x=>x.color===b.color);
    if(b.color!=="stone" && !g) issues.push("no gate for "+b.color);
    if(g && b.move!=="A" && b.move!==({top:"V",bottom:"V",left:"H",right:"H"})[g.side])
      issues.push("block "+b.id+" can never reach its gate");
  }
  // overlap / out of bounds / on a wall
  const occ=new Map(), wall=new Set(lvl.walls.map(w=>w[0]+","+w[1]));
  for(const b of lvl.blocks) for(const rc of b.cells){
    const r=b.row+rc[0], c=b.col+rc[1], k=r+","+c;
    if(r<0||c<0||r>=lvl.rows||c>=lvl.cols) issues.push("block "+b.id+" out of bounds");
    if(wall.has(k)) issues.push("block "+b.id+" on a wall");
    if(occ.has(k)) issues.push("overlap at "+k);
    occ.set(k,b.id);
  }
  for(let a=0;a<lvl.gates.length;a++) for(let b=a+1;b<lvl.gates.length;b++){
    const g=lvl.gates[a], h=lvl.gates[b];
    if(g.side===h.side && g.index < h.index+h.span && h.index < g.index+g.span)
      issues.push("gates overlap: "+g.color+"/"+h.color+" @"+g.side);
  }
  for(const g of lvl.gates){
    const limit=(g.side==="top"||g.side==="bottom")?lvl.cols:lvl.rows;
    if(g.index<0||g.index+g.span>limit) issues.push("gate off board: "+g.color);
  }
  const path=S.solve(lvl,{tries:2,cap:70000,weight:2.0,maxMoves:1400});
  if(!path) issues.push("NOT SOLVED by solver");
  else {
    const v=S.verify(lvl,path);
    if(!v.ok) issues.push("solution invalid");
    if(path.length<lvl.par) issues.push(`par ${lvl.par} beaten by solver (${path.length})`);
  }
  const cells=lvl.blocks.reduce((a,b)=>a+b.cells.length,0);
  const area=lvl.rows*lvl.cols;
  const shapes=new Set(lvl.blocks.map(b=>JSON.stringify(b.cells))).size;
  console.log(`${String(i+1).padStart(2)} ${lvl.name.padEnd(18)} par=${String(lvl.par).padStart(3)} solver=${String(path?path.length:"-").padStart(3)}`+
    ` blocks=${String(lvl.blocks.length).padStart(2)} shapes=${String(shapes).padStart(2)} walls=${String(lvl.walls.length).padStart(2)}`+
    ` free=${String(area-lvl.walls.length-cells).padStart(3)} ${issues.length?"  ISSUES: "+issues.join("; "):""}`);
  if(issues.length) bad++;
});
console.log(bad? `\n${bad} level(s) with issues` : "\nall levels OK");
