import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { AppError } from "./http.mjs";

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan", ".corp", ".test", ".invalid"];
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);

export function isPrivateIp(address) {
  const value = String(address || "").trim().toLowerCase().split("%")[0];
  const family = isIP(value);
  if (!family) return true;

  if (family === 4) {
    const parts = value.split(".").map(Number);
    const [a, b, c] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (value === "::" || value === "::1") return true;
  if (value.startsWith("::ffff:")) return isPrivateIp(value.slice(7));
  const first = Number.parseInt(value.split(":")[0] || "0", 16);
  return (
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xffc0) === 0xfec0 ||
    (first & 0xff00) === 0xff00 ||
    value.startsWith("2001:db8:") ||
    value.startsWith("2001:10:")
  );
}

export async function validatePublicUrl(input, resolver = lookup) {
  let url;
  try {
    url = new URL(String(input || "").trim());
  } catch {
    throw new AppError("Der Link ist keine gültige URL.", 400, "INVALID_URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError("Nur http- und https-Links sind erlaubt.", 400, "INVALID_URL_PROTOCOL");
  }
  if (url.username || url.password) {
    throw new AppError("Links mit Zugangsdaten sind nicht erlaubt.", 400, "URL_CREDENTIALS_REJECTED");
  }
  if (url.port && !((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443"))) {
    throw new AppError("Ungewöhnliche Netzwerkports sind nicht erlaubt.", 400, "URL_PORT_REJECTED");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) {
    throw new AppError("Lokale oder interne Adressen sind nicht erlaubt.", 400, "PRIVATE_HOST_REJECTED");
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new AppError("Private oder reservierte IP-Adressen sind nicht erlaubt.", 400, "PRIVATE_IP_REJECTED");
    return url;
  }

  let addresses;
  try {
    addresses = await resolver(hostname, { all: true, verbatim: true });
  } catch {
    throw new AppError("Die Adresse konnte nicht aufgelöst werden.", 422, "DNS_LOOKUP_FAILED");
  }
  if (!Array.isArray(addresses) || !addresses.length || addresses.some((entry) => isPrivateIp(entry.address))) {
    throw new AppError("Der Link verweist auf ein nicht erlaubtes Netzwerkziel.", 400, "PRIVATE_IP_REJECTED");
  }
  return url;
}

async function readLimitedText(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new AppError("Die Rezeptseite ist zu groß.", 422, "REMOTE_PAGE_TOO_LARGE");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new AppError("Die Rezeptseite ist zu groß.", 422, "REMOTE_PAGE_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export async function fetchPublicHtml(input, options = {}) {
  const {
    resolver = lookup,
    fetchImpl = fetch,
    timeoutMs = 10_000,
    maxBytes = 2_000_000,
    maxRedirects = 4,
  } = options;

  const deadline = Date.now() + timeoutMs;
  let current = await validatePublicUrl(input, resolver);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AppError("Die Rezeptseite hat zu lange geantwortet.", 422, "REMOTE_TIMEOUT");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), remaining);
    let response;
    try {
      response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: "text/html,application/xhtml+xml;q=0.9",
          "accept-language": "de,en;q=0.7",
          "user-agent": "RePlantRecipeImporter/1.0 (+https://www.netlify.com/)",
        },
      });
    } catch (error) {
      if (error?.name === "AbortError") throw new AppError("Die Rezeptseite hat zu lange geantwortet.", 422, "REMOTE_TIMEOUT");
      throw new AppError("Die Rezeptseite konnte nicht abgerufen werden.", 422, "REMOTE_FETCH_FAILED");
    } finally {
      clearTimeout(timer);
    }

    if (REDIRECT_STATUS.has(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!location) throw new AppError("Die Rezeptseite leitet ohne Ziel weiter.", 422, "REMOTE_REDIRECT_INVALID");
      if (redirects === maxRedirects) throw new AppError("Die Rezeptseite leitet zu oft weiter.", 422, "REMOTE_TOO_MANY_REDIRECTS");
      current = await validatePublicUrl(new URL(location, current).href, resolver);
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new AppError(`Die Rezeptseite antwortet mit HTTP ${response.status}.`, 422, "REMOTE_HTTP_ERROR");
    }
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (type && !type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      await response.body?.cancel().catch(() => {});
      throw new AppError("Der Link führt nicht zu einer HTML-Seite.", 422, "REMOTE_CONTENT_TYPE_REJECTED");
    }
    const html = await readLimitedText(response, maxBytes);
    return { html, finalUrl: current.href, contentType: type };
  }
  throw new AppError("Die Rezeptseite konnte nicht geladen werden.", 422, "REMOTE_FETCH_FAILED");
}
