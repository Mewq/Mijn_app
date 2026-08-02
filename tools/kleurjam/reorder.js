"use strict";
/* Sort the ladder by par, keeping the name/hint that belongs to each rung. */
const fs=require("fs");
const file=process.argv[2];
const html=fs.readFileSync(file,"utf8");
const s=html.indexOf("  const LEVELS = ["), e=html.indexOf("\n  ];", s)+"\n  ];".length;
const LEVELS=eval(html.slice(html.indexOf("[", s), html.indexOf("\n  ];", s)+4));
const labels=LEVELS.map(l=>({name:l.name, hint:l.hint}));
const sorted=LEVELS.slice().sort((a,b)=>a.par-b.par);
sorted.forEach((l,i)=>{ l.name=labels[i].name; l.hint=labels[i].hint; });

const fmt = l => {
  const walls="["+l.walls.map(w=>`[${w[0]},${w[1]}]`).join(",")+"]";
  const blocks=l.blocks.map((b,n)=>
    `        {id:"b${n}",color:"${b.color}",move:"${b.move}",row:${b.row},col:${b.col},cells:[`+
    b.cells.map(c=>`[${c[0]},${c[1]}]`).join(",")+`]}`).join(",\n");
  const gates=l.gates.map(g=>`{color:"${g.color}",side:"${g.side}",index:${g.index},span:${g.span}}`).join(",");
  return `    {
      name:${JSON.stringify(l.name)}, par:${l.par},
      rows:${l.rows}, cols:${l.cols},
      walls:${walls},
      blocks:[
${blocks}
      ],
      gates:[${gates}],
      hint:${JSON.stringify(l.hint)}
    }`;
};
const body="  const LEVELS = [\n"+sorted.map(fmt).join(",\n")+"\n  ];";
fs.writeFileSync(file, html.slice(0,s)+body+html.slice(e));
console.log("order:", sorted.map(l=>l.par).join(", "));
