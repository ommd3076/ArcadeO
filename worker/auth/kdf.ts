import { bytesToHex, hexToBytes, timingSafeEqual } from "./crypto";

export const DEFAULT_KDF_ALGORITHM = "PBKDF2-SHA256:600000";
export const DEFAULT_ITERATIONS = 600_000;
export const SALT_BYTE_LENGTH = 16;
export const KEY_BYTE_LENGTH = 32;

export interface KdfHashResult {
  passwordHash: string;
  salt: string;
  kdfAlgorithm: string;
}

/**
 * Derives a key using Web Crypto PBKDF2 with HMAC-SHA256.
 */
export async function derivePbkdf2Key(
  password: string,
  saltBytes: Uint8Array,
  iterations: number,
  keyByteLength = KEY_BYTE_LENGTH,
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password) as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: saltBytes as unknown as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    passwordKey,
    keyByteLength * 8,
  );

  return new Uint8Array(derivedBits);
}

/**
 * Hashes a password with PBKDF2-SHA256 using 600,000 iterations and a 16-byte random salt.
 */
export async function hashPassword(
  password: string,
  saltBytes?: Uint8Array,
  iterations = DEFAULT_ITERATIONS,
): Promise<KdfHashResult> {
  const salt = saltBytes ?? crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const derivedKey = await derivePbkdf2Key(password, salt, iterations, KEY_BYTE_LENGTH);

  return {
    passwordHash: bytesToHex(derivedKey),
    salt: bytesToHex(salt),
    kdfAlgorithm: `PBKDF2-SHA256:${iterations}`,
  };
}

/**
 * Verifies a password against an expected hash and salt.
 */
export async function verifyPassword(
  password: string,
  expectedHash: string,
  saltHex: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<boolean> {
  try {
    const saltBytes = hexToBytes(saltHex);
    const derivedKey = await derivePbkdf2Key(password, saltBytes, iterations, KEY_BYTE_LENGTH);
    const actualHash = bytesToHex(derivedKey);
    return timingSafeEqual(actualHash, expectedHash);
  } catch {
    return false;
  }
}

/**
 * Benchmark KDF performance (measure time in milliseconds).
 */
export async function benchmarkKdf(
  iterations = DEFAULT_ITERATIONS,
  trials = 1,
): Promise<{ durationMs: number; iterations: number }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTE_LENGTH));
  const start = performance.now();
  for (let i = 0; i < trials; i++) {
    await derivePbkdf2Key("benchmark-qualification-pass", salt, iterations, KEY_BYTE_LENGTH);
  }
  const durationMs = (performance.now() - start) / trials;
  return { durationMs, iterations };
}
