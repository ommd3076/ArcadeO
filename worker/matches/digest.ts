/**
 * Computes a deterministic SHA-256 digest of an action and its payload.
 * Recursively sorts keys of objects to guarantee canonical serialization.
 */
export async function computeCanonicalPayloadDigest(
  action: string,
  payload: unknown,
): Promise<string> {
  function canonicalize(val: unknown): unknown {
    if (val === null || typeof val !== "object") {
      return val;
    }
    if (Array.isArray(val)) {
      return val.map(canonicalize);
    }
    const entries = Object.entries(val as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    const sortedObj: Record<string, unknown> = {};
    for (const [k, v] of entries) {
      sortedObj[k] = canonicalize(v);
    }
    return sortedObj;
  }

  const canonicalObj = {
    action,
    payload: canonicalize(payload),
  };

  const jsonStr = JSON.stringify(canonicalObj);
  const data = new TextEncoder().encode(jsonStr);
  const hashBuf = await crypto.subtle.digest("SHA-256", data);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}
