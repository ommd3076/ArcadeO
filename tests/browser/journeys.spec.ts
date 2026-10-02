import { test, expect } from "@playwright/test";
import { login, create, view, action, uiCreate, settle, solve } from "./helpers";

test("two independent UI logins, remote invitation/readiness, normal Connect Four win, refresh and rematch", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  await login(a, "A");
  await login(b, "B");
  await a.goto("/games/connect-four");
  await a.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(a).toHaveURL(/matches/);
  const id = a.url().split("/").at(-1)!;
  await b.goto(`/matches/${id}`);
  await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
  await settle(b, id, 1);
  for (const p of [a, b]) {
    await p.reload();
    await p.getByRole("button", { name: "I am ready", exact: true }).click();
  }
  await expect.poll(async () => (await view(a, id)).lifecycle).toBe("active");
  const starter = (await view(a, id)).turnSeat;
  for (let i = 0; i < 7; i++) {
    const v = await view(a, id);
    const p = v.turnSeat === "A" ? a : b;
    await p.reload();
    const c = v.turnSeat === starter ? 1 : 2;
    await p.getByRole("button", { name: `Drop disc into column ${c}`, exact: true }).click();
    await settle(p, id, v.deliveryVersion);
    if (i === 0) {
      await a.reload();
      await b.reload();
      expect((await view(a, id)).gameState.board.flat().filter(Boolean)).toHaveLength(1);
    }
  }
  const terminal = await view(a, id);
  expect(terminal.result.reason).toBe("rules_win");
  expect(terminal.result.winner).toBe(starter);
  await a.reload();
  await expect(a.getByRole("heading", { name: /wins!/i })).toBeVisible();
  await a.getByRole("button", { name: "Rematch", exact: true }).click();
  await expect(a).not.toHaveURL(new RegExp(id));
  const rematch = a.url().split("/").at(-1)!;
  expect((await view(a, rematch)).lifecycle).toBe("waiting");
  await action(a, rematch, "match.cancel");
  await ca.close();
  await cb.close();
});
for (const game of ["connect-four", "dots-boxes", "sos", "snakes-and-ladders", "ludo"])
  test(`${game} Together UI creation and normal rule completion (API actions)`, async ({
    page,
  }) => {
    test.setTimeout(240000);
    await login(page, "A");

    const id = await uiCreate(page, game);
    let v = await view(page, id);
    expect(v.lifecycle).toBe("active");
    if (game === "connect-four") {
      const starter = v.turnSeat;
      for (let i = 0; i < 7; i++) {
        v = await view(page, id);
        v = await action(page, id, "connect-four.drop", { column: v.turnSeat === starter ? 0 : 1 });
      }
    }
    if (game === "dots-boxes") {
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 4; c++)
          v = await action(page, id, "dots-boxes.edge", { r1: r, c1: c, r2: r, c2: c + 1 });
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 5; c++)
          v = await action(page, id, "dots-boxes.edge", { r1: r, c1: c, r2: r + 1, c2: c });
      expect(v.gameState.scores.A + v.gameState.scores.B).toBe(16);
    }
    if (game === "sos")
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++)
          v = await action(page, id, "sos.place", { row: r, col: c, letter: "S" });
    if (game === "snakes-and-ladders")
      for (let i = 0; i < 1200 && v.lifecycle === "active"; i++)
        v = await action(page, id, "dice.roll");
    if (game === "ludo")
      for (let i = 0; i < 2000 && v.lifecycle === "active"; i++) {
        v = await action(page, id, "dice.roll");
        if (v.gameState.phase === "choose-token")
          v = await action(page, id, "ludo.move", { tokenId: v.gameState.legalTokenIds[0] });
      }
    expect(v.lifecycle, game).toBe("completed");
    expect(["rules_win", "rules_draw"]).toContain(v.result.reason);
    await page.reload();
    await expect(page.getByRole("button", { name: "Rematch", exact: true })).toBeVisible();
    await page.screenshot({ path: `.local/browser-results/${game}-terminal.png`, fullPage: true });
  });
test("Together RPS handoff lock refresh masking Reveal Next and normal best-of completion", async ({
  page,
}) => {
  await login(page, "A");
  const id = await uiCreate(page, "rock-paper-scissors");
  await page.getByRole("button", { name: "Resume & Unmask", exact: true }).click();
  for (let round = 0; round < 2; round++) {
    const ready = page.getByRole("button", { name: /I am .*\(Ready\)/ });
    await ready.click();
    await page.getByRole("radio", { name: round === 0 ? "Rock" : "Scissors", exact: true }).click();
    await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
    await expect(page.getByRole("heading", { name: /Pass phone/ })).toBeVisible();
    const masked = await view(page, id);
    expect(masked.gameState.roundResult).toBeNull();
    expect(JSON.stringify(masked.gameState)).not.toContain('"choices"');
    await page.reload();
    const unmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
    await unmask.click();
    await page.getByRole("button", { name: /I am .*\(Ready\)/ }).click();
    await page.getByRole("radio", { name: round === 0 ? "Scissors" : "Rock", exact: true }).click();
    await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reveal Outcome", exact: true })).toBeVisible();
    expect((await view(page, id)).gameState.roundResult).toBeNull();
    await page.getByRole("button", { name: "Reveal Outcome", exact: true }).click();
    if (round === 0) {
      await page.getByRole("button", { name: "Next Round", exact: true }).click();
      await expect.poll(async () => (await view(page, id)).roundId).toBe(2);
    }
  }
  await expect.poll(async () => (await view(page, id)).lifecycle).toBe("completed");
});
test("practice UI notes undo pause Check assistance and server solution completion", async ({
  page,
}) => {
  await login(page, "A");
  await page.goto("/games/sudoku");
  await page.getByTestId("start-sudoku-button").click();
  await expect(page).toHaveURL(/matches/);
  const id = page.url().split("/").at(-1)!;
  let v = await view(page, id);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    const cells = await Promise.all(
      [0, 1, 8, 9].map((i) =>
        page.getByTestId(`sudoku-cell-${Math.floor(i / 9)}-${i % 9}`).boundingBox(),
      ),
    );
    expect(Math.abs(cells[0]!.y - cells[2]!.y)).toBeLessThan(1);
    expect(cells[2]!.x).toBeGreaterThan(cells[1]!.x);
    expect(cells[3]!.y).toBeGreaterThan(cells[0]!.y);
    expect(Math.abs(cells[3]!.x - cells[0]!.x)).toBeLessThan(1);
    for (const name of ["Notes", "Erase", "Undo", "Check", "Pause", "1", "9"]) {
      const bounds = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
    }
    await page.screenshot({
      path: `.local/browser-results/sudoku-practice-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const i = v.gameState.givens.indexOf("0");
  await page.getByTestId(`sudoku-cell-${Math.floor(i / 9)}-${i % 9}`).click();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect.poll(async () => (await view(page, id)).gameState.self.notes[i]).toBe(2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await view(page, id)).gameState.self.notes[i]).toBe(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByText("Puzzle Paused", { exact: true })).toBeVisible();
  v = await view(page, id);
  expect(v.gameState.self.cells).toBeUndefined();
  await page.reload();
  await page.getByRole("button", { name: "Resume Puzzle", exact: true }).click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect.poll(async () => (await view(page, id)).gameState.self.assisted).toBe(true);
  v = await solve(page, id);
  expect(v.result.details.scored).toBe(false);
  await page.reload();
  await expect(page.getByRole("button", { name: "Rematch", exact: true })).toBeVisible();
});
for (const game of [
  "dots-boxes",
  "sos",
  "snakes-and-ladders",
  "ludo",
  "rock-paper-scissors",
  "hand-cricket",
]) {
  test(`${game} remote UI invitation both Ready first action and Rematch; API normal completion`, async ({
    browser,
  }) => {
    test.setTimeout(240000);
    const ca = await browser.newContext(),
      cb = await browser.newContext();
    const a = await ca.newPage(),
      b = await cb.newPage();
    await login(a, "A");
    await login(b, "B");
    await a.goto(`/games/${game}`);
    await a.getByRole("button", { name: "Start Match", exact: true }).click();
    await expect(a).toHaveURL(/matches/);
    const id = a.url().split("/").at(-1)!;
    await b.goto(`/matches/${id}`);
    await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
    for (const p of [a, b]) {
      await p.reload();
      await p.getByRole("button", { name: "I am ready", exact: true }).click();
    }
    await expect.poll(async () => (await view(a, id)).lifecycle).toBe("active");
    let v = await view(a, id);
    const player = (seat: string) => (seat === "A" ? a : b);
    let p = player(v.turnSeat);
    await p.reload();
    const before = v.deliveryVersion;
    if (game === "dots-boxes") await p.getByTestId("edge-h-0-0").click();
    if (game === "sos") {
      await p.getByRole("button", { name: "S", exact: true }).click();
      await p.getByRole("button", { name: "Cell row 1, column 1: empty", exact: true }).click();
    }
    if (game === "ludo" || game === "snakes-and-ladders")
      await p.getByRole("button", { name: "Roll Dice", exact: true }).click();
    if (game === "rock-paper-scissors") {
      p = a;
      await p.reload();
      await p.bringToFront();
      await p.getByRole("button", { name: "Resume & Unmask", exact: true }).click();
      await p.getByRole("radio", { name: "Rock", exact: true }).click();
      await p.getByRole("button", { name: "Lock Choice", exact: true }).click();
    }
    if (game === "hand-cricket") {
      p = player(v.gameState.tossWinner);
      await p.reload();
      await p.getByRole("button", { name: "Bat First", exact: true }).click();
    }
    await settle(p, id, before);
    await a.reload();
    await b.reload();
    await a.screenshot({
      path: `.local/browser-results/${game}-remote-first-action.png`,
      fullPage: true,
    });
    v = await view(a, id);
    if (game === "dots-boxes") {
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 4; c++)
          if (r || c) {
            v = await view(a, id);
            await action(player(v.turnSeat), id, "dots-boxes.edge", {
              r1: r,
              c1: c,
              r2: r,
              c2: c + 1,
            });
          }
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 5; c++) {
          v = await view(a, id);
          await action(player(v.turnSeat), id, "dots-boxes.edge", {
            r1: r,
            c1: c,
            r2: r + 1,
            c2: c,
          });
        }
    }
    if (game === "sos")
      for (let r = 0; r < 5; r++)
        for (let c = 0; c < 5; c++)
          if (r || c) {
            v = await view(a, id);
            await action(player(v.turnSeat), id, "sos.place", { row: r, col: c, letter: "S" });
          }
    if (game === "snakes-and-ladders" || game === "ludo")
      for (let i = 0; i < 2000; i++) {
        v = await view(a, id);
        if (v.lifecycle === "completed") break;
        const who = player(v.turnSeat);
        if (game === "ludo" && v.gameState.phase === "choose-token")
          await action(who, id, "ludo.move", { tokenId: v.gameState.legalTokenIds[0] });
        else await action(who, id, "dice.roll");
      }
    if (game === "rock-paper-scissors") {
      await action(b, id, "secret.lock", { choice: "scissors" });
      await action(a, id, "secret.next");
      await action(b, id, "secret.next");
      await action(a, id, "secret.lock", { choice: "rock" });
      await action(b, id, "secret.lock", { choice: "scissors" });
    }
    if (game === "hand-cricket") {
      await a.bringToFront();
      await a.getByRole("button", { name: "Resume & Unmask", exact: true }).click();
      await a.getByRole("radio", { name: "1 Run", exact: true }).click();
      await a.getByRole("button", { name: "Lock Choice", exact: true }).click();
      await expect.poll(async () => (await view(a, id)).gameState.lockedSeats).toContain("A");
      await action(b, id, "secret.lock", { value: 1 });
      await action(a, id, "secret.next");
      await action(b, id, "secret.next");
      v = await view(a, id);
      const batter = v.gameState.roles.bat;
      await action(player(batter), id, "secret.lock", { value: 1 });
      await action(player(batter === "A" ? "B" : "A"), id, "secret.lock", { value: 2 });
    }
    v = await view(a, id);
    expect(v.lifecycle).toBe("completed");
    expect(["rules_win", "rules_draw"]).toContain(v.result.reason);
    await a.reload();
    await b.reload();
    await expect(b.getByRole("button", { name: "Rematch", exact: true })).toBeVisible();
    await a.getByRole("button", { name: "Rematch", exact: true }).click();
    await expect(a).not.toHaveURL(new RegExp(id));
    const rematch = a.url().split("/").at(-1)!;
    expect((await view(a, rematch)).lifecycle).toBe("waiting");
    await action(a, rematch, "match.cancel");
    await ca.close();
    await cb.close();
  });
}
test("Sudoku duel prestart private board common timer independent revisions and normal finish (API setup/actions)", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  await login(a, "A");
  await login(b, "B");
  const id = await create(a, "sudoku", "duel", { bucket: "easy" });
  await action(b, id, "match.accept");
  await a.goto(`/matches/${id}`);
  await b.goto(`/matches/${id}`);
  expect((await view(a, id)).gameState.givens).toBe("0".repeat(81));
  await action(a, id, "match.ready");
  await action(b, id, "match.ready");
  const va = await view(a, id),
    vb = await view(b, id);
  expect(va.gameState.scheduledStartTime).toBe(vb.gameState.scheduledStartTime);
  expect(va.gameState.self.cells).toBeUndefined();
  await expect.poll(async () => (await view(a, id)).gameState.hasStarted).toBe(true);
  const started = await view(a, id);
  const i = started.gameState.givens.indexOf("0");
  for (const p of [a, b])
    await action(p, id, "sudoku.edit", {
      row: Math.floor(i / 9),
      col: i % 9,
      operation: "toggle-note",
      value: 1,
    });
  const bv = await view(b, id);
  expect(bv.gameState.self.progressRevision).toBe(2);
  expect(bv.gameState.opponent.cells).toBeUndefined();
  expect(bv.gameState.opponent.notes).toBeUndefined();
  await solve(a, id);
  expect((await view(b, id)).result.winner).toBe("A");
  await ca.close();
  await cb.close();
});
test("async sender normal completion UI Publish receiver invitation acceptance and normal finish", async ({
  browser,
}) => {
  const ca = await browser.newContext(),
    cb = await browser.newContext();
  const a = await ca.newPage(),
    b = await cb.newPage();
  await login(a, "A");
  await login(b, "B");
  const id = await create(a, "sudoku", "challenge", { bucket: "medium" });
  await solve(a, id);
  await a.goto(`/matches/${id}`);
  await a.getByRole("button", { name: /Publish|Send.*challenge/i }).click();
  await expect(a).not.toHaveURL(new RegExp(id));
  const published = a.url().split("/").at(-1)!;
  await b.goto("/games/sudoku");
  await b.getByTestId("mode-challenge").click();
  await b.getByRole("button", { name: "Open invitation", exact: true }).click();
  await expect(b).toHaveURL(new RegExp(published));
  expect((await view(b, published)).gameState.self.cells).toBeUndefined();
  await b.getByRole("button", { name: "Accept invitation", exact: true }).click();
  await expect.poll(async () => (await view(b, published)).lifecycle).toBe("active");
  expect((await view(b, published)).gameState.opponent).toBeUndefined();
  const end = await solve(b, published);
  expect(["rules_win", "rules_draw"]).toContain(end.result.reason);
  await b.reload();
  await expect(b.getByRole("button", { name: "Rematch", exact: true })).toBeVisible();
  await ca.close();
  await cb.close();
});
