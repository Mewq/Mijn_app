"use strict";
/* Schuift de beginstand van een level op tot geen enkel blok binnen N zetten het
   bord af kan.

   Twee dingen maken dit mogelijk:

   1. Elke zet is omkeerbaar, dus vanuit een oplosbare stand een blok geldig
      wegschuiven houdt de stand oplosbaar — je kunt het altijd terugschuiven en
      daarna de oude route lopen. Er valt dus vrij te zoeken in de ruimte van
      geldige beginstanden.

   2. Er bestaat een échte ondergrens per blok: elke blokkeerder in zijn baan
      moet minstens één keer aan de kant, het blok zelf moet minstens één keer
      bewegen, en scheef staan kost nog een zet. De laagste ondergrens over alle
      blokken is dus een bewezen ondergrens voor "wanneer kan er iets weg".

   Daarop wordt gestuurd: kies telkens de zet die die zwakste plek het meest
   versterkt. Willekeurig schudden werkt hier niet — meestal staan er meerdere
   blokken klaar en die moet je allemaal tegelijk dichtzetten.

   node deepen.js <in.json> <uit.json> [doel] [pogingen]                       */

const fs = require("fs");
const E = require("./engine");
const S = require("./solver");
const A = require("./analyse");
const D = require("./decorate");

const IN = process.argv[2], UIT = process.argv[3];
const ALLES = !!process.env.ALLES;      // ook bewaren wat het doel niet haalt
const DOEL = +(process.argv[4] || 9);
const RONDEN = +(process.argv[5] || 60);

/* Ondergrens per kleur: hoe snel kan de snelste van die kleur eruit? */
function perKleur(L, st){
  const occ = E.buildOcc(L, st);
  const min = new Map();
  for(let i = 0; i < L.blocks.length; i++){
    if(st.out[i]) continue;
    const b = L.blocks[i];
    if(!b.gates.length) continue;                  // stenen tellen niet mee
    const c = E.exitCost(L, st, occ, i, true);
    if(c === Infinity) continue;
    const kleur = b.color;
    if(!min.has(kleur) || c < min.get(kleur).kosten) min.set(kleur, {kosten:c, blok:i});
  }
  return min;
}

/* De diepste kleur bepaalt hoe ver de eerste uitgang weg ligt: alle andere
   poorten gaan straks op slot, dus alleen deze kleur kan als eerste weg. */
function diepsteKleur(L, st){
  const min = perKleur(L, st);
  let beste = null;
  for(const [kleur, v] of min) if(!beste || v.kosten > beste.kosten) beste = {kleur, ...v};
  return beste;
}

function score(L, st){
  const min = perKleur(L, st);
  const waarden = [...min.values()].map(v => v.kosten).sort((a,b) => b-a);
  return {top: waarden[0] || 0, tweede: waarden[1] || 0};
}

function beter(a, b){
  if(a.top !== b.top) return a.top > b.top;
  return a.tweede > b.tweede;
}

function verdiep(level, rnd){
  const L = E.makeLevel(level);
  let st = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  let huidig = score(L, st);

  for(let ronde = 0; ronde < RONDEN && huidig.top < DOEL; ronde++){
    const zetten = E.moves(L, st).filter(m => !m.exit);
    let besteZet = null, besteScore = huidig;
    for(const mv of zetten){
      const sc = score(L, E.applyMove(L, st, mv));
      if(beter(sc, besteScore)){ besteScore = sc; besteZet = mv; }
    }
    if(!besteZet){
      for(let k = 0; k < 3 && zetten.length; k++)
        st = E.applyMove(L, st, zetten[(rnd()*zetten.length)|0]);
      huidig = score(L, st);
      continue;
    }
    st = E.applyMove(L, st, besteZet);
    huidig = besteScore;
  }

  const uit = JSON.parse(JSON.stringify(level));
  uit.blocks.forEach((b, i) => {
    b.row = (st.pos[i] / L.COLS) | 0;
    b.col = st.pos[i] % L.COLS;
  });
  return {level: uit, top: huidig.top};
}

/* Een route die begint met het diepst liggende blok. Dat blok bepaalt straks de
   eerste uitgang, dus de route moet er ook echt mee beginnen — anders klopt het
   slot dat daaruit afgeleid wordt niet. */
function routeViaDiepste(level, rnd){
  const L = E.makeLevel(level);
  const st0 = {pos:L.start.pos.slice(), out:L.start.out.slice()};
  const diepste = diepsteKleur(L, st0);
  if(!diepste) return null;

  const eerste = S.phase(L, st0, {cap:90000, weight:1.6, goal:diepste.blok, rnd});
  if(!eerste) return null;
  const rest = S.solveOnce(L, {startState:eerste.state, cap:70000, weight:2.0, maxMoves:1400, rnd});
  if(!rest) return null;
  return {pad: eerste.path.concat(rest), kleur:diepste.kleur, kosten:diepste.kosten};
}

const pool = JSON.parse(fs.readFileSync(IN, "utf8"));
const resultaat = [];
pool.forEach((basis, k) => {
  const rnd = S.mulberry(31337 + k * 977);
  const r = verdiep(basis, rnd);
  const route = routeViaDiepste(r.level, rnd);
  if(!route || !S.verify(r.level, route.pad).ok){
    console.log(`level ${k+1}: geen route via de diepste kleur (${r.top})`);
    return;
  }
  const pad = route.pad;

  /* Nu de sloten. Een gesloten poort houdt een hele kleur tegen, dus dat is het
     krachtigste middel om de eerste uitgang naar achteren te schuiven: alleen de
     kleur die als eerste aan de beurt is hoeft nog diep te liggen. De sloten
     worden afgeleid uit deze route, dus die blijft geldig. */
  let level = r.level, toegepast = [];
  for(let poging = 0; poging < level.gates.length; poging++){
    const res = D.decorate(level, pad, ["lock"], S.mulberry(555 + k*13 + poging), {lock:{min:1}});
    if(!res.applied.length) break;
    if(!S.verify(res.level, pad).ok) break;
    level = res.level;
    toegepast = toegepast.concat(res.applied);
  }

  const echt = A.firstExit(level, {cap: 60000});
  const grens = echt === null ? 99 : echt;
  if(grens < DOEL && !ALLES){
    console.log(`level ${k+1}: met ${toegepast.length} slot(en) nog steeds een uitgang na ${grens} zetten`);
    return;
  }
  level.par = pad.length;
  level.ondergrens = route.kosten;
  level.eersteUitgang = echt;
  resultaat.push(level);
  console.log(`level ${k+1}: eerste uitgang ${echt === null ? ">budget" : "na " + echt + " zetten"}, ` +
    `par ${pad.length}, ${level.blocks.length} blokken, ${toegepast.length} slot(en)`);
  fs.writeFileSync(UIT, JSON.stringify(resultaat));
});
resultaat.sort((a,b) => (b.eersteUitgang||0) - (a.eersteUitgang||0));
if(UIT) fs.writeFileSync(UIT, JSON.stringify(resultaat));
console.log(`\n${resultaat.length} van de ${pool.length} bewaard` +
  (resultaat.length ? `, beste eerste uitgang: ${resultaat[0].eersteUitgang}` : ""));
