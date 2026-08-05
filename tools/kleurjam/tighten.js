"use strict";
/* Par = the shortest solution we can actually find, so it is never a number the
   game claims but cannot back up. */
const fs=require("fs"), S=require("./solver");
const file=process.argv[2];
// optioneel: alleen een deel van de ladder, 1-gebaseerd (handig als de zwaarste
// borden nog moeten en de rest al scherp staat)
const VANAF = +(process.argv[3] || 1);
const TOT   = +(process.argv[4] || 9999);
let html=fs.readFileSync(file,"utf8");
const s=html.indexOf("const LEVELS = ["), e=html.indexOf("\n  ];", s);
const LEVELS=eval(html.slice(s+"const LEVELS = ".length, e+4));
/* Na elk level meteen wegschrijven. De zware borden kosten minuten, en een run
   die halverwege afgebroken wordt moet niet al zijn werk kwijt zijn. */
const pars = LEVELS.map(l => l.par);
function schrijf(){
  const huidig = fs.readFileSync(file, "utf8");
  const a = huidig.indexOf("const LEVELS = ["), b = huidig.indexOf("\n  ];", a);
  let n = 0;
  const body = huidig.slice(a, b+4).replace(/par:(\d+),/g, (m, oud) => {
    const nieuw = pars[n++];
    return "par:" + Math.min(+oud, nieuw) + ",";
  });
  fs.writeFileSync(file, huidig.slice(0, a) + body + huidig.slice(b+4));
}

LEVELS.forEach((lvl,i)=>{
  if(i+1 < VANAF || i+1 > TOT) return;
  let best=lvl.par;
  for(const cfg of [{tries:3,cap:70000,weight:2.0},{tries:2,cap:90000,weight:1.6},{tries:3,cap:40000,weight:2.6}]){
    const p=S.solve(lvl,Object.assign({maxMoves:1400},cfg));
    if(p && S.verify(lvl,p).ok && p.length<best) best=p.length;
  }
  pars[i]=best;
  console.log(`${String(i+1).padStart(2)} ${lvl.name.padEnd(18)} ${lvl.par} -> ${best}`);
  schrijf();
});
console.log("updated", LEVELS.length, "pars");
