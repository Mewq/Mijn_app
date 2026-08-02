"use strict";
/* Greedy densifier: keep dropping extra blocks into the holes, and keep only
   the ones the solver can still solve around. Every accepted level therefore
   comes with a verified move sequence. */

const E = require("./engine");
const S = require("./solver");
const G = require("./gen");

function freeCells(level){
  const R = level.rows, C = level.cols;
  const grid = new Uint8Array(R*C);
  for(const w of level.walls) grid[w[0]*C + w[1]] = 1;
  for(const b of level.blocks) for(const rc of b.cells) grid[(b.row+rc[0])*C + (b.col+rc[1])] = 1;
  return grid;
}

function canPlace(level, cells, r, c){
  const R = level.rows, C = level.cols;
  const grid = freeCells(level);
  for(const rc of cells){
    const rr = r + rc[0], cc = c + rc[1];
    if(rr < 0 || cc < 0 || rr >= R || cc >= C) return false;
    if(grid[rr*C + cc]) return false;
  }
  return true;
}

/* a colour block only makes sense if its cross-section fits its gate */
function colorFits(level, cells, color){
  const g = level.gates.find(x => x.color === color);
  if(!g) return false;
  const h = Math.max(...cells.map(x=>x[0])) + 1;
  const w = Math.max(...cells.map(x=>x[1])) + 1;
  const vertical = g.side === "top" || g.side === "bottom";
  return (vertical ? w : h) <= g.span;
}

function densify(level, opts){
  opts = opts || {};
  const rnd = opts.rnd || S.mulberry(999);
  const fast = {tries:1, cap: opts.cap || 25000, weight: opts.weight || 2.8, maxMoves: opts.maxMoves || 900};
  const stoneVariants = G.shapeVariants(opts.stoneShapes || ["O","L3","I3","I2","I4","T4","L4","S4","Z4"]);
  const colorVariants = G.shapeVariants(opts.addShapes || ["O","L3","I3","L4","J4","T4","S4","Z4","P5","U5","X5","T5"]);
  const colors = [...new Set(level.gates.map(g => g.color))];

  let cur = JSON.parse(JSON.stringify(level));
  let curLen = opts.startLen;
  if(curLen === undefined){
    const p = S.solve(cur, fast);
    if(!p) return null;
    curLen = p.length;
  }
  let n = cur.blocks.length;
  let fails = 0;
  const maxFails = opts.maxFails || 24;
  const budget = opts.adds || 60;

  for(let t=0; t<budget && fails < maxFails; t++){
    const asStone = rnd() < (opts.stoneRatio === undefined ? 0.45 : opts.stoneRatio);
    const color = asStone ? "stone" : colors[(rnd()*colors.length)|0];
    const pool = asStone ? stoneVariants : colorVariants.filter(v => colorFits(cur, v.cells, color));
    if(!pool.length){ fails++; continue; }
    const v = pool[(rnd()*pool.length)|0];
    const R = cur.rows, C = cur.cols;
    let placed = null;
    for(let a=0;a<80 && !placed;a++){
      const r = (rnd()*R)|0, c = (rnd()*C)|0;
      if(canPlace(cur, v.cells, r, c)) placed = {r, c};
    }
    if(!placed){ fails++; continue; }
    const gate = cur.gates.find(g => g.color === color);
    const move = rnd() < (opts.restricted === undefined ? 0.3 : opts.restricted)
      ? (gate ? E.SIDE_AXIS[gate.side] : (rnd() < .5 ? "H" : "V"))
      : "A";
    const cand = JSON.parse(JSON.stringify(cur));
    cand.blocks.push({id:"b"+(n++), color, move, cells:v.cells, row:placed.r, col:placed.c});
    const p = S.solve(cand, fast);
    if(!p){ n--; fails++; continue; }
    cur = cand; curLen = p.length; fails = 0;
    if(opts.log) opts.log(cur.blocks.length, curLen, cur);
  }
  return {level: cur, len: curLen};
}

module.exports = {densify, freeCells, canPlace};
