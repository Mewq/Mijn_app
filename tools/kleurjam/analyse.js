"use strict";
/* Meet drie eigenschappen van een level die niet uit de par af te lezen zijn:

   klaar0   hoeveel blokken meteen bij de start naar buiten kunnen. Hoe lager,
            hoe minder gratis zetten er aan het begin liggen.
   traag    het aandeel blokken dat pas na vijf of meer zetten überhaupt naar
            buiten kán. Gemeten door de oplossing af te spelen en per blok bij
            te houden wanneer het voor het eerst uitgangsklaar staat.
   vallen   hoeveel van de zetten die je aan het begin kunt doen tot een stand
            leiden waar de solver geen route meer vindt. Dat is geen bewijs van
            een doodlopende weg — de solver is niet volledig — maar het zijn wel
            standen waar hij met terugstappen en al niet meer uitkomt, en dat is
            precies het "vastgelopen"-gevoel.                                  */

const E = require("./engine");
const S = require("./solver");

/* per blok: op welke zet staat het voor het eerst uitgangsklaar? */
function readyAt(level, path){
  const L = E.makeLevel(level);
  let st = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  const ready = new Array(L.blocks.length).fill(null);

  const kijk = (n) => {
    const occ = E.buildOcc(L, st);
    for(let i=0;i<L.blocks.length;i++){
      if(ready[i] !== null || st.out[i]) continue;
      const b = L.blocks[i];
      if(!b.gates.length) continue;                 // stenen hoeven niet weg
      const r = (st.pos[i] / L.COLS) | 0, c = st.pos[i] % L.COLS;
      if(E.exitSteps(L, b, r, c, occ, i, st) > 0) ready[i] = n;
    }
  };

  kijk(0);
  path.forEach((mv, n) => { st = E.applyMove(L, st, mv); kijk(n+1); });
  return {ready, blocks: L.blocks};
}

function analyse(level, path, opts){
  opts = opts || {};
  const {ready, blocks} = readyAt(level, path);
  const kleuren = blocks.map((b,i) => b.gates.length ? i : -1).filter(i => i >= 0);

  const klaar0 = kleuren.filter(i => ready[i] === 0).length;
  const traag  = kleuren.filter(i => ready[i] === null || ready[i] >= 5).length;

  let vallen = 0, onderzocht = 0;
  if(opts.traps){
    const L = E.makeLevel(level);
    const st0 = {pos:L.start.pos.slice(), out:L.start.out.slice()};
    const zetten = E.moves(L, st0).filter(m => !m.exit);
    // een steekproef: alles doorrekenen kost te veel tijd op een vol bord
    const stap = Math.max(1, Math.floor(zetten.length / (opts.sample || 14)));
    for(let k = 0; k < zetten.length; k += stap){
      const na = E.applyMove(L, st0, zetten[k]);
      const kopie = JSON.parse(JSON.stringify(level));
      kopie.blocks.forEach((b, i) => {
        b.row = (na.pos[i] / L.COLS) | 0;
        b.col = na.pos[i] % L.COLS;
      });
      onderzocht++;
      const p = S.solve(kopie, {tries:1, cap:50000, weight:2.2, maxMoves:1400});
      if(!p) vallen++;
    }
  }

  return {
    par: path.length,
    blokken: blocks.length,
    kleurblokken: kleuren.length,
    klaar0,
    traag,
    traagDeel: kleuren.length ? traag / kleuren.length : 0,
    vallen, onderzocht,
    valDeel: onderzocht ? vallen / onderzocht : 0
  };
}

module.exports = {analyse, readyAt};
