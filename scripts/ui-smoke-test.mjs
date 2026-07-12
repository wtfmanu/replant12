import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const artifactDir = join(root, "artifacts");
const port = 4173;
const debugPort = 9333;
const baseUrl = `http://127.0.0.1:${port}`;
const chromePath = process.env.CHROME_PATH || "/usr/bin/chromium";
const profileDir = "/tmp/replant-smoke-chrome";
const browserProblems = [];

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function waitFor(check, label, timeout = 15_000, interval = 120) {
  const end = Date.now() + timeout;
  let lastError;
  while (Date.now() < end) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) { lastError = error; }
    await sleep(interval);
  }
  throw new Error(`Timeout: ${label}${lastError ? ` (${lastError.message})` : ""}`);
}

function waitForOutput(child, pattern, label) {
  return new Promise((resolvePromise, reject) => {
    let output = "";
    const onData = (chunk) => {
      output += chunk.toString();
      if (pattern.test(output)) { cleanup(); resolvePromise(); }
    };
    const onExit = (code) => { cleanup(); reject(new Error(`${label} exited with ${code}: ${output}`)); };
    const cleanup = () => {
      child.stdout?.off("data", onData); child.stderr?.off("data", onData); child.off("exit", onExit);
    };
    child.stdout?.on("data", onData); child.stderr?.on("data", onData); child.on("exit", onExit);
  });
}

class CdpClient {
  constructor(url) { this.socket = new WebSocket(url); this.nextId = 1; this.pending = new Map(); this.listeners = new Map(); }
  async open() {
    await new Promise((resolvePromise, reject) => {
      this.socket.addEventListener("open", resolvePromise, { once: true });
      this.socket.addEventListener("error", () => reject(new Error("CDP connection failed")), { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message)); else pending.resolve(message.result);
      } else {
        for (const listener of this.listeners.get(message.method) || []) listener(message.params);
      }
    });
  }
  on(method, listener) { this.listeners.set(method, [...(this.listeners.get(method) || []), listener]); }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolvePromise, reject) => {
      this.pending.set(id, { resolve: resolvePromise, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket.close(); }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Evaluation failed");
  return result.result.value;
}

async function waitPage(client, expression, label, timeout = 15_000) {
  return waitFor(() => evaluate(client, expression), label, timeout);
}

async function navigate(client, url) {
  await client.send("Page.navigate", { url });
  await waitPage(client, "document.readyState === 'complete'", `load ${url}`);
}

async function screenshot(client, name) {
  const result = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(artifactDir, name), Buffer.from(result.data, "base64"));
}

let server;
let chrome;
let client;
try {
  await mkdir(artifactDir, { recursive: true });
  await rm(profileDir, { recursive: true, force: true });
  server = spawn(process.execPath, ["scripts/smoke-server.mjs"], { cwd: root, env: { ...process.env, SMOKE_PORT: String(port) }, stdio: ["ignore", "pipe", "pipe"] });
  await waitForOutput(server, /SMOKE_SERVER_READY/u, "smoke server");

  chrome = spawn(chromePath, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--remote-allow-origins=*",
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank",
  ], { stdio: ["ignore", "pipe", "pipe"] });

  const target = await waitFor(async () => {
    const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
    if (!response.ok) return null;
    return (await response.json()).find((item) => item.type === "page" && item.webSocketDebuggerUrl);
  }, "Chrome DevTools target", 15_000);

  client = new CdpClient(target.webSocketDebuggerUrl);
  await client.open();
  await Promise.all([client.send("Page.enable"), client.send("Runtime.enable"), client.send("Log.enable")]);
  client.on("Runtime.consoleAPICalled", (event) => {
    if (["error", "warning"].includes(event.type)) browserProblems.push(`console.${event.type}: ${event.args?.map((arg) => arg.value || arg.description).join(" ")}`);
  });
  client.on("Log.entryAdded", ({ entry }) => {
    if (["error", "warning"].includes(entry.level)) browserProblems.push(`${entry.level}: ${entry.text}`);
  });

  await client.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1050, deviceScaleFactor: 1, mobile: false });
  await navigate(client, baseUrl);
  await waitPage(client, "document.querySelector('#aiSettingsStatus')?.textContent === 'Noch nicht eingerichtet'", "health status");

  const initial = await evaluate(client, `(() => ({
    title: document.title,
    linkFirst: document.querySelector('#linkTab').classList.contains('is-active'),
    logoLoaded: document.querySelector('.wordmark').complete && document.querySelector('.wordmark').naturalWidth > 100,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    inlineAi: Boolean(document.querySelector('#aiInlineToggle')),
    removedQuickAi: !document.querySelector('#aiQuickButton'),
    removedMiniAi: !document.querySelector('#aiMiniCard')
  }))()`);
  if (initial.title !== "RePlant – Same taste. Better planet.") throw new Error("Unexpected title");
  if (!initial.linkFirst) throw new Error("Link input is not the first active option");
  if (!initial.logoLoaded) throw new Error("Wordmark did not load");
  if (initial.overflow) throw new Error("Desktop horizontal overflow");
  if (!initial.inlineAi || !initial.removedQuickAi || !initial.removedMiniAi) throw new Error("AI control layout was not updated");

  await evaluate(client, `(() => {
    document.querySelector('#textTab').click();
    document.querySelector('#exampleButton').click();
    document.querySelector('#convertButton').click();
    return true;
  })()`);
  await waitPage(client, "document.querySelector('#resultCard')?.hidden === false && document.querySelectorAll('#ingredientList > li').length >= 6", "fallback result", 20_000);

  const result = await evaluate(client, `(() => ({
    title: document.querySelector('#resultTitle')?.textContent,
    engine: document.querySelector('#engineBadge')?.textContent,
    ingredients: document.querySelector('#ingredientList')?.textContent,
    steps: document.querySelectorAll('#stepList > li').length,
    substitutions: document.querySelectorAll('#changeList .change-item').length,
    quantityChanges: document.querySelectorAll('#quantityChangeList .quantity-change-item').length,
    history: JSON.parse(localStorage.getItem('replant.history.v4') || '[]').length,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }))()`);
  if (!/vegane Variante/u.test(result.title)) throw new Error("Vegan result title missing");
  if (!/Grundmodus/u.test(result.engine)) throw new Error("Fallback badge missing");
  if (/Pancetta|Speck|Parmesan/u.test(result.ingredients)) throw new Error("Animal ingredients remained");
  if (result.steps < 4 || result.history < 1) throw new Error("Result or local history incomplete");
  if (result.substitutions < 3 || result.quantityChanges < 5) throw new Error("Separated change groups are incomplete");
  if (result.overflow) throw new Error("Desktop result overflow");
  await screenshot(client, "replant-desktop-result.png");

  await evaluate(client, `(() => {
    document.querySelector('[data-view="profiles"]').click();
    document.querySelector('#addProfileButton').click();
    document.querySelector('#profileName').value = 'Manu';
    document.querySelector('#profileAllergyInput').value = 'Gluten, Nüsse';
    document.querySelector('#profileForm').requestSubmit();
    return true;
  })()`);
  await waitPage(client, "document.querySelector('#activeProfileName')?.textContent === 'Manu'", "profile creation");

  await client.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844 });
  await navigate(client, baseUrl);
  await waitPage(client, "document.querySelector('#mobileAvatar')?.textContent === 'M'", "mobile profile restore");
  const mobile = await evaluate(client, `(() => ({
    width: window.innerWidth,
    linkFirst: document.querySelector('#linkTab').classList.contains('is-active'),
    bottomNav: getComputedStyle(document.querySelector('.mobile-bottom-nav')).display,
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1
  }))()`);
  if (mobile.width !== 390 || !mobile.linkFirst || mobile.bottomNav === "none" || mobile.overflow) throw new Error(`Mobile layout failed: ${JSON.stringify(mobile)}`);
  await screenshot(client, "replant-mobile.png");

  const serious = browserProblems.filter((message) => !/favicon|manifest/i.test(message));
  if (serious.length) throw new Error(`Browser console problems:\n${serious.join("\n")}`);

  console.log("UI-Smoke-Test erfolgreich:");
  console.log("- Link-Eingabe ist beim Start aktiv");
  console.log("- RePlant-Logo wurde geladen");
  console.log("- Veganes Beispielrezept wurde umgewandelt");
  console.log("- AI-Schalter ist in die Hauptaktion integriert");
  console.log("- Produktwechsel und Mengenänderungen werden getrennt angezeigt");
  console.log("- Verlauf und neues Profil wurden lokal gespeichert");
  console.log("- Desktop 1440 x 1050 ohne horizontalen Überlauf");
  console.log("- Mobile 390 x 844 ohne horizontalen Überlauf");
  console.log("- Keine relevanten Browser-Konsolenfehler");
} finally {
  try { client?.close(); } catch {}
  if (chrome && !chrome.killed) chrome.kill("SIGTERM");
  if (server && !server.killed) server.kill("SIGTERM");
  await sleep(250);
}
