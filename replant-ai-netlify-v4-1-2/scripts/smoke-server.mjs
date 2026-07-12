import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import convertHandler from "../netlify/functions/convert-recipe.mjs";
import healthHandler from "../netlify/functions/health.mjs";
import importHandler from "../netlify/functions/import-recipe.mjs";

const root = resolve(fileURLToPath(new URL("../public/", import.meta.url)));
const host = process.env.SMOKE_HOST || "127.0.0.1";
const port = Number(process.env.SMOKE_PORT || 4173);
const handlers = new Map([["/api/convert", convertHandler], ["/api/health", healthHandler], ["/api/import", importHandler]]);
const mime = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json; charset=utf-8",
};

async function readBody(request, max = 200_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > max) throw new Error("request too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function serveApi(nodeRequest, nodeResponse, handler) {
  const body = ["GET", "HEAD"].includes(nodeRequest.method) ? undefined : await readBody(nodeRequest);
  const request = new Request(`http://${nodeRequest.headers.host}${nodeRequest.url}`, {
    method: nodeRequest.method,
    headers: nodeRequest.headers,
    body,
  });
  const response = await handler(request);
  nodeResponse.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (nodeRequest.method === "HEAD") return nodeResponse.end();
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
}

async function serveStatic(nodeRequest, nodeResponse, pathname) {
  const requested = decodeURIComponent(pathname) === "/" ? "/index.html" : decodeURIComponent(pathname);
  const safe = normalize(requested).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");
  const filePath = resolve(join(root, safe));
  if (!filePath.startsWith(root)) return nodeResponse.writeHead(403).end("Forbidden");
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    const content = await readFile(filePath);
    nodeResponse.writeHead(200, { "content-type": mime[extname(filePath)] || "application/octet-stream", "cache-control": "no-store" });
    if (nodeRequest.method === "HEAD") nodeResponse.end();
    else nodeResponse.end(content);
  } catch {
    nodeResponse.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const handler = handlers.get(url.pathname);
    if (handler) await serveApi(request, response, handler);
    else await serveStatic(request, response, url.pathname);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" }).end("Server error");
  }
});
server.listen(port, host, () => console.log(`SMOKE_SERVER_READY http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
