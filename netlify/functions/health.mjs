import { jsonResponse, methodErrorResponse, requireMethod } from "./_shared/http.mjs";

export default async function handler(request) {
  try {
    requireMethod(request, ["GET"]);
    const aiAvailable = Boolean(process.env.XAI_API_KEY?.trim());
    return jsonResponse({
      ok: true,
      app: "RePlant",
      version: "4.0.0",
      aiAvailable,
      fallbackAvailable: true,
    });
  } catch (error) {
    return methodErrorResponse(error, ["GET"]);
  }
}
