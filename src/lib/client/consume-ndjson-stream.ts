/**
 * Read a fetch response body as newline-delimited JSON events.
 */
export async function consumeNdjsonStream<T>(
  res: Response,
  onEvent: (event: T) => void,
): Promise<void> {
  if (!res.body) {
    throw new Error(`No response body (${res.status} ${res.statusText})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      onEvent(JSON.parse(trimmed) as T);
    }
  }

  buffer += decoder.decode();
  const tail = buffer.trim();
  if (tail) {
    onEvent(JSON.parse(tail) as T);
  }
}
