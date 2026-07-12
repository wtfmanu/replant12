import { AppError, clampInt, cleanList, cleanString, enforceSameOrigin, errorResponse, jsonResponse, methodErrorResponse, readJson, requireMethod } from "./_shared/http.mjs";
import { convertRecipeFallback } from "./_shared/fallback-converter.mjs";
import { convertRecipeWithAi } from "./_shared/ai-converter.mjs";

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

export default async function handler(request) {
  try {
    requireMethod(request, ["POST"]);
    enforceSameOrigin(request);
    const body = await readJson(request, 80_000);
    const recipeText = cleanString(body.recipeText, 50_000);
    if (recipeText.length < 30) {
      throw new AppError("Der Rezepttext ist zu kurz. Füge Zutaten und Zubereitung ein.", 400, "RECIPE_REQUIRED");
    }

    const input = {
      recipeText,
      sourceUrl: cleanString(body.sourceUrl, 2_048),
      mode: body.mode === "vegetarian" ? "vegetarian" : "vegan",
      servings: clampInt(body.servings, 1, 24, 2),
      fidelity: clampInt(body.fidelity, 0, 100, 50),
      profile: sanitizeProfile(body.profile),
    };

    if (body.useAi === true && process.env.XAI_API_KEY?.trim()) {
      try {
        const result = await convertRecipeWithAi(input);
        return jsonResponse({ ok: true, engine: "ai", model: result.model, recipe: result.recipe });
      } catch (aiError) {
        console.error("AI conversion failed; using fallback:", aiError?.code || aiError?.message);
        const recipe = convertRecipeFallback(input);
        recipe.warnings.unshift("Die AI-Umwandlung war vorübergehend nicht verfügbar. RePlant hat deshalb den regelbasierten Grundmodus verwendet.");
        return jsonResponse({ ok: true, engine: "fallback", aiFallback: true, recipe });
      }
    }

    return jsonResponse({ ok: true, engine: "fallback", recipe: convertRecipeFallback(input) });
  } catch (error) {
    if (error?.code === "METHOD_NOT_ALLOWED") return methodErrorResponse(error, ["POST"]);
    return errorResponse(error, "Das Rezept konnte nicht umgewandelt werden.");
  }
}
