"use strict";
/* Maakt van kleurjam.html een versie die als Artifact gepubliceerd kan worden:
   losse pagina-inhoud zonder <html>/<head>/<body>, en zonder verzoeken naar
   buiten (een Artifact blokkeert externe fonts, scripts en afbeeldingen).

   node artifact.js ../../kleurjam.html kleurjam-artifact.html                  */

const fs = require("fs");

const src = fs.readFileSync(process.argv[2], "utf8");
const out = process.argv[3] || "kleurjam-artifact.html";

const style = src.slice(src.indexOf("<style>"), src.indexOf("</style>") + "</style>".length);
let body = src.slice(src.indexOf("<body>") + "<body>".length, src.lastIndexOf("</body>"));

// Google Fonts is geblokkeerd in een Artifact; val terug op afgeronde
// systeemletters (ui-rounded is SF Pro Rounded op iPhone en Mac).
const DISPLAY = `'Baloo 2', ui-rounded, 'SF Pro Rounded', 'Segoe UI Rounded', 'Trebuchet MS', system-ui, sans-serif`;
const BODY    = `'Nunito', ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`;

let css = style
  .replace(/'Baloo 2',\s*system-ui,\s*sans-serif/g, DISPLAY)
  .replace(/'Nunito',\s*system-ui,\s*sans-serif/g, BODY)
  .replace(/'Nunito',\s*sans-serif/g, BODY)
  .replace(/font-family:'Baloo 2';/g, `font-family:${DISPLAY};`);

// De Artifact-pagina brengt zijn eigen body mee, dus verhuist de achtergrond
// naar een eigen laag die het altijd wint.
css = css.replace("<style>", `<style>
  .kj-page{
    margin:0;
    min-height:100vh;
    background:radial-gradient(circle at 50% -10%, #3a3570 0%, #201e3d 45%, #131225 100%);
    font-family:${BODY};
    color:#F5EFE6;
    display:flex;
    justify-content:center;
    padding:18px 12px 34px;
    box-sizing:border-box;
  }
  .kj-page *{box-sizing:border-box;}
`);

const html = `<title>Kleurjam</title>
${css}
<div class="kj-page">${body.trim()}</div>
`;

fs.writeFileSync(out, html);
console.log(`${out} geschreven (${(html.length/1024).toFixed(0)} kB)`);
