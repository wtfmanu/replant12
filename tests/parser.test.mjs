import test from "node:test";
import assert from "node:assert/strict";

import { decodeHtmlEntities, extractRecipeFromHtml, formatIsoDuration, recipeToPlainText, stripHtmlToText } from "../netlify/functions/_shared/recipe-parser.mjs";

const HTML = `<!doctype html><html><head><script type="application/ld+json">{
  "@context":"https://schema.org",
  "@graph":[
    {"@type":"WebPage","name":"Start"},
    {"@type":"Recipe","name":"Ofenkartoffeln &amp; Dip","description":"Knusprig &amp; einfach","recipeYield":"4 Portionen","prepTime":"PT15M","cookTime":"PT45M","recipeIngredient":["800 g Kartoffeln","2 EL Olivenöl","100 g Joghurt"],"recipeInstructions":[{"@type":"HowToSection","itemListElement":[{"@type":"HowToStep","text":"Kartoffeln schneiden."},{"@type":"HowToStep","text":"Im Ofen backen."}]},{"@type":"HowToStep","text":"Dip verrühren."}],"author":{"name":"Testküche"}}
  ]
}</script></head><body></body></html>`;

test("JSON-LD-Rezept wird aus einem Graphen extrahiert", () => {
  const result = extractRecipeFromHtml(HTML, "https://example.com/rezept");
  assert.equal(result.foundStructuredRecipe, true);
  assert.equal(result.recipe.title, "Ofenkartoffeln & Dip");
  assert.equal(result.recipe.ingredients.length, 3);
  assert.deepEqual(result.recipe.instructions, ["Kartoffeln schneiden.", "Im Ofen backen.", "Dip verrühren."]);
  assert.equal(result.recipe.prepTime, "15 Min.");
  assert.match(result.recipe.rawText, /Zubereitung/u);
});

test("sichtbarer HTML-Text dient als Fallback", () => {
  const html = `<html><head><meta property="og:title" content="Tomatensuppe"><meta name="description" content="Schnell &amp; gut"><script>secret()</script></head><body><main><h1>Tomatensuppe</h1><p>500 g Tomaten</p><p>Alles kochen.</p></main></body></html>`;
  const result = extractRecipeFromHtml(html, "https://example.com/suppe");
  assert.equal(result.foundStructuredRecipe, false);
  assert.equal(result.recipe.title, "Tomatensuppe");
  assert.match(result.recipe.rawText, /500 g Tomaten/u);
  assert.doesNotMatch(result.recipe.rawText, /secret/u);
});

test("Entitäten und Zeitangaben werden robust verarbeitet", () => {
  assert.equal(decodeHtmlEntities("A &amp; B &#x1F331;"), "A & B 🌱");
  assert.equal(decodeHtmlEntities("ungültig: &#x110000;"), "ungültig: &#x110000;");
  assert.equal(formatIsoDuration("P1DT2H30M"), "1 T. 2 Std. 30 Min.");
});

test("Plain-Text-Ausgabe bleibt lesbar", () => {
  const plain = recipeToPlainText({ title: "Test", servings: "2", ingredients: ["1 Tomate"], instructions: ["Schneiden."] });
  assert.equal(plain, "Test\n\nPortionen: 2\n\nZutaten\n1 Tomate\n\nZubereitung\n1. Schneiden.");
  assert.equal(stripHtmlToText("<main><h1>Titel</h1><p>Zeile</p></main>"), "Titel\nZeile");
});
