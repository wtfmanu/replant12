import { AppError, cleanString, enforceSameOrigin, errorResponse, jsonResponse, methodErrorResponse, readJson, requireMethod } from "./_shared/http.mjs";
import { extractRecipeFromHtml, recipeToPlainText } from "./_shared/recipe-parser.mjs";
import { fetchPublicHtml } from "./_shared/security.mjs";

export default async function handler(request) {
  try {
    requireMethod(request, ["POST"]);
    enforceSameOrigin(request);
    const body = await readJson(request, 8_000);
    const url = cleanString(body.url, 2_048);
    if (!url) throw new AppError("Füge zuerst einen Rezeptlink ein.", 400, "URL_REQUIRED");

    const { html, finalUrl } = await fetchPublicHtml(url);
    const parsed = extractRecipeFromHtml(html, finalUrl);
    const text = parsed.recipe.rawText || recipeToPlainText(parsed.recipe);
    if (!text || text.length < 30) {
      throw new AppError("Auf dieser Seite wurde kein ausreichend lesbares Rezept gefunden. Kopiere den Rezepttext stattdessen direkt.", 422, "RECIPE_NOT_FOUND");
    }

    return jsonResponse({
      ok: true,
      recipe: {
        title: cleanString(parsed.recipe.title, 180) || "Importiertes Rezept",
        text: text.slice(0, 50_000),
        sourceUrl: finalUrl,
        structured: parsed.foundStructuredRecipe,
        servings: cleanString(parsed.recipe.servings, 80),
        author: cleanString(parsed.recipe.author, 120),
      },
    });
  } catch (error) {
    if (error?.code === "METHOD_NOT_ALLOWED") return methodErrorResponse(error, ["POST"]);
    return errorResponse(error, "Der Rezeptlink konnte nicht gelesen werden.");
  }
}
