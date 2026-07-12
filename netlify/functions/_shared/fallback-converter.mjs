import { clampInt, cleanList, cleanString } from "./http.mjs";

const UNIT_PATTERN = "(?:g|kg|mg|ml|l|cl|dl|EL|TL|Pck\.?|Pkg\.?|Dose(?:n)?|Bund|Prise(?:n)?|Stk\.?|Stück|Tasse(?:n)?|Becher|Zehe(?:n)?|Scheibe(?:n)?|Handvoll)";
const INGREDIENT_START = new RegExp(`^(?:(?:ca\\.?|etwa|circa)\\s+)?(?:\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[¼½¾⅓⅔⅛])(?:\\s*(?:-|–|bis)\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:${UNIT_PATTERN})?\\b`, "iu");

const ALLERGEN_ALIASES = Object.freeze({
  gluten: ["gluten", "weizen", "dinkel", "roggen", "gerste", "hafer"],
  soy: ["soja", "soy"],
  nuts: ["nuss", "nüsse", "schalenfrüchte", "mandel", "cashew", "haselnuss", "walnuss", "pistazie", "pekannuss", "macadamia"],
  peanut: ["erdnuss"],
  milk: ["milch", "laktose", "molke", "kasein"],
  egg: ["ei", "eier", "eigelb", "eiweiß", "hühnerei"],
  sesame: ["sesam", "tahini"],
  celery: ["sellerie"],
  mustard: ["senf"],
});

const ALLERGEN_LABELS = Object.freeze({
  gluten: "Gluten", soy: "Soja", nuts: "Schalenfrüchte", peanut: "Erdnuss", milk: "Milch/Laktose",
  egg: "Ei", sesame: "Sesam", celery: "Sellerie", mustard: "Senf",
});

function normalizeSearch(value) {
  return String(value || "").toLocaleLowerCase("de").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function hasAllergy(profile, key) {
  const aliases = ALLERGEN_ALIASES[key] || [key];
  return profile.allergies.some((entry) => {
    const normalized = normalizeSearch(entry);
    const words = normalized.split(/\s+/);
    return aliases.some((alias) => normalized.includes(alias) || words.includes(alias));
  });
}

function dislikes(profile, value) {
  const haystack = normalizeSearch(value);
  return profile.dislikes.some((entry) => {
    const needle = normalizeSearch(entry);
    return needle.length >= 3 && haystack.includes(needle);
  });
}

function choose(profile, options) {
  const allergySafe = (option) => !(option.avoid || []).some((key) => hasAllergy(profile, key));
  const safe = options.filter(allergySafe);
  const preferred = safe.find((option) => !dislikes(profile, option.value));
  return (preferred || safe[0] || { value: "geeignete pflanzliche Alternative ohne die genannten Allergene" }).value;
}

function sanitizeProfile(value = {}) {
  return {
    name: cleanString(value.name, 40) || "Profil",
    allergies: cleanList(value.allergies, 20, 80),
    dislikes: cleanList(value.dislikes, 20, 80),
    cuisines: cleanList(value.cuisines, 20, 80),
    favorites: cleanList(value.favorites, 20, 80),
    notes: cleanString(value.notes, 1000),
  };
}

function stripStepNumber(value) {
  return String(value || "").replace(/^\s*(?:schritt\s*)?\d+\s*[.):\-]\s*/iu, "").trim();
}

export function parseIngredientLine(line) {
  let value = String(line || "").trim().replace(/^[-–•*]\s*/, "");
  if (!value) return { amount: "", item: "", note: "" };
  let note = "";
  const parenthetical = value.match(/\s*\(([^()]*)\)\s*$/u);
  if (parenthetical) {
    note = parenthetical[1].trim();
    value = value.slice(0, parenthetical.index).trim();
  }
  const commaIndex = value.indexOf(",");
  if (commaIndex >= 0) {
    const commaNote = value.slice(commaIndex + 1).trim();
    value = value.slice(0, commaIndex).trim();
    note = [note, commaNote].filter(Boolean).join(", ");
  }
  const amountMatch = value.match(new RegExp(`^((?:(?:ca\\.?|etwa|circa)\\s+)?(?:\\d+(?:[.,]\\d+)?(?:\\s+\\d+\\/\\d+)?|\\d+\\/\\d+|[¼½¾⅓⅔⅛])(?:\\s*(?:-|–|bis)\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:${UNIT_PATTERN})?)\\s+(.+)$`, "iu"));
  if (amountMatch) return { amount: amountMatch[1].trim(), item: amountMatch[2].trim(), note };
  return { amount: "", item: value, note };
}

export function parseRecipeText(text) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n").map((line) => line.trim()).filter(Boolean);
  const title = cleanString(lines.find((line) => !/^(zutaten|zubereitung|anleitung|portionen?|servings?)\b/iu.test(line)) || "Rezept", 180);
  let servings = null;
  for (const line of lines.slice(0, 20)) {
    const match = line.match(/(?:portionen?|servings?|für)\s*:?[\s]*(\d{1,2})/iu) || line.match(/^(\d{1,2})\s+portionen?$/iu);
    if (match) {
      servings = Number(match[1]);
      break;
    }
  }

  const ingredients = [];
  const instructions = [];
  let section = "unknown";
  for (const line of lines) {
    if (/^(zutaten|ingredients?)\s*:??$/iu.test(line)) { section = "ingredients"; continue; }
    if (/^(zubereitung|anleitung|zubereitungsschritte|instructions?|methode)\s*:??$/iu.test(line)) { section = "instructions"; continue; }
    if (/^(portionen?|servings?)\b/iu.test(line) || line === title) continue;
    if (section === "ingredients") {
      ingredients.push(parseIngredientLine(line));
    } else if (section === "instructions") {
      instructions.push(stripStepNumber(line));
    }
  }

  if (!ingredients.length) {
    for (const line of lines.slice(1)) {
      if (INGREDIENT_START.test(line) || /^nach geschmack\b/iu.test(line)) ingredients.push(parseIngredientLine(line));
    }
  }
  if (!instructions.length) {
    const candidates = lines.filter((line) => /^(?:\d+[.)]|schritt\s+\d+)/iu.test(line));
    instructions.push(...candidates.map(stripStepNumber));
  }
  if (!instructions.length) {
    const ingredientItems = new Set(ingredients.map((entry) => normalizeSearch(entry.item)));
    instructions.push(...lines.filter((line) => {
      const normalized = normalizeSearch(line);
      return line !== title && !ingredientItems.has(normalized) && line.length > 35 && /[.!?]$/u.test(line);
    }).slice(0, 30));
  }
  if (!ingredients.length) ingredients.push({ amount: "", item: "Zutaten aus dem Originalrezept", note: "Bitte manuell prüfen" });
  if (!instructions.length) instructions.push("Bereite das Gericht wie im Original zu und verwende dabei die unten genannten pflanzlichen Alternativen.");
  return { title, servings, ingredients: ingredients.slice(0, 100), instructions: instructions.slice(0, 60) };
}

function veganParmesan(profile) {
  return choose(profile, [
    { value: "Cashew-Parmesan", avoid: ["nuts"] },
    { value: "nussfreie Würzmischung aus Hefeflocken und Sonnenblumenkernen" },
  ]);
}

function plantCream(profile) {
  return choose(profile, [
    { value: "Sojacuisine", avoid: ["soy"] },
    { value: "Hafercuisine", avoid: ["gluten"] },
    { value: "Reiscuisine" },
  ]);
}

function plantDrink(profile) {
  return choose(profile, [
    { value: "Sojadrink", avoid: ["soy"] },
    { value: "Haferdrink", avoid: ["gluten"] },
    { value: "Reisdrink" },
  ]);
}

function smokedReplacement(profile) {
  return choose(profile, [
    { value: "Räuchertofu", avoid: ["soy"] },
    { value: "kräftig geröstete Räucherpilze" },
  ]);
}

function chickenReplacement(profile) {
  return choose(profile, [
    { value: "Seitanstreifen", avoid: ["gluten"] },
    { value: "Tofustreifen", avoid: ["soy"] },
    { value: "gebratene Austernpilze" },
  ]);
}

function minceReplacement(profile) {
  return choose(profile, [
    { value: "pflanzliches Hack auf Sojabasis", avoid: ["soy"] },
    { value: "pflanzliches Hack auf Weizenbasis", avoid: ["gluten"] },
    { value: "Mischung aus Linsen und fein gehackten Pilzen" },
  ]);
}

function eggReplacement(profile) {
  return choose(profile, [
    { value: "Aquafaba", avoid: [] },
    { value: "Eiersatz nach Packungsangabe" },
  ]);
}

function replaceItem(item, mode, profile) {
  const original = item;
  const lower = normalizeSearch(item);
  const vegan = mode === "vegan";
  const mustAvoidMilk = hasAllergy(profile, "milk");
  const mustAvoidEgg = hasAllergy(profile, "egg");

  const rules = [
    { test: /\b(pancetta|speck|bacon|schinken)\b/u, to: () => smokedReplacement(profile), reason: "Rauchigkeit und herzhafter Biss bleiben erhalten" },
    { test: /\b(hähnchen|huhn|hühnerbrust|pute|putenbrust)\b/u, to: () => chickenReplacement(profile), reason: "ähnliche Form und Röstaromen" },
    { test: /\b(hackfleisch|rinderhack|schweinehack|faschiertes)\b/u, to: () => minceReplacement(profile), reason: "krümelige Struktur und Umami" },
    { test: /\b(rindfleisch|steak|schweinefleisch|schweinefilet|lamm(?:fleisch)?)\b/u, to: () => choose(profile, [
      { value: "Seitan oder pflanzliche Filetstücke", avoid: ["gluten"] },
      { value: "kräftig marinierte Austernpilze" },
    ]), reason: "Röstaromen und fester Biss" },
    { test: /\b(lachs|thunfisch|fischfilet|kabeljau|sardellen?|anchovis)\b/u, to: () => choose(profile, [
      { value: "marinierte Karottenstreifen mit Nori" },
      { value: "Kräuterseitlinge mit Nori" },
    ]), reason: "salzige Meeresnote ohne Fisch" },
    { test: /\b(garnelen?|shrimps?|krabben?)\b/u, to: () => "Kräuterseitlinge in Garnelenform", reason: "saftige, feste Textur" },
    { test: /\b(gelatine)\b/u, to: () => "Agar-Agar", reason: "pflanzliches Geliermittel" },
    { test: /\b(hühnerbrühe|rinderbrühe|fleischbrühe|fond vom rind|hühnerfond)\b/u, to: () => "kräftige Gemüsebrühe", reason: "gleiche Würzbasis" },
  ];

  if (vegan || mustAvoidMilk) {
    rules.push(
      { test: /\b(parmesan|pecorino)\b/u, to: () => veganParmesan(profile), reason: "würzige, salzige Käsenote" },
      { test: /\b(sahne|schlagobers|crème fraîche|creme fraiche)\b/u, to: () => plantCream(profile), reason: "vergleichbare Cremigkeit" },
      { test: /\b(milch)\b/u, to: () => plantDrink(profile), reason: "gleiche Flüssigkeitsmenge" },
      { test: /\b(butter|butterschmalz)\b/u, to: () => "vegane Butteralternative", reason: "Fett, Glanz und Mundgefühl" },
      { test: /\b(joghurt|griechischer joghurt|quark|topfen)\b/u, to: () => choose(profile, [
        { value: "ungesüßter Sojajoghurt", avoid: ["soy"] },
        { value: "ungesüßter Kokosjoghurt" },
      ]), reason: "Säure und Cremigkeit" },
      { test: /\b(mozzarella|gouda|emmentaler|cheddar|käse)\b/u, to: () => choose(profile, [
        { value: "pflanzliche Käsealternative auf Mandelbasis", avoid: ["nuts"] },
        { value: "nussfreie pflanzliche Käsealternative" },
      ]), reason: "Schmelz und Würze" },
    );
  }
  if (vegan || mustAvoidEgg) {
    rules.push(
      { test: /\b(eier|ei|eigelb|eiweiß)\b/u, to: () => eggReplacement(profile), reason: "Bindung und Cremigkeit ohne Ei" },
      { test: /\b(mayonnaise|mayo)\b/u, to: () => "vegane Mayonnaise", reason: "gleiche Emulsion" },
    );
  }
  if (vegan) rules.push({ test: /\b(honig)\b/u, to: () => "Ahornsirup", reason: "ähnliche Süße und Viskosität" });

  for (const rule of rules) {
    if (rule.test.test(lower)) {
      const replacement = rule.to();
      return { item: replacement, changed: normalizeSearch(replacement) !== lower, from: original, to: replacement, reason: rule.reason };
    }
  }
  return { item: original, changed: false, from: original, to: original, reason: "" };
}

function replaceInStep(step, replacements) {
  let value = step;
  const placeholders = [];
  const escapeRegExp = (input) => input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  for (const [index, change] of replacements.entries()) {
    const token = `__REPLANT_CHANGE_${index}__`;
    let changed = false;
    const exactPattern = new RegExp(escapeRegExp(change.from), "giu");
    value = value.replace(exactPattern, () => {
      changed = true;
      return token;
    });

    if (!changed) {
      for (const word of normalizeSearch(change.from).split(/\s+/).filter((part) => part.length >= 4)) {
        const wordPattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "giu");
        value = value.replace(wordPattern, () => {
          changed = true;
          return token;
        });
      }
    }

    if (changed) placeholders.push([token, change.to]);
  }

  for (const [token, replacement] of placeholders) {
    value = value.replaceAll(token, replacement);
  }
  return value;
}

function parseNumberToken(token) {
  const vulgar = { "¼": .25, "½": .5, "¾": .75, "⅓": 1/3, "⅔": 2/3, "⅛": .125 };
  if (vulgar[token]) return vulgar[token];
  if (/^\d+\/\d+$/u.test(token)) {
    const [a, b] = token.split("/").map(Number);
    return b ? a / b : null;
  }
  const normalized = token.replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value) {
  const rounded = Math.round(value * 100) / 100;
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(rounded);
}

function scaleAmount(amount, factor) {
  if (!amount || factor === 1) return amount;
  const match = amount.match(/^((?:ca\.?|etwa|circa)\s+)?(\d+(?:[.,]\d+)?|\d+\/\d+|[¼½¾⅓⅔⅛])(?:\s+(\d+\/\d+))?(.*)$/iu);
  if (!match) return amount;
  const first = parseNumberToken(match[2]);
  const second = match[3] ? parseNumberToken(match[3]) : 0;
  if (first == null || second == null) return amount;
  return `${match[1] || ""}${formatNumber((first + second) * factor)}${match[4] || ""}`.trim();
}

export function deriveQuantityChanges(recipeText, targetServings) {
  const parsed = parseRecipeText(cleanString(recipeText, 50_000));
  const servings = clampInt(targetServings, 1, 24, 2);
  if (!parsed.servings || parsed.servings <= 0 || parsed.servings === servings) return [];
  const factor = servings / parsed.servings;
  return parsed.ingredients.map((entry) => {
    const scaled = scaleAmount(entry.amount, factor);
    if (!entry.amount || !scaled || scaled === entry.amount) return null;
    return {
      ingredient: cleanString(entry.item, 240),
      from: cleanString(entry.amount, 60),
      to: cleanString(scaled, 60),
    };
  }).filter(Boolean).slice(0, 100);
}

function allergenWarnings(profile, ingredients) {
  const joined = normalizeSearch(ingredients.map((entry) => `${entry.item} ${entry.note}`).join(" "));
  const warnings = ["Keine medizinische Freigabe: Prüfe bei Allergien immer Zutatenlisten, Spurenhinweise und Kreuzkontamination der verwendeten Produkte."];
  for (const [key, aliases] of Object.entries(ALLERGEN_ALIASES)) {
    if (!hasAllergy(profile, key)) continue;
    if (aliases.some((alias) => joined.includes(alias))) {
      warnings.push(`Mögliche Quelle von ${ALLERGEN_LABELS[key] || key} erkannt. Bitte die konkrete Marke und Verpackung besonders prüfen.`);
    }
  }
  return [...new Set(warnings)];
}

export function normalizeConvertedRecipe(value, fallbackSourceUrl = "") {
  const source = value && typeof value === "object" ? value : {};
  const ingredients = Array.isArray(source.ingredients) ? source.ingredients.map((entry) => ({
    amount: cleanString(entry?.amount, 60),
    item: cleanString(entry?.item, 240),
    note: cleanString(entry?.note, 240),
  })).filter((entry) => entry.item).slice(0, 100) : [];
  const steps = Array.isArray(source.steps) ? source.steps.map((entry) => cleanString(typeof entry === "string" ? entry : entry?.text, 1200)).filter(Boolean).slice(0, 60) : [];
  const changes = Array.isArray(source.changes) ? source.changes.map((entry) => ({
    from: cleanString(entry?.from, 200),
    to: cleanString(entry?.to, 200),
    reason: cleanString(entry?.reason, 300),
  })).filter((entry) => entry.from || entry.to).slice(0, 30) : [];
  const quantityChanges = Array.isArray(source.quantityChanges) ? source.quantityChanges.map((entry) => ({
    ingredient: cleanString(entry?.ingredient, 240),
    from: cleanString(entry?.from, 60),
    to: cleanString(entry?.to, 60),
  })).filter((entry) => entry.ingredient && entry.from && entry.to && entry.from !== entry.to).slice(0, 100) : [];
  return {
    title: cleanString(source.title, 180),
    summary: cleanString(source.summary, 500),
    mode: source.mode === "vegetarian" ? "vegetarian" : "vegan",
    servings: clampInt(source.servings, 1, 24, 2),
    fidelityScore: clampInt(source.fidelityScore, 0, 100, 72),
    ingredients,
    steps,
    changes,
    quantityChanges,
    warnings: cleanList(source.warnings, 30, 500),
    tips: cleanList(source.tips, 30, 500),
    sourceUrl: cleanString(fallbackSourceUrl, 2048),
  };
}

export function convertRecipeFallback(input) {
  const mode = input.mode === "vegetarian" ? "vegetarian" : "vegan";
  const profile = sanitizeProfile(input.profile);
  const fidelity = clampInt(input.fidelity, 0, 100, 50);
  const targetServings = clampInt(input.servings, 1, 24, 2);
  const parsed = parseRecipeText(cleanString(input.recipeText, 50_000));
  const scaleFactor = parsed.servings && parsed.servings > 0 ? targetServings / parsed.servings : 1;
  const quantityChanges = deriveQuantityChanges(input.recipeText, targetServings);
  const changes = [];
  const ingredients = parsed.ingredients.map((entry) => {
    const replacement = replaceItem(entry.item, mode, profile);
    if (replacement.changed && !changes.some((change) => normalizeSearch(change.from) === normalizeSearch(replacement.from))) {
      changes.push({ from: replacement.from, to: replacement.to, reason: replacement.reason });
    }
    return {
      amount: scaleAmount(entry.amount, scaleFactor),
      item: replacement.item,
      note: entry.note,
    };
  });
  const steps = parsed.instructions.map((step) => replaceInStep(step, changes));
  const warnings = allergenWarnings(profile, ingredients);
  if (!parsed.servings) warnings.push("Im Original wurde keine eindeutige Portionszahl erkannt. Die Mengen wurden deshalb nicht automatisch skaliert.");
  const score = Math.max(48, Math.min(96, Math.round(96 - changes.length * 3.2 - fidelity * .22)));
  const modeLabel = mode === "vegan" ? "vegane" : "vegetarische";
  const favoriteTip = profile.favorites.length ? `Für deinen Geschmack passen ${profile.favorites.slice(0, 3).join(", ")} gut als optionale Akzente – nur einsetzen, wenn sie zum Original passen.` : "Schmecke erst am Ende nach, damit die Würzung nahe am Original bleibt.";
  const tips = [
    "Bräune Ersatzprodukte kräftig an; Röstaromen gleichen einen großen Teil des herzhaften Geschmacks aus.",
    "Gib pflanzliche Flüssigkeit schrittweise zu, weil Bindung und Wassergehalt je nach Produkt variieren.",
    favoriteTip,
  ];
  if (profile.notes) tips.push(`Profilhinweis: ${profile.notes}`);
  return normalizeConvertedRecipe({
    title: `${parsed.title} – ${modeLabel} Variante`,
    summary: changes.length
      ? `${changes.length} zentrale ${changes.length === 1 ? "Zutat wurde" : "Zutaten wurden"} ersetzt, während Aufbau und Würzung möglichst nah am Original bleiben.`
      : `Das Rezept ist bereits weitgehend ${modeLabel}; nur Mengen und Profilhinweise wurden angepasst.`,
    mode,
    servings: targetServings,
    fidelityScore: score,
    ingredients,
    steps,
    changes,
    quantityChanges,
    warnings,
    tips,
  }, input.sourceUrl);
}
