/**
 * Parse JSON from a fetch Response. If the server returns HTML or plain text (e.g. "Internal Server Error"),
 * throws an Error that includes a short preview instead of JSON.parse's "Unexpected token" noise.
 */
export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    return {} as T;
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const preview = trimmed.slice(0, 400).replace(/\s+/g, " ");
    throw new Error(
      `API response was not JSON (${res.status} ${res.statusText}): ${preview}`,
    );
  }
}
