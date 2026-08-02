"use strict";
/* Wall layouts: carve the board into rooms joined by narrow doors. */
const S = require("./solver");

function pick(rnd, a){ return a[(rnd()*a.length)|0]; }

/* returns array of [r,c] walls */
function rooms(rnd, ROWS, COLS, style){
  const walls = [];
  const add = (r,c) => { if(r>=0&&c>=0&&r<ROWS&&c<COLS) walls.push([r,c]); };
  if(style === "cross"){
    const rr = 4 + ((rnd()*(ROWS-8))|0), cc = 4 + ((rnd()*(COLS-8))|0);
    const doorA = 1 + ((rnd()*(COLS-2))|0), doorB = 1 + ((rnd()*(ROWS-2))|0);
    for(let c=0;c<COLS;c++) if(Math.abs(c-doorA)>0) add(rr,c);
    for(let r=0;r<ROWS;r++) if(Math.abs(r-doorB)>0 && r!==rr) add(r,cc);
  } else if(style === "band"){
    const rr = 3 + ((rnd()*(ROWS-6))|0);
    const d1 = 1 + ((rnd()*(COLS-3))|0);
    for(let c=0;c<COLS;c++) if(c<d1 || c>d1+1) add(rr,c);
  } else if(style === "chamber"){
    const r0 = 2 + ((rnd()*3)|0), c0 = 2 + ((rnd()*3)|0);
    const r1 = r0 + 4 + ((rnd()*3)|0), c1 = c0 + 4 + ((rnd()*3)|0);
    const door = pick(rnd, ["n","s","e","w"]);
    const dpos = 1 + ((rnd()*3)|0);
    for(let c=c0;c<=Math.min(c1,COLS-1);c++){
      if(!(door==="n" && c===c0+dpos)) add(r0,c);
      if(!(door==="s" && c===c0+dpos)) add(Math.min(r1,ROWS-1),c);
    }
    for(let r=r0+1;r<Math.min(r1,ROWS-1);r++){
      if(!(door==="w" && r===r0+dpos)) add(r,c0);
      if(!(door==="e" && r===r0+dpos)) add(r,Math.min(c1,COLS-1));
    }
  } else if(style === "pillars"){
    const n = 4 + ((rnd()*5)|0);
    for(let i=0;i<n;i++){
      const r = 1 + ((rnd()*(ROWS-2))|0), c = 1 + ((rnd()*(COLS-2))|0);
      add(r,c);
      if(rnd()<.5) add(r + (rnd()<.5?1:-1), c);
    }
  } else if(style === "combs"){
    const cc = 3 + ((rnd()*(COLS-6))|0);
    const len = 4 + ((rnd()*4)|0);
    const top = rnd()<.5;
    for(let k=0;k<len;k++) add(top ? k : ROWS-1-k, cc);
    const cc2 = cc + 3 + ((rnd()*3)|0);
    for(let k=0;k<len;k++) add(top ? ROWS-1-k : k, cc2);
  }
  const seen = new Set(), out = [];
  for(const w of walls){ const k=w[0]+","+w[1]; if(!seen.has(k)){ seen.add(k); out.push(w);} }
  return out;
}

module.exports = {rooms, STYLES:["cross","band","chamber","pillars","combs"]};
