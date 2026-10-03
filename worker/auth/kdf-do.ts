import { createHmac } from "node:crypto";
import { bytesToHex, hexToBytes, timingSafeEqual } from "./crypto";
import { verifyPassword } from "./kdf";

interface VerificationRequest {
  password: string;
  expectedHash: string;
  salt: string;
  iterations: number;
}

export interface KdfDoEnv {
  AUTH_KDF_DO?: DurableObjectNamespace;
  ENVIRONMENT?: string;
}

/** PBKDF2's one SHA-256 block, computed inside a Durable Object's CPU budget. */
export function derivePbkdf2InDurableObject(
  password: string,
  salt: string,
  iterations: number,
): string {
  if (!Number.isInteger(iterations) || iterations < 600_000 || iterations > 2_000_000) {
    throw new Error("Unsupported password work factor");
  }
  if (!/^[a-f0-9]{32}$/i.test(salt)) throw new Error("Invalid password salt");

  const key = Buffer.from(password, "utf8");
  const firstInput = Buffer.concat([Buffer.from(hexToBytes(salt)), Buffer.from([0, 0, 0, 1])]);
  let block = createHmac("sha256", key).update(firstInput).digest();
  const derived = Buffer.from(block);
  for (let round = 1; round < iterations; round++) {
    block = createHmac("sha256", key).update(block).digest();
    for (let byte = 0; byte < derived.length; byte++) derived[byte] ^= block[byte];
  }
  return bytesToHex(derived);
}

/** This binding is private to the Worker; no route exposes it to browser clients. */
export class AuthKdfDurableObject implements DurableObject {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/verify") {
      return new Response(null, { status: 404 });
    }
    const body = (await request.json()) as VerificationRequest;
    if (
      typeof body.password !== "string" ||
      typeof body.expectedHash !== "string" ||
      typeof body.salt !== "string" ||
      !Number.isInteger(body.iterations)
    ) {
      return new Response(null, { status: 400 });
    }
    const actualHash = derivePbkdf2InDurableObject(body.password, body.salt, body.iterations);
    return Response.json(
      { matches: timingSafeEqual(actualHash, body.expectedHash) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function verifyPasswordOnWorker(
  env: KdfDoEnv,
  password: string,
  expectedHash: string,
  salt: string,
  iterations: number,
): Promise<boolean> {
  if (!env.AUTH_KDF_DO) {
    if (env.ENVIRONMENT === "production") throw new Error("Password verifier binding is missing");
    return verifyPassword(password, expectedHash, salt, iterations);
  }
  const stub = env.AUTH_KDF_DO.get(env.AUTH_KDF_DO.idFromName("account-password-verifier"));
  const response = await stub.fetch("https://auth-kdf.internal/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      password,
      expectedHash,
      salt,
      iterations,
    } satisfies VerificationRequest),
  });
  if (!response.ok) throw new Error("Password verifier failed");
  const result = (await response.json()) as { matches?: unknown };
  if (typeof result.matches !== "boolean")
    throw new Error("Password verifier returned an invalid result");
  return result.matches;
}
