import test from "node:test";
import assert from "node:assert/strict";

import convertHandler from "../netlify/functions/convert-recipe.mjs";
import healthHandler from "../netlify/functions/health.mjs";
import { convertRecipeWithGrok } from "../netlify/functions/_shared/grok-converter.mjs";

const SAMPLE = `Kartoffelgratin\nPortionen: 4\nZutaten\n800 g Kartoffeln\n250 ml Sahne\n100 g Käse\nZubereitung\n1. Kartoffeln schneiden.\n2. Mit Sahne und Käse im Ofen backen.`;

test("Convert-Function liefert ohne API-Key eine vollständige Grundversion", async () => {
  const old = process.env.XAI_API_KEY;
  delete process.env.XAI_API_KEY;
  try {
    const response = await convertHandler(new Request("https://replant.example/api/convert", {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://replant.example" },
      body: JSON.stringify({ recipeText: SAMPLE, mode: "vegan", servings: 2, profile: { allergies: [] } }),
    }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.engine, "fallback");
    assert.equal(body.recipe.servings, 2);
    assert.ok(body.recipe.ingredients.length >= 3);
  } finally {
    if (old === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = old;
  }
});

test("Convert-Function prüft Methode, Ursprung und Pflichtinhalt", async () => {
  let response = await convertHandler(new Request("https://replant.example/api/convert", { method: "GET" }));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");

  response = await convertHandler(new Request("https://replant.example/api/convert", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    body: JSON.stringify({ recipeText: SAMPLE }),
  }));
  assert.equal(response.status, 403);

  response = await convertHandler(new Request("https://replant.example/api/convert", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ recipeText: "kurz" }),
  }));
  assert.equal(response.status, 400);
});

test("Health-Function meldet den verfügbaren Modus", async () => {
  const old = process.env.XAI_API_KEY;
  delete process.env.XAI_API_KEY;
  try {
    const response = await healthHandler(new Request("https://replant.example/api/health"));
    const body = await response.json();
    assert.equal(body.ok, true);
    assert.equal(body.aiAvailable, false);
    assert.equal(body.fallbackAvailable, true);
  } finally {
    if (old === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = old;
  }
});

test("Grok-Adapter sendet den Key serverseitig und liest JSON", async () => {
  let captured;
  const mockRecipe = {
    title: "Kartoffelgratin – vegan",
    summary: "Cremig und nah am Original.",
    mode: "vegan",
    servings: 2,
    fidelityScore: 91,
    ingredients: [{ amount: "400 g", item: "Kartoffeln", note: "" }, { amount: "125 ml", item: "Hafercuisine", note: "" }],
    steps: ["Kartoffeln schneiden.", "Backen."],
    changes: [{ from: "Sahne", to: "Hafercuisine", reason: "Cremigkeit" }],
    warnings: ["Etiketten prüfen."],
    tips: ["Heiß servieren."],
  };
  const result = await convertRecipeWithGrok({ recipeText: SAMPLE, mode: "vegan", servings: 2, profile: {} }, {
    apiKey: "test-secret-key",
    model: "test-model",
    fetchImpl: async (url, options) => {
      captured = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockRecipe) } }] }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(captured.url, "https://api.x.ai/v1/chat/completions");
  assert.equal(captured.options.headers.authorization, "Bearer test-secret-key");
  assert.equal(captured.body.model, "test-model");
  assert.equal(result.recipe.title, mockRecipe.title);
  assert.equal(result.recipe.sourceUrl, "");
});
