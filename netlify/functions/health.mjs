import { jsonResponse, methodErrorResponse, requireMethod } from "./_shared/http.mjs";
import { GROK_DEFAULT_MODEL } from "./_shared/grok-converter.mjs";

export default async function handler(request) {
  try {
    requireMethod(request, ["GET"]);
    const aiAvailable = Boolean(process.env.XAI_API_KEY?.trim());
    return jsonResponse({
      ok: true,
      app: "RePlant",
      version: "3.0.0",
      aiAvailable,
      model: aiAvailable ? (process.env.XAI_MODEL?.trim() || GROK_DEFAULT_MODEL) : "rule-based",
      fallbackAvailable: true,
    });
  } catch (error) {
    return methodErrorResponse(error, ["GET"]);
  }
}
