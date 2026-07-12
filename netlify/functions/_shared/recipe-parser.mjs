const NAMED_ENTITIES = Object.freeze({
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  auml: "ä", Auml: "Ä", ouml: "ö", Ouml: "Ö", uuml: "ü", Uuml: "Ü", szlig: "ß",
});

export function decodeHtmlEntities(value) {
  return String(value || "").replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const number = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      const valid = Number.isInteger(number) && number >= 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff);
      return valid ? String.fromCodePoint(number) : match;
    }
    return NAMED_ENTITIES[entity] ?? NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function stripHtmlToText(html, maxLength = 50_000) {
  return decodeHtmlEntities(String(html || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|canvas|nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/article|\/tr)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function typeIncludesRecipe(value) {
  return asArray(value).some((type) => String(type).toLowerCase() === "recipe");
}

function collectRecipeNodes(value, output = [], seen = new Set(), depth = 0) {
  if (!value || typeof value !== "object" || seen.has(value) || depth > 40) return output;
  seen.add(value);
  if (typeIncludesRecipe(value["@type"])) output.push(value);
  if (Array.isArray(value)) {
    for (const item of value) collectRecipeNodes(item, output, seen, depth + 1);
  } else {
    for (const child of Object.values(value)) collectRecipeNodes(child, output, seen, depth + 1);
  }
  return output;
}

function flattenInstructions(value, output = [], depth = 0) {
  if (depth > 40) return output;
  for (const entry of asArray(value)) {
    if (!entry) continue;
    if (typeof entry === "string") {
      const lines = stripTags(entry).split(/\n+/).map((line) => line.trim()).filter(Boolean);
      output.push(...lines);
      continue;
    }
    if (Array.isArray(entry)) {
      flattenInstructions(entry, output, depth + 1);
      continue;
    }
    if (typeof entry === "object") {
      const type = String(asArray(entry["@type"])[0] || "").toLowerCase();
      if (type === "howtosection" || entry.itemListElement || entry.steps) {
        flattenInstructions(entry.itemListElement || entry.steps, output, depth + 1);
      } else {
        const text = stripTags(entry.text || entry.name || entry.description || "");
        if (text) output.push(text);
      }
    }
  }
  return output;
}

export function formatIsoDuration(value) {
  const text = String(value || "").trim();
  const match = text.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i);
  if (!match) return text;
  const parts = [];
  if (match[1]) parts.push(`${Number(match[1])} T.`);
  if (match[2]) parts.push(`${Number(match[2])} Std.`);
  if (match[3]) parts.push(`${Number(match[3])} Min.`);
  if (match[4]) parts.push(`${Number(match[4])} Sek.`);
  return parts.join(" ");
}

function firstValue(value) {
  const item = asArray(value)[0];
  if (item && typeof item === "object") return item.name || item.url || item.contentUrl || "";
  return item || "";
}

function readMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decodeHtmlEntities(match[1]).trim();
  }
  return "";
}

function nodeScore(node) {
  return asArray(node.recipeIngredient).length * 4 + flattenInstructions(node.recipeInstructions).length * 4 + (node.name ? 2 : 0);
}

function normalizeRecipeNode(node, sourceUrl) {
  const ingredients = asArray(node.recipeIngredient).map((entry) => stripTags(entry)).filter(Boolean).slice(0, 120);
  const instructions = flattenInstructions(node.recipeInstructions).map((entry) => entry.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean).slice(0, 80);
  return {
    title: stripTags(node.name || node.headline || "") || "Importiertes Rezept",
    description: stripTags(node.description || ""),
    ingredients,
    instructions,
    servings: stripTags(firstValue(node.recipeYield)),
    prepTime: formatIsoDuration(node.prepTime),
    cookTime: formatIsoDuration(node.cookTime),
    totalTime: formatIsoDuration(node.totalTime),
    author: stripTags(firstValue(node.author)),
    image: String(firstValue(node.image) || "").slice(0, 2048),
    sourceUrl,
  };
}

export function recipeToPlainText(recipe) {
  const lines = [recipe.title];
  if (recipe.description) lines.push("", recipe.description);
  if (recipe.servings) lines.push("", `Portionen: ${recipe.servings}`);
  if (recipe.ingredients?.length) lines.push("", "Zutaten", ...recipe.ingredients);
  if (recipe.instructions?.length) lines.push("", "Zubereitung", ...recipe.instructions.map((step, index) => `${index + 1}. ${step}`));
  return lines.join("\n").trim().slice(0, 50_000);
}

export function extractRecipeFromHtml(html, sourceUrl) {
  const nodes = [];
  const scriptPattern = /<script\b[^>]*type=["']application\/ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of String(html || "").matchAll(scriptPattern)) {
    const candidate = decodeHtmlEntities(match[1]).replace(/^\s*<!--|-->\s*$/g, "").trim();
    if (!candidate) continue;
    try {
      collectRecipeNodes(JSON.parse(candidate), nodes);
    } catch {
      // Many sites contain unrelated malformed JSON-LD. Continue with other blocks.
    }
  }

  if (nodes.length) {
    nodes.sort((a, b) => nodeScore(b) - nodeScore(a));
    const recipe = normalizeRecipeNode(nodes[0], sourceUrl);
    return { foundStructuredRecipe: true, recipe: { ...recipe, rawText: recipeToPlainText(recipe) } };
  }

  const title = readMeta(html, "og:title") || readMeta(html, "twitter:title") || stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") || "Importiertes Rezept";
  const description = readMeta(html, "description") || readMeta(html, "og:description");
  const rawText = stripHtmlToText(html, 50_000);
  return {
    foundStructuredRecipe: false,
    recipe: {
      title,
      description,
      ingredients: [],
      instructions: [],
      servings: "",
      prepTime: "",
      cookTime: "",
      totalTime: "",
      author: "",
      image: "",
      sourceUrl,
      rawText: [title, description, rawText].filter(Boolean).join("\n\n").slice(0, 50_000),
    },
  };
}
