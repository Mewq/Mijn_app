"use strict";
/* Wall masks: they keep the visible grid at 12x12 but squeeze the playable
   area, which is what actually creates traffic jams. */

function mk(ROWS, COLS, fn){
  const out = [];
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(fn(r,c)) out.push([r,c]);
  return out;
}

const MASKS = {
  // one big staircase corner walled off
  stair: (R,C,rnd) => { const k = 4 + ((rnd()*3)|0); return mk(R,C,(r,c)=> r + c < k || (R-1-r) + (C-1-c) < k - 1); },
  // walled top-left triangle, like the original 9x9 levels
  wedge: (R,C,rnd) => { const k = 8 + ((rnd()*3)|0); return mk(R,C,(r,c)=> r + c < k); },
  // hourglass: two notches from the sides
  waist: (R,C,rnd) => { const m = (R/2)|0, w = 3 + ((rnd()*2)|0);
    return mk(R,C,(r,c)=> (r===m || r===m-1) && (c < w || c >= C-w)); },
  // ring corridor around a solid core
  core: (R,C,rnd) => { const s = 3 + ((rnd()*2)|0), r0 = ((R-s)/2)|0, c0 = ((C-s)/2)|0;
    return mk(R,C,(r,c)=> r>=r0 && r<r0+s && c>=c0 && c<c0+s); },
  // two rooms with a doorway
  split: (R,C,rnd) => { const cc = 4 + ((rnd()*4)|0), d = 2 + ((rnd()*(R-4))|0);
    return mk(R,C,(r,c)=> c===cc && r!==d && r!==d+1); },
  // corners bitten off
  corners: (R,C,rnd) => { const k = 3 + ((rnd()*2)|0);
    return mk(R,C,(r,c)=> (r+c < k) || (r + (C-1-c) < k) || ((R-1-r)+c < k) || ((R-1-r)+(C-1-c) < k)); },
  // comb of teeth from top and bottom
  teeth: (R,C,rnd) => { const len = 3 + ((rnd()*3)|0);
    return mk(R,C,(r,c)=> (c%3===1) && ((c%6===1 && r<len) || (c%6===4 && r>=R-len))); },
  none: () => []
};

module.exports = {MASKS, mk};
