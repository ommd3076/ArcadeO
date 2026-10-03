import { env } from "cloudflare:workers";
import { expect, it } from "vitest";
import { verifyPasswordOnWorker } from "../../worker/auth/kdf-do";

it("verifies an existing 600,000-round hash inside the real Durable Object", async () => {
  const binding = { AUTH_KDF_DO: env.AUTH_KDF_DO, ENVIRONMENT: "production" };
  const salt = "000102030405060708090a0b0c0d0e0f";
  const hash = "51060a247a88153918bfcd5dcaf6199fcc62aebd0eea4d74155257b6c8d045dd";
  expect(
    await verifyPasswordOnWorker(binding, "runtime-pbkdf2-regression", hash, salt, 600_000),
  ).toBe(true);
  expect(await verifyPasswordOnWorker(binding, "wrong-password", hash, salt, 600_000)).toBe(false);
});
