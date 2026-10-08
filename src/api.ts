export async function readApiJson(response: Response): Promise<any> {
  const message =
    "The AI endpoint is unavailable. Redeploy the latest Nudge code with its API functions, then configure the server API key and model. Your saved data is unchanged; manual logging still works.";
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error(message);
  try {
    return await response.json();
  } catch {
    throw Error(
      "The AI endpoint returned an unreadable response. Please retry. Your saved data is unchanged.",
    );
  }
}
