import test from "node:test";
import assert from "node:assert/strict";

import { convertRecipeFallback, parseIngredientLine, parseRecipeText } from "../netlify/functions/_shared/fallback-converter.mjs";

const CARBONARA = `Spaghetti Carbonara

Portionen: 4

Zutaten
400 g Spaghetti
200 g Pancetta oder Speck, gewürfelt
4 Eier
100 g Parmesan, fein gerieben
1 EL Olivenöl
Salz
Schwarzer Pfeffer

Zubereitung
1. Spaghetti in Salzwasser al dente kochen.
2. Pancetta knusprig braten.
3. Eier mit Parmesan und Pfeffer verquirlen.
4. Alles cremig vermengen.`;

function searchText(recipe) {
  return [...recipe.ingredients.map((entry) => `${entry.amount} ${entry.item} ${entry.note}`), ...recipe.steps].join(" ").toLowerCase();
}

test("vegane Carbonara berücksichtigt eine Soja-Allergie", () => {
  const result = convertRecipeFallback({
    recipeText: CARBONARA,
    mode: "vegan",
    servings: 2,
    fidelity: 20,
    profile: { allergies: ["Soja"], dislikes: [] },
  });
  const text = searchText(result);
  assert.equal(result.mode, "vegan");
  assert.equal(result.servings, 2);
  assert.doesNotMatch(text, /\b(?:pancetta|speck|eier)\b/u);
  assert.match(text, /cashew-parmesan|nussfreie würzmischung/u);
  assert.doesNotMatch(text, /tofu/u);
  assert.match(text, /räucherpilze/u);
  assert.match(text, /aquafaba|eiersatz/u);
  assert.equal(result.ingredients[0].amount, "200 g");
  assert.ok(result.changes.length >= 3);
  assert.ok(result.warnings.some((warning) => /keine medizinische freigabe/i.test(warning)));
});

test("vegetarischer Modus lässt Ei zu und ersetzt Fleisch", () => {
  const result = convertRecipeFallback({ recipeText: CARBONARA, mode: "vegetarian", servings: 4, profile: {} });
  const text = searchText(result);
  assert.match(text, /eier/u);
  assert.doesNotMatch(text, /pancetta|speck/u);
});

test("Milch- und Ei-Allergien gelten auch vegetarisch", () => {
  const result = convertRecipeFallback({
    recipeText: `Pfannkuchen\nZutaten\n250 ml Milch\n2 Eier\n30 g Butter\n150 g Mehl\nZubereitung\n1. Milch, Eier, Butter und Mehl verrühren.\n2. Ausbacken.`,
    mode: "vegetarian",
    servings: 2,
    profile: { allergies: ["Milch/Laktose", "Ei"] },
  });
  const text = searchText(result);
  assert.doesNotMatch(text, /\bmilch\b|\beier\b|\bbutter\b/u);
  assert.match(text, /drink/u);
  assert.match(text, /aquafaba|eiersatz/u);
  assert.match(text, /vegane butteralternative/u);
});

test("Zutatenparser trennt Menge, Zutat und Notiz", () => {
  assert.deepEqual(parseIngredientLine("1 1/2 EL Olivenöl, zum Braten"), {
    amount: "1 1/2 EL",
    item: "Olivenöl",
    note: "zum Braten",
  });
  assert.deepEqual(parseIngredientLine("4 Eier (Größe M)"), {
    amount: "4",
    item: "Eier",
    note: "Größe M",
  });
});

test("Rezeptparser erkennt Titel, Portionen und Schritte", () => {
  const result = parseRecipeText(CARBONARA);
  assert.equal(result.title, "Spaghetti Carbonara");
  assert.equal(result.servings, 4);
  assert.equal(result.ingredients.length, 7);
  assert.equal(result.instructions.length, 4);
});
