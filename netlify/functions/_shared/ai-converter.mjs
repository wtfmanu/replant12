import { AppError, clampInt, cleanList, cleanString } from "./http.mjs";
import { deriveQuantityChanges, normalizeConvertedRecipe } from "./fallback-converter.mjs";

const XAI_ENDPOINT = "https://api.x.ai/v1/chat/completions";
const DEFAULT_MODEL = "\x67\x72\x6f\x6b-4-fast-reasoning";

function sanitizeProfile(value = {}) {
  return {
    name: cleanString(value.name, 40),
    allergies: cleanList(value.allergies, 20, 80),
    dislikes: cleanList(value.dislikes, 20, 80),
    cuisines: cleanList(value.cuisines, 20, 80),
    favorites: cleanList(value.favorites, 20, 80),
    notes: cleanString(value.notes, 1000),
  };
}

function extractJson(text) {
  const raw = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(raw);
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) return JSON.parse(raw.slice(first, last + 1));
    throw new Error("no JSON object");
  }
}

export async function convertRecipeWithAi(input, options = {}) {
  const apiKey = String(options.apiKey || process.env.XAI_API_KEY || "").trim();
  if (!apiKey) throw new AppError("AI ist noch nicht eingerichtet.", 503, "AI_NOT_CONFIGURED");
  const model = String(options.model || process.env.XAI_MODEL || DEFAULT_MODEL).trim().slice(0, 120) || DEFAULT_MODEL;
  const mode = input.mode === "vegetarian" ? "vegetarian" : "vegan";
  const profile = sanitizeProfile(input.profile);
  const servings = clampInt(input.servings, 1, 24, 2);
  const fidelity = clampInt(input.fidelity, 0, 100, 50);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  const system = `Du bist RePlant, ein präziser deutschsprachiger Rezeptentwickler. Verwandle ein Originalrezept in eine ${mode === "vegan" ? "vegane" : "vegetarische"} Variante. Das Ergebnis muss kulinarisch plausibel, alltagstauglich und so nah am Original wie möglich sein.

Regeln:
- Erhalte Titelidee, Gewürzprofil, Gartechnik, Reihenfolge und charakteristische Textur, soweit das Ziel dies zulässt.
- Ersetze nur Zutaten, die für das Ziel oder die Profilangaben ungeeignet sind.
- Allergien und Unverträglichkeiten sind harte Ausschlüsse. Schlage keine Alternative vor, die sie enthält.
- Abneigungen vermeiden. Lieblingszutaten nur einsetzen, wenn sie wirklich zum Gericht passen.
- Passe Mengen auf ${servings} Portionen an.
- Der Kreativitätswert ist ${fidelity}/100: 0 bedeutet maximal originalgetreu, 100 erlaubt eine freiere, aber erkennbare Interpretation.
- Keine Gesundheitsversprechen. Weise bei Allergien auf Etiketten, Spuren und Kreuzkontamination hin.
- Antworte ausschließlich mit einem gültigen JSON-Objekt. Kein Markdown, kein Kommentar.

JSON-Struktur:
{
  "title": "string",
  "summary": "string",
  "mode": "${mode}",
  "servings": ${servings},
  "fidelityScore": 0,
  "ingredients": [{"amount":"string","item":"string","note":"string"}],
  "steps": ["string"],
  "changes": [{"from":"string","to":"string","reason":"string"}],
  "warnings": ["string"],
  "tips": ["string"]
}`;

  const user = JSON.stringify({
    recipe: cleanString(input.recipeText, 50_000),
    target: mode,
    servings,
    creativity: fidelity,
    profile,
  });

  let response;
  try {
    response = await (options.fetchImpl || fetch)(XAI_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.2,
        stream: false,
        response_format: { type: "json_object" },
      }),
    });
  } catch (error) {
    if (error?.name === "AbortError") throw new AppError("Der AI-Dienst hat zu lange für eine Antwort gebraucht.", 504, "AI_TIMEOUT");
    throw new AppError("Der AI-Dienst konnte nicht erreicht werden.", 502, "AI_NETWORK_ERROR");
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  if (!response.ok) {
    let message = "Der AI-Dienst hat die Anfrage abgelehnt.";
    try {
      const parsed = JSON.parse(raw);
      const apiMessage = cleanString(parsed?.error?.message, 300);
      if (response.status === 401 || response.status === 403) message = "Der AI-API-Key wurde nicht akzeptiert.";
      else if (response.status === 429) message = "Das AI-Limit wurde erreicht. Bitte später erneut versuchen.";
      else if (apiMessage) message = apiMessage;
    } catch {
      // Keep the safe generic message.
    }
    throw new AppError(message, 502, "AI_API_ERROR");
  }

  let payload;
  try {
    const data = JSON.parse(raw);
    payload = extractJson(data?.choices?.[0]?.message?.content);
  } catch {
    throw new AppError("Der AI-Dienst hat kein gültiges Rezeptformat geliefert.", 502, "AI_RESPONSE_INVALID");
  }
  const recipe = normalizeConvertedRecipe({
    ...payload,
    quantityChanges: deriveQuantityChanges(input.recipeText, servings),
  }, input.sourceUrl);
  if (!recipe.title || recipe.ingredients.length < 2 || recipe.steps.length < 1) {
    throw new AppError("Die AI-Antwort war unvollständig.", 502, "AI_RESPONSE_INCOMPLETE");
  }
  return { recipe, model };
}

export const AI_DEFAULT_MODEL = DEFAULT_MODEL;
