import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const errors = [];
const notes = [];

function fail(message) { errors.push(message); }
function collect(directory, output = []) {
  for (const name of readdirSync(directory)) {
    if ([".git", ".netlify", "node_modules"].includes(name)) continue;
    const full = join(directory, name);
    if (statSync(full).isDirectory()) collect(full, output);
    else output.push(full);
  }
  return output;
}

const required = [
  "package.json", "netlify.toml", "public/index.html", "public/styles.css", "public/app.js",
  "public/assets/replant-wordmark.png", "public/assets/replant-mark.svg", "public/favicon.svg",
  "netlify/functions/health.mjs", "netlify/functions/import-recipe.mjs", "netlify/functions/convert-recipe.mjs",
  "START-HIER.md", "README.md",
];
for (const path of required) if (!existsSync(join(root, path))) fail(`Pflichtdatei fehlt: ${path}`);

const files = collect(root);
const scripts = files.filter((file) => [".js", ".mjs"].includes(extname(file)));
for (const file of scripts) {
  try { execFileSync(process.execPath, ["--check", file], { stdio: "pipe" }); }
  catch (error) { fail(`JavaScript-Syntaxfehler in ${relative(root, file)}: ${error.stderr?.toString() || error.message}`); }
}
notes.push(`${scripts.length} JavaScript-Dateien syntaktisch geprüft`);

try {
  const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  for (const script of ["test", "check", "verify", "dev", "deploy:prod", "smoke"]) {
    if (!packageJson.scripts?.[script]) fail(`package.json: Script '${script}' fehlt`);
  }
  const manifest = JSON.parse(readFileSync(join(root, "public/manifest.webmanifest"), "utf8"));
  if (!manifest.name || !manifest.start_url || !manifest.icons?.length) fail("Web-App-Manifest ist unvollständig");
} catch (error) {
  fail(`JSON-Datei ungültig: ${error.message}`);
}

const html = readFileSync(join(root, "public/index.html"), "utf8");
const ids = [...html.matchAll(/\sid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) fail(`Doppelte HTML-IDs: ${duplicateIds.join(", ")}`);
if (/\son[a-z]+\s*=/i.test(html)) fail("Inline-Eventhandler im HTML gefunden");
if (/<script[^>]+src=["']https?:/i.test(html) || /<link[^>]+href=["']https?:/i.test(html)) fail("Externe Frontend-Abhängigkeit gefunden");

const app = readFileSync(join(root, "public/app.js"), "utf8");
const idBlock = app.match(/const ids = \[([\s\S]*?)\];/);
const expectedIds = idBlock ? [...idBlock[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]) : [];
const missingIds = expectedIds.filter((id) => !ids.includes(id));
if (missingIds.length) fail(`app.js erwartet fehlende HTML-IDs: ${missingIds.join(", ")}`);
if (expectedIds.length < 70) fail("DOM-ID-Prüfung scheint unvollständig");
notes.push(`${ids.length} eindeutige HTML-IDs und ${expectedIds.length} App-Verknüpfungen geprüft`);

const css = readFileSync(join(root, "public/styles.css"), "utf8");
for (const feature of [":focus-visible", "prefers-reduced-motion", "@media print", "max-width: 720px", "backdrop-filter"]) {
  if (!css.includes(feature)) fail(`CSS-Merkmal fehlt: ${feature}`);
}
const animationCount = (css.match(/@keyframes\s+/g) || []).length;
if (animationCount < 5) fail("Zu wenige definierte Animationen");
notes.push(`${animationCount} Animationen sowie Mobile-, Fokus-, Druck- und Reduced-Motion-Regeln geprüft`);

const netlify = readFileSync(join(root, "netlify.toml"), "utf8");
for (const route of ["/api/health", "/api/import", "/api/convert"]) if (!netlify.includes(route)) fail(`Netlify-Route fehlt: ${route}`);
for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy"]) if (!netlify.includes(header)) fail(`Security-Header fehlt: ${header}`);
notes.push("Netlify-Routen und Security-Header geprüft");

const secretPatterns = [/xai-[A-Za-z0-9_-]{20,}/g, /sk-[A-Za-z0-9_-]{20,}/g];
for (const file of files) {
  if ([".png", ".jpg", ".jpeg", ".webp", ".zip"].includes(extname(file).toLowerCase())) continue;
  const content = readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    pattern.lastIndex = 0;
    if (pattern.test(content)) fail(`Möglicher echter API-Key in ${relative(root, file)}`);
  }
}
notes.push("Keine eingebetteten xAI- oder OpenAI-Schlüssel erkannt");

const logoSize = statSync(join(root, "public/assets/replant-wordmark.png")).size;
if (logoSize < 5_000) fail("Logo-Datei wirkt unvollständig");
notes.push(`Logo-Asset geprüft (${new Intl.NumberFormat("de-DE").format(logoSize)} Bytes)`);

if (errors.length) {
  console.error("Projektprüfung fehlgeschlagen:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Projektprüfung erfolgreich:");
for (const note of notes) console.log(`- ${note}`);
console.log(`- ${files.length} Projektdateien insgesamt erfasst`);
