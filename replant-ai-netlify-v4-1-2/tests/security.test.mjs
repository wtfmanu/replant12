import test from "node:test";
import assert from "node:assert/strict";

import { fetchPublicHtml, isPrivateIp, validatePublicUrl } from "../netlify/functions/_shared/security.mjs";

const publicResolver = async () => [{ address: "93.184.216.34", family: 4 }];

test("private und reservierte IP-Adressen werden blockiert", () => {
  for (const ip of ["0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.1.1", "172.16.0.1", "192.168.1.1", "198.18.0.1", "203.0.113.1", "::1", "fd00::1", "fe80::1", "2001:db8::1", "::ffff:127.0.0.1", "not-an-ip"]) {
    assert.equal(isPrivateIp(ip), true, ip);
  }
  assert.equal(isPrivateIp("93.184.216.34"), false);
  assert.equal(isPrivateIp("2606:4700:4700::1111"), false);
});

test("öffentliche URLs werden akzeptiert", async () => {
  const url = await validatePublicUrl("https://example.com/rezept?x=1", publicResolver);
  assert.equal(url.href, "https://example.com/rezept?x=1");
});

test("gefährliche URL-Varianten werden abgelehnt", async () => {
  await assert.rejects(() => validatePublicUrl("file:///etc/passwd", publicResolver), { code: "INVALID_URL_PROTOCOL" });
  await assert.rejects(() => validatePublicUrl("https://user:pass@example.com/", publicResolver), { code: "URL_CREDENTIALS_REJECTED" });
  await assert.rejects(() => validatePublicUrl("https://example.com:8443/", publicResolver), { code: "URL_PORT_REJECTED" });
  await assert.rejects(() => validatePublicUrl("http://localhost/", publicResolver), { code: "PRIVATE_HOST_REJECTED" });
  await assert.rejects(() => validatePublicUrl("http://192.168.1.2/", publicResolver), { code: "PRIVATE_IP_REJECTED" });
});

test("Abruf folgt kontrolliert einer öffentlichen Weiterleitung", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url.href);
    if (calls.length === 1) return new Response(null, { status: 302, headers: { location: "/final" } });
    return new Response("<html><body><h1>Rezept</h1></body></html>", { status: 200, headers: { "content-type": "text/html" } });
  };
  const result = await fetchPublicHtml("https://example.com/start", { resolver: publicResolver, fetchImpl });
  assert.deepEqual(calls, ["https://example.com/start", "https://example.com/final"]);
  assert.equal(result.finalUrl, "https://example.com/final");
});

test("Nicht-HTML und zu große Seiten werden abgewiesen", async () => {
  await assert.rejects(() => fetchPublicHtml("https://example.com/file", {
    resolver: publicResolver,
    fetchImpl: async () => new Response("PDF", { headers: { "content-type": "application/pdf" } }),
  }), { code: "REMOTE_CONTENT_TYPE_REJECTED" });
  await assert.rejects(() => fetchPublicHtml("https://example.com/huge", {
    resolver: publicResolver,
    maxBytes: 5,
    fetchImpl: async () => new Response("123456", { headers: { "content-type": "text/html", "content-length": "6" } }),
  }), { code: "REMOTE_PAGE_TOO_LARGE" });
});
