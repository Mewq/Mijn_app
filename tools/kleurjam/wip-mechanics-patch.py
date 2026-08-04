#!/usr/bin/env python3
"""ONAF — nog niet toegepast op kleurjam.html.

Voegt de negen mechanics (klok, bommen, poorten op slot, bevroren blokken,
tweekleurige blokken, pijltegels, ijstegels, sleutel & slot, sterren) toe aan
het spel. De regels staan al wel in engine.js, zodat de solver ze aankan; dit
script is de kant van het spel zelf. Nog te doen na het toepassen: levels maken
die de mechanics gebruiken (decorate.js en genfx.js), en playsolve.js uitbreiden
zodat die ook klok- en bomtoestanden controleert.

Voegt de negen mechanics toe aan kleurjam.html.

De regels moeten exact gelijk blijven aan tools/kleurjam/engine.js — daar worden
de pars mee uitgerekend en met playsolve.js wordt gecontroleerd dat spel en
engine het echt eens zijn.
"""
import sys, re

path = sys.argv[1] if len(sys.argv) > 1 else "kleurjam.html"
s = open(path, encoding="utf-8").read()

def rep(old, new, n=1):
    global s
    assert old in s, "niet gevonden:\n" + old[:200]
    s = s.replace(old, new, n)

# ---------------------------------------------------------------- CSS
rep("""  #hint{""",
"""  /* --- tegels met een eigenschap --- */
  .cell.ice{
    background:linear-gradient(160deg,#2e5470,#1e3a4e);
    box-shadow:inset 0 2px 5px rgba(0,0,0,.4), inset 0 0 0 1.5px rgba(150,225,255,.4);
  }
  .arrows-layer{position:absolute;pointer-events:none;z-index:30;}
  .arrow-tile{
    position:absolute;display:grid;place-items:center;
    color:rgba(200,235,255,.9);font-weight:800;line-height:1;
    text-shadow:0 1px 3px rgba(0,0,0,.9), 0 0 6px rgba(0,0,0,.6);
  }

  /* --- poorten op slot --- */
  .gate.shut{
    background-image:repeating-linear-gradient(45deg,#6b6490 0 4px,#4c4670 4px 8px);
    animation:none;opacity:.9;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);
  }
  .gate-lock{
    position:absolute;display:grid;place-items:center;z-index:31;
    font-family:'Baloo 2',system-ui,sans-serif;font-weight:700;color:var(--cream);
    background:rgba(16,14,32,.9);border-radius:999px;pointer-events:none;
    box-shadow:0 2px 6px rgba(0,0,0,.55);
  }

  /* --- blokken met een eigenschap --- */
  .badge{
    position:absolute;display:grid;place-items:center;z-index:2;
    border-radius:999px;font-family:'Baloo 2',system-ui,sans-serif;font-weight:700;
    color:#fff;background:rgba(16,14,32,.85);pointer-events:none;
    box-shadow:0 2px 5px rgba(0,0,0,.5);
  }
  .badge.bomb{background:rgba(46,10,14,.9);box-shadow:0 0 0 1.5px rgba(255,130,130,.75);}
  .badge.frost{background:rgba(10,34,54,.9);box-shadow:0 0 0 1.5px rgba(160,225,255,.75);}
  .frost-layer{
    position:absolute;inset:0;pointer-events:none;border-radius:inherit;
    background:linear-gradient(150deg,rgba(200,240,255,.5),rgba(120,190,235,.3));
    box-shadow:inset 0 0 0 2px rgba(225,248,255,.55);
  }
  .block.frozen{filter:saturate(.45) brightness(.85) drop-shadow(0 7px 10px rgba(0,0,0,.5));cursor:default;}
  .block.armed .bcell{animation:tick .6s ease-in-out infinite;}
  @keyframes tick{50%{filter:brightness(1.55);}}
  .block.armed{animation:shake .6s ease-in-out infinite;}
  @keyframes shake{25%{transform:translateX(-1.5px);}75%{transform:translateX(1.5px);}}
  .half2{position:absolute;inset:0;border-radius:inherit;clip-path:polygon(100% 0,100% 100%,0 100%);}
  .keymark{position:absolute;display:grid;place-items:center;z-index:2;pointer-events:none;}
  /* een blok dat het bord af is, mag geen aanrakingen meer opvangen */
  .block.exited, .block.exited .bcell{pointer-events:none;}

  .stars{display:flex;gap:4px;justify-content:center;margin-bottom:10px;font-size:26px;line-height:1;}
  .stars .s{opacity:.22;}
  .stars .s.on{opacity:1;filter:drop-shadow(0 2px 6px rgba(255,178,56,.6));}
  .lvl-tile .st{font-size:9px;letter-spacing:1px;line-height:1;color:var(--amber);}
  .win-card .bonus{color:var(--amber);font-weight:800;font-size:12.5px;margin:-14px 0 16px;}

  #hint{""")

rep("""  .confetti{position:absolute;""",
"""  #fail-modal{
    position:fixed;inset:0;background:rgba(15,14,28,.72);backdrop-filter:blur(3px);
    display:flex;align-items:center;justify-content:center;z-index:100;
    opacity:0;pointer-events:none;transition:opacity .25s ease;
  }
  #fail-modal.show{opacity:1;pointer-events:auto;}
  #fail-modal .win-card h2{color:#ff8a8a;}
  .confetti{position:absolute;""")

# ---------------------------------------------------------------- markup
rep("""      <div class="pill-row">
        <div class="pill">🕹️ <b id="moves-count">0</b> zetten</div>
        <div class="pill">🧩 <b id="left-count">0</b> te gaan</div>
      </div>""",
"""      <div class="pill-row">
        <div class="pill">🕹️ <b id="moves-count">0</b> zetten</div>
        <div class="pill" id="timer-pill" hidden>⏱️ <b id="time-left">0:00</b></div>
        <div class="pill">🧩 <b id="left-count">0</b> te gaan</div>
      </div>""")

# hidden moet het winnen van .pill{display:flex}
rep("""  .stars{display:flex;""",
"""  .pill[hidden]{display:none;}
  .stars{display:flex;""")

rep("""      <div class="blocks-layer" id="blocks-layer"></div>""",
"""      <div class="blocks-layer" id="blocks-layer"></div>
      <div class="arrows-layer" id="arrows-layer"></div>""")

rep("""    <div class="emoji" id="win-emoji">🎉</div>
    <h2 id="win-title">Level gehaald!</h2>
    <p id="win-sub">Opgelost in 0 zetten</p>""",
"""    <div class="emoji" id="win-emoji">🎉</div>
    <h2 id="win-title">Level gehaald!</h2>
    <div class="stars" id="win-stars"><span class="s">★</span><span class="s">★</span><span class="s">★</span></div>
    <p id="win-sub">Opgelost in 0 zetten</p>
    <p class="bonus" id="win-bonus" hidden>✨ Bonuskleur gehaald</p>""")

rep("""<div id="win-modal">""",
"""<div id="fail-modal">
  <div class="win-card">
    <div class="emoji" id="fail-emoji">💥</div>
    <h2 id="fail-title">Mislukt</h2>
    <p id="fail-sub"></p>
    <div class="win-actions">
      <button class="btn-primary" id="retry-btn">Opnieuw proberen</button>
    </div>
  </div>
</div>

<div id="win-modal">""")

# ---------------------------------------------------------------- state
rep("""  let cellSize = 60;
  let ROWS = 6, COLS = 6;
  let blocks = [], gates = [], wallSet = new Set();
  let currentLevel = 0;
  let moveCount = 0;
  let history = [];
  let progress = {solved:[], best:{}};
  let winShown = false;""",
"""  let cellSize = 60;
  let ROWS = 6, COLS = 6;
  let blocks = [], gates = [], wallSet = new Set();
  let iceSet = new Set(), arrowMap = new Map();
  let currentLevel = 0;
  let moveCount = 0;
  let history = [];
  let progress = {solved:[], best:{}, stars:{}};
  let winShown = false;
  let failed = false;
  let bonusKept = true;              // alle tweekleurige blokken via hun bonuskleur?
  let timeLimit = null;              // seconden, of null
  let clockStarted = 0;              // tijdstip van de eerste zet
  let clockId = null;""")

rep("""  const movesCountEl = document.getElementById("moves-count");
  const leftCountEl  = document.getElementById("left-count");""",
"""  const movesCountEl = document.getElementById("moves-count");
  const leftCountEl  = document.getElementById("left-count");
  const timerPill    = document.getElementById("timer-pill");
  const timeLeftEl   = document.getElementById("time-left");
  const arrowsLayer  = document.getElementById("arrows-layer");
  const failModal    = document.getElementById("fail-modal");
  const failTitle    = document.getElementById("fail-title");
  const failSub      = document.getElementById("fail-sub");
  const failEmoji    = document.getElementById("fail-emoji");
  const winStars     = document.getElementById("win-stars");
  const winBonus     = document.getElementById("win-bonus");""")

# ---------------------------------------------------------------- rules
rep("""  const key = (r,c) => r + "," + c;""",
"""  const key = (r,c) => r + "," + c;
  const DIR_NAME = {"-1,0":"top", "1,0":"bottom", "0,-1":"left", "0,1":"right"};

  /* ---- toestandsafhankelijke mechanics ---- */

  function exitedTotal(){
    let n = 0;
    for(const b of blocks) if(b.exited) n++;
    return n;
  }

  function gateOpen(g){
    if(!g) return false;
    if(g.locked && exitedTotal() < g.locked.openAfter) return false;
    if(g.keyLocked){
      const k = blocks.find(b => b.key);
      if(!k || !k.exited) return false;
    }
    return true;
  }

  function blockFrozen(b){
    return !!b.frozen && exitedTotal() < b.frozen.thawAfter;
  }

  function gatesOf(b){
    return (b.colors && b.colors.length ? b.colors : [b.color])
      .map(c => gates.find(g => g.color === c)).filter(Boolean);
  }

  function bombLeft(b){
    if(!b.bomb) return null;
    if(b.bomb.type === "moves") return b.bomb.value - moveCount;
    if(!clockStarted) return b.bomb.value;
    return Math.ceil(b.bomb.value - (Date.now() - clockStarted)/1000);
  }

  /* een pijltegel mag alleen in zijn eigen richting betreden worden */
  function arrowsAllow(b, fromR, fromC, toR, toC, dirName){
    if(!arrowMap.size) return true;
    for(const rc of b.cells){
      const r = toR + rc[0], c = toC + rc[1];
      if(r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
      const a = arrowMap.get(key(r,c));
      if(!a) continue;
      let wasMine = false;
      for(const rc2 of b.cells){
        if(fromR + rc2[0] === r && fromC + rc2[1] === c){ wasMine = true; break; }
      }
      if(wasMine) continue;
      if(a !== dirName) return false;
    }
    return true;
  }

  function onIce(b, r0, c0){
    if(!iceSet.size) return false;
    for(const rc of b.cells){
      const r = r0 + rc[0], c = c0 + rc[1];
      if(r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
      if(iceSet.has(key(r,c))) return true;
    }
    return false;
  }""")

rep("""  function gateOf(color){ return gates.find(g => g.color === color); }""",
"""  function gateOf(color){ return gates.find(g => g.color === color); }

  function canStep(b, r, c, dr, dc, occ){
    if(!fitsInside(b, r + dr, c + dc, occ)) return false;
    return arrowsAllow(b, r, c, r + dr, c + dc, DIR_NAME[dr + "," + dc]);
  }""")

rep("""  // number of steps needed to leave the board completely, or -1
  function exitSteps(b, row, col, occ){
    const gate = gateOf(b.color);
    if(!gate) return -1;
    if(b.move !== "A" && b.move !== SIDE_AXIS[gate.side]) return -1;
    const d = SIDE_DIR[gate.side];
    for(let k = 1; k <= ROWS + COLS + 4; k++){
      let allOut = true;
      for(const rc of b.cells){
        const r = row + d[0]*k + rc[0];
        const c = col + d[1]*k + rc[1];
        const inside = r >= 0 && r < ROWS && c >= 0 && c < COLS;
        if(inside){
          allOut = false;
          if(wallSet.has(key(r,c)) || occ.has(key(r,c))) return -1;
        } else if(!outsideOk(r, c, gate)){
          return -1;
        }
      }
      if(allOut) return k;
    }
    return -1;
  }""",
"""  // aantal stappen om via deze poort het bord te verlaten, of -1
  function exitStepsVia(b, row, col, occ, gate){
    if(!gate) return -1;
    if(b.move !== "A" && b.move !== SIDE_AXIS[gate.side]) return -1;
    if(!gateOpen(gate)) return -1;
    const d = SIDE_DIR[gate.side];
    const dirName = DIR_NAME[d[0] + "," + d[1]];
    let pr = row, pc = col;
    for(let k = 1; k <= ROWS + COLS + 4; k++){
      const nr = row + d[0]*k, nc = col + d[1]*k;
      if(!arrowsAllow(b, pr, pc, nr, nc, dirName)) return -1;
      let allOut = true;
      for(const rc of b.cells){
        const r = nr + rc[0], c = nc + rc[1];
        const inside = r >= 0 && r < ROWS && c >= 0 && c < COLS;
        if(inside){
          allOut = false;
          if(wallSet.has(key(r,c)) || occ.has(key(r,c))) return -1;
        } else if(!outsideOk(r, c, gate)){
          return -1;
        }
      }
      pr = nr; pc = nc;
      if(allOut) return k;
    }
    return -1;
  }

  // goedkoopste uitgang, over alle poorten die dit blok mag gebruiken
  function exitGateFor(b, row, col, occ){
    let best = null, bestK = -1;
    for(const g of gatesOf(b)){
      const k = exitStepsVia(b, row, col, occ, g);
      if(k > 0 && (bestK < 0 || k < bestK)){ bestK = k; best = g; }
    }
    return best ? {gate:best, steps:bestK} : null;
  }

  function exitSteps(b, row, col, occ){
    const info = exitGateFor(b, row, col, occ);
    return info ? info.steps : -1;
  }

  /* Gedwongen doorglijden op ijs: gaat door in dezelfde richting zolang het blok
     ijs raakt. Naar buiten glijden door een open poort telt gewoon als opgelost. */
  function iceSlide(b, r, c, dr, dc, occ){
    if(!iceSet.size) return {r, c, exit:false};
    let guard = 0;
    while(onIce(b, r, c) && guard++ < ROWS + COLS){
      const info = exitGateFor(b, r, c, occ);
      if(info){
        const d = SIDE_DIR[info.gate.side];
        if(d[0] === dr && d[1] === dc) return {r, c, exit:true};
      }
      if(!canStep(b, r, c, dr, dc, occ)) break;
      r += dr; c += dc;
    }
    return {r, c, exit:false};
  }""")

rep("""  // how far a block may travel along one axis, and whether it can leave
  function dragRange(b, axis, occ){
    let neg = 0, pos = 0;
    while(fitsInside(b, axis === "V" ? b.row - (neg+1) : b.row,
                        axis === "H" ? b.col - (neg+1) : b.col, occ)) neg++;
    while(fitsInside(b, axis === "V" ? b.row + (pos+1) : b.row,
                        axis === "H" ? b.col + (pos+1) : b.col, occ)) pos++;

    let exitSide = null, exitOffset = 0;
    const gate = gateOf(b.color);
    if(gate && SIDE_AXIS[gate.side] === axis){
      const k = exitSteps(b, b.row, b.col, occ);
      if(k > 0){
        exitOffset = k;
        exitSide = (gate.side === "right" || gate.side === "bottom") ? "pos" : "neg";
      }
    }
    return {neg, pos, exitSide, exitOffset};
  }""",
"""  // hoe ver een blok langs één as mag, en of het naar buiten kan
  function dragRange(b, axis, occ){
    const dr = axis === "V" ? 1 : 0, dc = axis === "H" ? 1 : 0;
    let neg = 0, pos = 0;
    let r = b.row, c = b.col;
    while(canStep(b, r, c, -dr, -dc, occ)){ r -= dr; c -= dc; neg++; }
    r = b.row; c = b.col;
    while(canStep(b, r, c, dr, dc, occ)){ r += dr; c += dc; pos++; }

    let exitSide = null, exitOffset = 0;
    const info = exitGateFor(b, b.row, b.col, occ);
    if(info && SIDE_AXIS[info.gate.side] === axis){
      exitOffset = info.steps;
      exitSide = (info.gate.side === "right" || info.gate.side === "bottom") ? "pos" : "neg";
    }
    return {neg, pos, exitSide, exitOffset};
  }""")

# ---------------------------------------------------------------- rendering
rep("""        const cell = document.createElement("div");
        cell.className = "cell" + (wallSet.has(key(r,c)) ? " wall" : "");
        cellsLayer.appendChild(cell);""",
"""        const cell = document.createElement("div");
        cell.className = "cell" + (wallSet.has(key(r,c)) ? " wall" : "")
                       + (iceSet.has(key(r,c)) ? " ice" : "");
        cellsLayer.appendChild(cell);""")

rep("""    blocksLayer.innerHTML = "";
    blocks.forEach(b => {""",
"""    arrowsLayer.style.left = FRAME + "px";
    arrowsLayer.style.top  = FRAME + "px";
    arrowsLayer.style.width  = (COLS*cellSize) + "px";
    arrowsLayer.style.height = (ROWS*cellSize) + "px";
    arrowsLayer.innerHTML = "";
    const GLYPH = {top:"▲", bottom:"▼", left:"◀", right:"▶"};
    arrowMap.forEach((dir, k) => {
      const [r, c] = k.split(",").map(Number);
      const el = document.createElement("div");
      el.className = "arrow-tile";
      el.textContent = GLYPH[dir];
      el.style.left = (c*cellSize) + "px";
      el.style.top  = (r*cellSize) + "px";
      el.style.width = cellSize + "px";
      el.style.height = cellSize + "px";
      el.style.fontSize = Math.round(cellSize*0.42) + "px";
      arrowsLayer.appendChild(el);
    });

    blocksLayer.innerHTML = "";
    blocks.forEach(b => {""")

rep("""      gatesLayer.appendChild(el);
    });""",
"""      if(!gateOpen(g)) el.classList.add("shut");
      gatesLayer.appendChild(el);

      if(g.locked || g.keyLocked){
        const badge = document.createElement("div");
        badge.className = "gate-lock";
        const size = Math.max(14, Math.round(cellSize*0.46));
        badge.style.width = size + "px";
        badge.style.height = size + "px";
        badge.style.fontSize = Math.round(size*0.62) + "px";
        const mid = FRAME + g.index*cellSize + (g.span*cellSize)/2;
        if(g.side === "left" || g.side === "right"){
          badge.style.top = (mid - size/2) + "px";
          badge.style[g.side] = "-2px";
        } else {
          badge.style.left = (mid - size/2) + "px";
          badge.style[g.side] = "-2px";
        }
        badge.dataset.gateColor = g.color;
        gatesLayer.appendChild(badge);
      }
    });""")

# badges op blokken
rep("""    if(b.cells.length === 1) return el;
    const grip = gripFor(b);""",
"""    // tweede kleur als hoekvlak, bom-teller, ijslaag en sleutel
    if(b.colors && b.colors.length > 1){
      for(const cellEl of el.children){
        const half = document.createElement("div");
        half.className = "half2 c-" + b.colors[1];
        cellEl.appendChild(half);
      }
    }
    if(b.bomb || b.frozen || b.key){
      const size = Math.max(13, Math.round(cellSize*0.52));
      const anchor = b.cells[0];
      if(b.key){
        const mark = document.createElement("div");
        mark.className = "keymark";
        mark.textContent = "🔑";
        mark.style.left = (anchor[1]*cellSize) + "px";
        mark.style.top  = (anchor[0]*cellSize) + "px";
        mark.style.width = cellSize + "px";
        mark.style.height = cellSize + "px";
        mark.style.fontSize = Math.round(cellSize*0.5) + "px";
        el.appendChild(mark);
      } else {
        const badge = document.createElement("div");
        badge.className = "badge " + (b.bomb ? "bomb" : "frost");
        badge.style.width = size + "px";
        badge.style.height = size + "px";
        badge.style.fontSize = Math.round(size*0.66) + "px";
        badge.style.left = (anchor[1]*cellSize + (cellSize - size)/2) + "px";
        badge.style.top  = (anchor[0]*cellSize + (cellSize - size)/2) + "px";
        badge.dataset.role = b.bomb ? "bomb" : "frost";
        el.appendChild(badge);
      }
    }
    if(b.frozen){
      const frost = document.createElement("div");
      frost.className = "frost-layer";
      el.appendChild(frost);
    }
    if(b.cells.length === 1) return el;
    const grip = gripFor(b);""")

# ---------------------------------------------------------------- drag
rep("""  function onDown(e, b){
    if(b.exited || winShown) return;""",
"""  function onDown(e, b){
    if(b.exited || winShown || failed || blockFrozen(b)) return;""")

rep("""  function onUp(e, b){
    if(!b.drag) return;
    const drag = b.drag;
    b.drag = null;
    b.el.classList.remove("dragging");
    if(!drag.axis || !drag.range){ placeBlockEl(b); return; }

    const rg = drag.range, raw = drag.raw;
    let offset = null, leaving = false;

    if(rg.exitSide === "pos" && raw > rg.pos + 0.5){ offset = rg.exitOffset; leaving = true; }
    else if(rg.exitSide === "neg" && raw < -rg.neg - 0.5){ offset = -rg.exitOffset; leaving = true; }
    else offset = Math.max(-rg.neg, Math.min(rg.pos, Math.round(raw)));

    if(offset === 0 && !leaving){ placeBlockEl(b); return; }

    pushHistory();
    if(drag.axis === "H") b.col = drag.col + offset;
    else                  b.row = drag.row + offset;

    moveCount++;
    movesCountEl.textContent = moveCount;
    undoBtn.disabled = false;

    requestAnimationFrame(() => {
      placeBlockEl(b);
      if(leaving){
        b.exited = true;
        b.el.classList.add("exited");
        updateLeftCount();
        setTimeout(() => { b.el.style.opacity = "0"; }, 200);
      }
    });

    if(leaving) setTimeout(checkWin, 360);
  }""",
"""  function onUp(e, b){
    if(!b.drag) return;
    const drag = b.drag;
    b.drag = null;
    b.el.classList.remove("dragging");
    if(!drag.axis || !drag.range){ placeBlockEl(b); return; }

    const rg = drag.range, raw = drag.raw;
    let offset = null, leaving = false;

    if(rg.exitSide === "pos" && raw > rg.pos + 0.5){ offset = rg.exitOffset; leaving = true; }
    else if(rg.exitSide === "neg" && raw < -rg.neg - 0.5){ offset = -rg.exitOffset; leaving = true; }
    else offset = Math.max(-rg.neg, Math.min(rg.pos, Math.round(raw)));

    if(offset === 0 && !leaving){ placeBlockEl(b); return; }

    // waar het blok belandt: ijs kan het verder meenemen
    let landR = drag.row, landC = drag.col, skid = null;
    let dr = drag.axis === "V" ? Math.sign(offset) : 0;
    let dc = drag.axis === "H" ? Math.sign(offset) : 0;
    if(!leaving){
      if(drag.axis === "H") landC = drag.col + offset;
      else                  landR = drag.row + offset;
      const rest = iceSlide(b, landR, landC, dr, dc, b.occ);
      if(rest.exit){
        // doorglijden tot buiten het bord
        leaving = true;
        const info = exitGateFor(b, rest.r, rest.c, b.occ);
        const steps = info ? info.steps : Math.max(ROWS, COLS);
        skid = {r: rest.r + dr*steps, c: rest.c + dc*steps};
      } else if(rest.r !== landR || rest.c !== landC){
        skid = rest;
      }
    } else {
      // het blok schuift het bord uit, dus de eindstand ligt buiten het bord
      landR = drag.row; landC = drag.col;
    }

    pushHistory();
    startClock();
    if(skid){
      b.row = skid.r; b.col = skid.c;
    } else if(leaving){
      if(drag.axis === "H") b.col = drag.col + offset;
      else                  b.row = drag.row + offset;
    } else {
      b.row = landR; b.col = landC;
    }

    moveCount++;
    movesCountEl.textContent = moveCount;
    undoBtn.disabled = false;

    requestAnimationFrame(() => {
      if(skid){
        // eerst tot waar de speler sleepte, dan zichtbaar doorglijden
        b.el.style.left = (landC * cellSize) + "px";
        b.el.style.top  = (landR * cellSize) + "px";
        const dist = Math.abs(skid.r - landR) + Math.abs(skid.c - landC);
        setTimeout(() => {
          b.el.style.transitionTimingFunction = "cubic-bezier(.15,.7,.4,1)";
          b.el.style.transitionDuration = Math.min(0.62, 0.13 + dist*0.075) + "s";
          placeBlockEl(b);
          setTimeout(() => {
            b.el.style.transitionTimingFunction = "";
            b.el.style.transitionDuration = "";
          }, 700);
        }, 90);
      } else {
        placeBlockEl(b);
      }
      if(leaving){
        b.exited = true;
        b.el.classList.add("exited");
        onBoardChanged();
        setTimeout(() => { b.el.style.opacity = "0"; }, 200);
      } else {
        refreshBadges();
      }
    });

    checkBombs();
    if(leaving) setTimeout(checkWin, 380);
  }""")

# ---------------------------------------------------------------- klok, bommen, sterren
rep("""  /* ---------- history ---------- */""",
"""  /* ---------- klok en bommen ---------- */

  function fmtTime(sec){
    sec = Math.max(0, Math.ceil(sec));
    return Math.floor(sec/60) + ":" + String(sec%60).padStart(2,"0");
  }

  function startClock(){
    if(clockStarted || failed) return;
    if(!timeLimit && !blocks.some(b => b.bomb && b.bomb.type === "seconds")) return;
    clockStarted = Date.now();
    clockId = setInterval(tickClock, 200);
    tickClock();
  }

  function stopClock(){
    if(clockId){ clearInterval(clockId); clockId = null; }
  }

  function tickClock(){
    if(winShown || failed) return;
    const elapsed = (Date.now() - clockStarted)/1000;
    if(timeLimit){
      const left = timeLimit - elapsed;
      timeLeftEl.textContent = fmtTime(left);
      if(left <= 0){ loseLevel("tijd"); return; }
    }
    checkBombs();
    refreshBadges();
  }

  function checkBombs(){
    if(winShown || failed) return;
    for(const b of blocks){
      if(!b.bomb || b.exited) continue;
      if(bombLeft(b) <= 0){ loseLevel("bom", b); return; }
    }
  }

  function refreshBadges(){
    for(const b of blocks){
      if(!b.el) continue;
      const badge = b.el.querySelector(".badge");
      if(badge){
        if(badge.dataset.role === "bomb"){
          const left = Math.max(0, bombLeft(b));
          badge.textContent = left;
          b.el.classList.toggle("armed", !b.exited && left <= 3);
        } else {
          const left = Math.max(0, b.frozen.thawAfter - exitedTotal());
          badge.textContent = left;
        }
      }
      const frozenNow = blockFrozen(b);
      b.el.classList.toggle("frozen", frozenNow);
      const frost = b.el.querySelector(".frost-layer");
      if(frost) frost.style.display = frozenNow ? "" : "none";
      const fb = b.el.querySelector(".badge.frost");
      if(fb) fb.style.display = frozenNow ? "" : "none";
    }
    // poorten die opengaan
    const lockEls = gatesLayer.querySelectorAll(".gate-lock");
    gates.forEach((g, i) => {
      const el = gatesLayer.children[i];
      if(el && el.classList.contains("gate")) el.classList.toggle("shut", !gateOpen(g));
    });
    lockEls.forEach(el => {
      const g = gates.find(x => x.color === el.dataset.gateColor);
      if(!g) return;
      if(gateOpen(g)){ el.style.display = "none"; return; }
      el.style.display = "";
      el.textContent = g.keyLocked ? "🔒" : Math.max(0, g.locked.openAfter - exitedTotal());
    });
  }

  function onBoardChanged(){
    updateLeftCount();
    refreshBadges();
  }

  function loseLevel(reason, block){
    if(failed || winShown) return;
    failed = true;
    stopClock();
    if(reason === "tijd"){
      failEmoji.textContent = "⏰";
      failTitle.textContent = "Tijd voorbij";
      failSub.textContent = "Dit level heeft een klok van " + fmtTime(timeLimit) + ".";
    } else {
      failEmoji.textContent = "💥";
      failTitle.textContent = "Boem!";
      failSub.textContent = "Het " + (block ? colorName(block.color) : "") +
        " bomblok moest eerder naar zijn poort.";
      if(block && block.el) block.el.classList.remove("armed");
    }
    failModal.classList.add("show");
  }

  function colorName(c){
    return ({red:"rode",orange:"oranje",yellow:"gele",green:"groene",teal:"turkooize",
             blue:"blauwe",purple:"paarse",pink:"roze",stone:"grijze"})[c] || c;
  }

  function starsFor(idx, moves){
    const lvl = LEVELS[idx];
    const margin = lvl.starMargin === undefined ? 0.25 : lvl.starMargin;
    if(moves <= lvl.par) return 3;
    if(moves <= Math.ceil(lvl.par * (1 + margin))) return 2;
    return 1;
  }

  /* ---------- history ---------- */""")

# ---------------------------------------------------------------- win / undo / load
rep("""      if(wasOut && !b.exited){
        b.el.classList.remove("exited");
        b.el.style.opacity = "1";
      }
      placeBlockEl(b);
    });
    updateLeftCount();
    undoBtn.disabled = history.length === 0;""",
"""      if(wasOut && !b.exited){
        b.el.classList.remove("exited");
        b.el.style.opacity = "1";
      }
      placeBlockEl(b);
    });
    onBoardChanged();
    undoBtn.disabled = history.length === 0;""")

rep("""  function checkWin(){
    if(winShown) return;
    if(!blocks.every(b => !gateOf(b.color) || b.exited)) return;
    winShown = true;
    const par = LEVELS[currentLevel].par;
    const prevBest = progress.best[currentLevel];
    markSolved(currentLevel, moveCount);
    const extra = (prevBest !== undefined && moveCount < prevBest) ? " Nieuw record!" : "";
    if(moveCount <= par){
      winEmoji.textContent = "🏅";
      winTitle.textContent = "Meesterlijk!";
      winSub.textContent = "In " + moveCount + " zetten — het doel was " + par + "." + extra;
    } else {
      winEmoji.textContent = "🎉";
      winTitle.textContent = "Level gehaald!";
      winSub.textContent = "Opgelost in " + moveCount + " zetten. Ons doel: " + par + "." + extra;
    }
    winModal.classList.add("show");
    launchConfetti();
  }""",
"""  function checkWin(){
    if(winShown || failed) return;
    if(!blocks.every(b => !gatesOf(b).length || b.exited)) return;
    winShown = true;
    stopClock();
    const par = LEVELS[currentLevel].par;
    const prevBest = progress.best[currentLevel];
    const stars = starsFor(currentLevel, moveCount);
    markSolved(currentLevel, moveCount, stars);
    const extra = (prevBest !== undefined && moveCount < prevBest) ? " Nieuw record!" : "";
    [...winStars.children].forEach((el, i) => el.classList.toggle("on", i < stars));
    if(stars === 3){
      winEmoji.textContent = "🏅";
      winTitle.textContent = "Meesterlijk!";
      winSub.textContent = "In " + moveCount + " zetten — het doel was " + par + "." + extra;
    } else {
      winEmoji.textContent = "🎉";
      winTitle.textContent = "Level gehaald!";
      winSub.textContent = "Opgelost in " + moveCount + " zetten. Drie sterren vanaf " + par + "." + extra;
    }
    const hasTwoColor = blocks.some(b => b.colors && b.colors.length > 1);
    winBonus.hidden = !(hasTwoColor && bonusKept);
    winModal.classList.add("show");
    launchConfetti();
  }""")

rep("""  function markSolved(idx, moves){
    if(!progress.solved.includes(idx)) progress.solved.push(idx);
    if(progress.best[idx] === undefined || moves < progress.best[idx]) progress.best[idx] = moves;""",
"""  function markSolved(idx, moves, stars){
    if(!progress.solved.includes(idx)) progress.solved.push(idx);
    if(!progress.stars) progress.stars = {};
    if(progress.stars[idx] === undefined || stars > progress.stars[idx]) progress.stars[idx] = stars;
    if(progress.best[idx] === undefined || moves < progress.best[idx]) progress.best[idx] = moves;""")

rep("""  function loadLevel(idx){
    currentLevel = idx;
    winShown = false;
    moveCount = 0;
    history = [];
    undoBtn.disabled = true;
    movesCountEl.textContent = "0";
    winModal.classList.remove("show");

    const lvl = LEVELS[idx];
    ROWS = lvl.rows; COLS = lvl.cols;
    wallSet = new Set(lvl.walls.map(w => key(w[0], w[1])));
    blocks = lvl.blocks.map(b => ({
      id:b.id, color:b.color, move:b.move,
      cells:b.cells, row:b.row, col:b.col, exited:false
    }));
    gates = lvl.gates.slice();""",
"""  function loadLevel(idx){
    currentLevel = idx;
    winShown = false;
    failed = false;
    bonusKept = true;
    moveCount = 0;
    history = [];
    undoBtn.disabled = true;
    movesCountEl.textContent = "0";
    winModal.classList.remove("show");
    failModal.classList.remove("show");
    stopClock();
    clockStarted = 0;

    const lvl = LEVELS[idx];
    ROWS = lvl.rows; COLS = lvl.cols;
    wallSet = new Set(lvl.walls.map(w => key(w[0], w[1])));
    iceSet = new Set((lvl.ice || []).map(t => key(t[0], t[1])));
    arrowMap = new Map((lvl.arrows || []).map(a => [key(a[0], a[1]), a[2]]));
    blocks = lvl.blocks.map(b => ({
      id:b.id, color:b.color, move:b.move,
      colors:b.colors || null, bonusColor:b.bonusColor || null,
      bomb:b.bomb || null, frozen:b.frozen || null, key:!!b.key,
      cells:b.cells, row:b.row, col:b.col, exited:false
    }));
    gates = lvl.gates.map(g => Object.assign({}, g));
    timeLimit = lvl.timeLimit || null;
    timerPill.hidden = !timeLimit;
    if(timeLimit) timeLeftEl.textContent = fmtTime(timeLimit);""")

rep("""    buildBoard();
    updateLeftCount();
    renderLevelTiles();""",
"""    buildBoard();
    onBoardChanged();
    renderLevelTiles();""")

# tegels: sterren tonen
rep("""      const p = document.createElement("div");
      p.className = "p";
      p.textContent = solved ? (perfect ? "★ " + best : best + "/" + lvl.par) : lvl.par + " zet";
      tile.appendChild(n); tile.appendChild(p);""",
"""      const p = document.createElement("div");
      p.className = "p";
      p.textContent = solved ? best + "/" + lvl.par : lvl.par + " zet";
      tile.appendChild(n); tile.appendChild(p);
      if(solved){
        const st = document.createElement("div");
        st.className = "st";
        const got = (progress.stars && progress.stars[i]) || (perfect ? 3 : 1);
        st.textContent = "★".repeat(got) + "☆".repeat(3 - got);
        tile.appendChild(st);
      }""")

# uitgangskeuze bijhouden voor de bonuskleur
rep("""    const rg = drag.range, raw = drag.raw;
    let offset = null, leaving = false;""",
"""    const rg = drag.range, raw = drag.raw;
    let offset = null, leaving = false;
    const exitInfo = exitGateFor(b, b.row, b.col, b.occ);""")

rep("""      if(leaving){
        b.exited = true;
        b.el.classList.add("exited");
        onBoardChanged();""",
"""      if(leaving){
        b.exited = true;
        if(b.colors && b.colors.length > 1 && b.bonusColor && exitInfo &&
           exitInfo.gate.color !== b.bonusColor) bonusKept = false;
        b.el.classList.add("exited");
        onBoardChanged();""")

# knoppen
rep("""  document.getElementById("restart-btn").addEventListener("click", () => loadLevel(currentLevel));""",
"""  document.getElementById("restart-btn").addEventListener("click", () => loadLevel(currentLevel));
  document.getElementById("retry-btn").addEventListener("click", () => loadLevel(currentLevel));""")

rep("""  document.addEventListener("keydown", e => {
    if((e.key === "z" || e.key === "Z") && !winShown) undo();""",
"""  document.addEventListener("keydown", e => {
    if((e.key === "z" || e.key === "Z") && !winShown && !failed) undo();""")

open(path, "w", encoding="utf-8").write(s)
print("kleurjam.html gepatcht")
