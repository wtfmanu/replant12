const BASE_HEADERS = Object.freeze({
  "cache-control": "no-store, max-age=0",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
});

export class AppError extends Error {
  constructor(message, status = 400, code = "BAD_REQUEST", details) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...BASE_HEADERS, ...headers },
  });
}

export function errorResponse(error, fallbackMessage = "Die Anfrage konnte nicht verarbeitet werden.") {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = typeof error?.code === "string" ? error.code : "INTERNAL_ERROR";
  const message = status >= 500 ? fallbackMessage : String(error?.message || fallbackMessage);
  const body = { ok: false, error: { code, message } };
  if (status < 500 && error?.details !== undefined) body.error.details = error.details;
  return jsonResponse(body, status);
}

export function requireMethod(request, allowed = ["POST"]) {
  if (!allowed.includes(request.method)) {
    throw new AppError("Methode nicht erlaubt.", 405, "METHOD_NOT_ALLOWED", { allowed });
  }
}

export function methodErrorResponse(error, allowed = ["POST"]) {
  if (error?.code !== "METHOD_NOT_ALLOWED") return errorResponse(error);
  return jsonResponse({ ok: false, error: { code: error.code, message: error.message, details: { allowed } } }, 405, {
    allow: allowed.join(", "),
  });
}

export function enforceSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originUrl;
  let requestUrl;
  try {
    originUrl = new URL(origin);
    requestUrl = new URL(request.url);
  } catch {
    throw new AppError("Ungültiger Anfrageursprung.", 403, "ORIGIN_REJECTED");
  }
  if (originUrl.origin !== requestUrl.origin) {
    throw new AppError("Anfragen von dieser Website sind nicht erlaubt.", 403, "ORIGIN_REJECTED");
  }
}

export async function readJson(request, maxBytes = 80_000) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new AppError("Erwartet wird JSON.", 415, "UNSUPPORTED_MEDIA_TYPE");
  }
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AppError("Die Anfrage ist zu groß.", 413, "REQUEST_TOO_LARGE");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new AppError("Die Anfrage ist zu groß.", 413, "REQUEST_TOO_LARGE");
  }
  try {
    const value = JSON.parse(text || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value;
  } catch {
    throw new AppError("Ungültige JSON-Daten.", 400, "INVALID_JSON");
  }
}

export function cleanString(value, maxLength = 1_000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

export function cleanList(value, maxItems = 20, maxLength = 120) {
  const entries = Array.isArray(value) ? value : String(value ?? "").split(/[,;\n]/);
  return [...new Set(entries.map((entry) => cleanString(entry, maxLength)).filter(Boolean))].slice(0, maxItems);
}

export function clampInt(value, min, max, fallback) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
