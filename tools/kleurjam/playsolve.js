"use strict";
/* End-to-end proof: replay a solver solution through the real UI with mouse
   drags and check the game agrees the level is solved. */
const fs = require("fs");
const path = require("path");
const { chromium } = require("/opt/node22/lib/node_modules/playwright");
const S = require("./solver");

const file = process.argv[2];
const which = (process.argv[3] || "0").split(",").map(Number);

const html = fs.readFileSync(file, "utf8");
const s = html.indexOf("const LEVELS = ["), e = html.indexOf("\n  ];", s);
const LEVELS = eval(html.slice(s + "const LEVELS = ".length, e + 4));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: {width: 900, height: 1100} });
  const errors = [];
  page.on("pageerror", err => errors.push(String(err)));
  await page.goto("file://" + path.resolve(file));
  await page.waitForTimeout(500);

  for(const idx of which){
    const lvl = LEVELS[idx];
    const path = S.solve(lvl, {tries:3, cap:70000, weight:2.0, maxMoves:1400});
    if(!path){ console.log(`level ${idx+1}: no solution found, skipped`); continue; }

    await page.evaluate(i => document.querySelectorAll(".lvl-tile")[i].click(), idx);
    await page.waitForTimeout(400);

    const cell = await page.evaluate(() => {
      const layer = document.getElementById("cells-layer");
      return layer.getBoundingClientRect().width / (layer.style.gridTemplateColumns.match(/\d+/)[0]);
    });

    let failed = null;
    for(let m = 0; m < path.length; m++){
      const mv = path[m];
      // grab a real filled cell — an L-shape's bounding-box corner is empty
      const box = await page.evaluate(i => {
        const el = document.getElementById("blocks-layer").children[i];
        const c = el.querySelector(".bcell").getBoundingClientRect();
        return {x:c.x + c.width/2, y:c.y + c.height/2};
      }, mv.b);
      const startX = box.x, startY = box.y;
      // exit distances are stored unsigned, so take the direction from the gate
      let d = mv.d;
      if(mv.exit){
        const g = lvl.gates.find(x => x.color === lvl.blocks[mv.b].color);
        const sign = (g.side === "left" || g.side === "top") ? -1 : 1;
        d = sign * (Math.abs(mv.d) + 0.9);
      }
      const dist = d * cell;
      const dx = mv.axis === "H" ? dist : 0;
      const dy = mv.axis === "V" ? dist : 0;

      await page.mouse.move(startX, startY);
      await page.mouse.down();
      const steps = Math.max(4, Math.round(Math.abs(mv.d)) * 3);
      for(let k = 1; k <= steps; k++)
        await page.mouse.move(startX + dx*k/steps, startY + dy*k/steps);
      await page.mouse.up();
      await page.waitForTimeout(mv.exit ? 60 : 20);

      const moves = await page.evaluate(() => +document.getElementById("moves-count").textContent);
      if(moves !== m+1){ failed = `move ${m+1} (block ${mv.b} ${mv.axis}${mv.d}${mv.exit?" exit":""}) did not register — counter is ${moves}`; break; }
    }
    await page.waitForTimeout(600);
    const state = await page.evaluate(() => ({
      moves: +document.getElementById("moves-count").textContent,
      left: +document.getElementById("left-count").textContent,
      won: document.getElementById("win-modal").classList.contains("show"),
      sub: document.getElementById("win-sub").textContent
    }));
    console.log(`level ${idx+1} "${lvl.name}" par=${lvl.par}: solution=${path.length} ` +
      `played=${state.moves} left=${state.left} won=${state.won}` + (failed ? "  FAILED: " + failed : ""));
    if(state.won) await page.evaluate(() => document.getElementById("win-modal").classList.remove("show"));
  }
  console.log(errors.length ? "PAGE ERRORS: " + errors.join(" | ") : "no page errors");
  await browser.close();
})();
