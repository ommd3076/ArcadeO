import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";
export const origin = "http://localhost:8789";
export async function login(page: Page, seat: "A" | "B") {
  const a = JSON.parse(fs.readFileSync(".local/browser-accounts.json", "utf8"));
  await page.goto("/login");
  await page.getByLabel(/account|username/i).fill(a[`player${seat}User`]);
  await page.getByLabel(/^password$/i).fill(a[`player${seat}Password`]);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/login/);
  const r = await page.request.get("/api/v1/auth/session");
  const auth = await r.json();
  expect(auth.profile.id).toBe(seat);
  return auth;
}
export async function request(page: Page, url: string, method = "GET", data?: any) {
  const auth = await (await page.request.get("/api/v1/auth/session")).json();
  const r = await page.request.fetch(url, {
    method,
    headers: { Origin: origin, "X-CSRF-Token": auth.csrfToken },
    data,
  });
  const body = await r.json();
  return { r, body };
}
export async function view(page: Page, id: string) {
  const { r, body } = await request(page, `/api/v1/matches/${id}`);
  expect(r.status()).toBe(200);
  return body.view || body;
}
export async function create(page: Page, gameId: string, mode: string, gameOptions: any = {}) {
  const { r, body } = await request(page, "/api/v1/matches", "POST", {
    creationId: randomUUID(),
    gameId,
    mode,
    gameOptions,
  });
  expect(r.status(), JSON.stringify(body)).toBe(201);
  return body.matchId as string;
}
export async function action(page: Page, id: string, action: string, payload: any = {}) {
  const v = await view(page, id);
  const guards = action.startsWith("secret.")
    ? { roundId: v.roundId }
    : action.startsWith("sudoku.")
      ? { progressRevision: v.gameState.self.progressRevision }
      : { expectedVersion: v.deliveryVersion, turnId: v.turnId };
  const { body } = await request(page, `/api/v1/matches/${id}/actions`, "POST", {
    protocolVersion: 1,
    matchId: id,
    actionId: randomUUID(),
    action,
    payload,
    controllerGeneration: v.controller.controllerGeneration,
    ...guards,
  });
  expect(body.status, JSON.stringify(body)).toBe("accepted");
  return body.view;
}
export async function uiCreate(page: Page, gameId: string) {
  await page.goto(`/games/${gameId}`);
  await page.getByRole("button", { name: /together side-by-side/i }).click();
  await page.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(page).toHaveURL(/\/matches\/[a-z0-9-]+/);
  return page.url().split("/").at(-1)!;
}
export async function settle(page: Page, id: string, previous: number) {
  await expect.poll(async () => (await view(page, id)).deliveryVersion).toBeGreaterThan(previous);
}
export async function solve(page: Page, id: string) {
  const solutions = JSON.parse(fs.readFileSync("content/sudoku/solutions.json", "utf8"));
  let v = await view(page, id);
  const solution = solutions[v.gameState.puzzleId];
  expect(solution).toHaveLength(81);
  for (let i = 0; i < 81; i++)
    if (v.gameState.givens[i] === "0" && v.gameState.self.cells[i] !== Number(solution[i]))
      v = await action(page, id, "sudoku.edit", {
        row: Math.floor(i / 9),
        col: i % 9,
        operation: "set",
        value: Number(solution[i]),
      });
  expect(v.lifecycle).toBe("completed");
  return v;
}

export async function saveFileWithRetry(
  targetPath: string,
  data: Buffer | string,
  maxAttempts = 10,
  initialDelayMs = 50,
): Promise<void> {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fs.promises.writeFile(targetPath, data);
      return;
    } catch (err: unknown) {
      if (attempt === maxAttempts) throw err;
      const delay = initialDelayMs * Math.pow(1.5, attempt - 1) + Math.random() * 25;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function captureScreenshot(
  page: Page,
  targetPath: string,
  options: { fullPage?: boolean } = { fullPage: true },
  maxAttempts = 10,
): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const buffer = await page.screenshot({ fullPage: options.fullPage ?? true });
      await saveFileWithRetry(targetPath, buffer, maxAttempts);
      return;
    } catch (err: unknown) {
      if (attempt === maxAttempts) throw err;
      const delay = 50 * Math.pow(1.5, attempt - 1) + Math.random() * 25;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export async function writeJsonWithRetry(
  targetPath: string,
  data: unknown,
  maxAttempts = 10,
): Promise<void> {
  const content = JSON.stringify(data, null, 2);
  await saveFileWithRetry(targetPath, content, maxAttempts);
}
