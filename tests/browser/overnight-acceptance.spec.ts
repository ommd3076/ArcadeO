import fs from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { action, create, login, view } from "./helpers";

type VisualCell = {
  id: string;
  category: string;
  game: string;
  family: "standard" | "romantic";
  mode: "dark" | "light";
  width: 320 | 390 | 430 | 1280;
  motion: "normal" | "reduced";
  playMode: string;
  required: string;
};

type MotionFrame = {
  elapsedMs: number;
  active: Array<{
    target: string;
    durationMs: number | null;
    transform: string;
    opacity: string;
  }>;
};

const ledgerPath = path.resolve("planning/execution/OVERNIGHT-ACCEPTANCE-2026-10-03.json");
const evidenceDir = path.resolve("planning/review/evidence/overnight-acceptance");
const viewports: Record<VisualCell["width"], { width: number; height: number }> = {
  320: { width: 320, height: 700 },
  390: { width: 390, height: 844 },
  430: { width: 430, height: 932 },
  1280: { width: 1280, height: 800 },
};

function readVisualCells(): VisualCell[] {
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8")) as {
    cells: VisualCell[];
  };
  return ledger.cells.filter((cell) => cell.category === "game-control-visual");
}

function turnStatusLocator(page: Page, game: string) {
  if (game === "dots-boxes" || game === "sos") {
    return page.locator(".arcade-match-board-stage").getByRole("status");
  }
  return page.locator(".arcade-turn-strip");
}

async function chooseAppearance(page: Page, cell: VisualCell) {
  await page.goto("/us");
  await page.getByRole("button", { name: new RegExp(`^${cell.family}\\b`, "i") }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-family", cell.family);
  await page.getByRole("button", { name: new RegExp(`^${cell.mode}$`, "i") }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", cell.mode);
}

async function scrollControlIntoView(control: Locator) {
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.scrollIntoViewIfNeeded();
  const geometry = await control.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      hitTarget: hit === element || element.contains(hit),
    };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(-1);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
  expect(geometry.top).toBeGreaterThanOrEqual(-1);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
  expect(geometry.hitTarget, JSON.stringify(geometry)).toBe(true);
  return geometry;
}

async function visibleActionName(control: Locator) {
  const ariaLabel = await control.getAttribute("aria-label");
  const name = ariaLabel?.trim() || (await control.innerText()).trim();
  expect(name, "next action has a user-visible accessible name").not.toBe("");
  await expect(control).toHaveAccessibleName(name);
  return name;
}

async function settleBoardAndReturnToTop(page: Page) {
  await expect
    .poll(() =>
      page.locator(".arcade-match-board-stage").evaluate(
        (board) =>
          document.getAnimations().filter((animation) => {
            const target = (animation.effect as KeyframeEffect | null)?.target;
            return (
              animation.playState === "running" && target instanceof Node && board.contains(target)
            );
          }).length,
      ),
    )
    .toBe(0);
  await page.evaluate(async () => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    await document.fonts.load('700 14px "Space Grotesk"');
    await document.fonts.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

async function sampleMotionFrames(page: Page, durationMs: number) {
  return page.evaluate(
    (sampleDuration) =>
      new Promise<MotionFrame[]>((resolve) => {
        const startedAt = performance.now();
        const samples: MotionFrame[] = [];
        const sample = (now: number) => {
          const active: MotionFrame["active"] = document
            .getAnimations()
            .filter((animation) => animation.playState === "running")
            .map((animation) => {
              const element = (animation.effect as KeyframeEffect | null)?.target;
              const target = element instanceof HTMLElement ? element : null;
              const duration = animation.effect?.getComputedTiming().duration;
              return {
                target: target?.dataset.testid ?? target?.className.toString() ?? "unknown",
                durationMs: typeof duration === "number" ? duration : null,
                transform: target ? getComputedStyle(target).transform : "none",
                opacity: target ? getComputedStyle(target).opacity : "1",
              };
            });
          samples.push({ elapsedMs: Math.round(now - startedAt), active });
          if (now - startedAt < sampleDuration) requestAnimationFrame(sample);
          else resolve(samples);
        };
        requestAnimationFrame(sample);
      }),
    durationMs,
  );
}

async function expectBoardVisible(page: Page, game: string) {
  const boards: Record<string, Locator> = {
    ludo: page.getByTestId("ludo-board-grid"),
    "snakes-and-ladders": page.getByTestId("snl-cell-100"),
    "connect-four": page.getByRole("region", { name: "Connect Four Game Board", exact: true }),
    "dots-boxes": page.getByTestId("dot-0-0"),
    sos: page.getByTestId("sos-cell-0-0"),
    sudoku: page.getByTestId("sudoku-cell-0-0"),
    "rock-paper-scissors": page.getByRole("region", {
      name: "Rock Paper Scissors Game",
      exact: true,
    }),
    "hand-cricket": page.locator(".arcade-match-board-stage"),
  };
  const board = boards[game];
  expect(board, `missing rendered board locator for ${game}`).toBeTruthy();
  await expect(board).toBeVisible();
}

async function inspectSudokuGridGeometry(page: Page) {
  return page.evaluate(() => {
    const firstCell = document.querySelector<HTMLElement>('[data-testid="sudoku-cell-0-0"]');
    const board = firstCell?.parentElement;
    if (!board) throw new Error("Sudoku grid container is missing");
    const cells = Array.from(board.querySelectorAll<HTMLElement>('[data-testid^="sudoku-cell-"]'));
    const boardRect = board.getBoundingClientRect();
    const rects = cells.map((cell) => cell.getBoundingClientRect());
    const rowHeights = Array.from({ length: 9 }, (_, row) => rects[row * 9].height);
    const columnWidths = Array.from({ length: 9 }, (_, col) => rects[col].width);
    const glyphsFit = cells.flatMap((cell) => {
      const glyph = cell.querySelector<HTMLElement>(":scope > span");
      if (!glyph) return [];
      const cellRect = cell.getBoundingClientRect();
      const glyphRect = glyph.getBoundingClientRect();
      return [
        glyphRect.left >= cellRect.left - 0.5 &&
          glyphRect.right <= cellRect.right + 0.5 &&
          glyphRect.top >= cellRect.top - 0.5 &&
          glyphRect.bottom <= cellRect.bottom + 0.5,
      ];
    });
    return {
      cellCount: cells.length,
      rowHeightSpread: Math.max(...rowHeights) - Math.min(...rowHeights),
      columnWidthSpread: Math.max(...columnWidths) - Math.min(...columnWidths),
      bottomOverflow: Math.max(...rects.map((rect) => rect.bottom)) - boardRect.bottom,
      glyphCount: glyphsFit.length,
      glyphsFit: glyphsFit.every(Boolean),
    };
  });
}

async function moveOnce(page: Page, matchId: string, game: string) {
  let before = await view(page, matchId);
  const controls: Record<string, Locator> = {
    ludo: page.getByTestId("ludo-roll-button"),
    "snakes-and-ladders": page.getByTestId("snl-roll-button"),
    "connect-four": page.getByRole("button", {
      name: "Drop disc into column 1",
      exact: true,
    }),
    "dots-boxes": page.getByTestId("edge-h-0-0"),
    sos: page.getByTestId("sos-cell-0-0"),
  };

  if (game === "ludo") {
    let rollCount = 0;
    while (before.gameState.phase === "roll" && rollCount < 80) {
      const control = controls.ludo;
      const geometry = await scrollControlIntoView(control);
      await control.click();
      await expect
        .poll(async () => (await view(page, matchId)).deliveryVersion)
        .toBeGreaterThan(before.deliveryVersion);
      before = await view(page, matchId);
      rollCount++;
      if (before.gameState.phase === "choose-token") {
        const pawn = page.getByTestId(`ludo-token-button-${before.gameState.legalTokenIds[0]}`);
        await scrollControlIntoView(pawn);
        await pawn.click();
        await expect
          .poll(async () => (await view(page, matchId)).deliveryVersion)
          .toBeGreaterThan(before.deliveryVersion);
        const snapshot = await view(page, matchId);
        const next = page.getByTestId(
          snapshot.gameState.phase === "choose-token"
            ? `ludo-token-button-${snapshot.gameState.legalTokenIds[0]}`
            : "ludo-roll-button",
        );
        await expect(next).toBeEnabled();
        return {
          geometry,
          accepted: "roll-and-legal-token",
          snapshot,
          nextAction: await visibleActionName(next),
        };
      }
    }
    expect(before.gameState.phase).toBe("roll");
    expect(before.gameState.lastRollNotice).toBe("no-legal-move");
    await expect(
      page.getByText("No legal pawn could move. The turn passed unless you rolled a six."),
    ).toBeVisible();
    await expect(controls.ludo).toBeEnabled();
    return {
      geometry: await scrollControlIntoView(controls.ludo),
      accepted: "accepted-no-legal-move-feedback",
      snapshot: before,
      nextAction: "Roll",
    };
  }

  if (game === "rock-paper-scissors") {
    const handoff = page.locator(".arcade-secret-handoff");
    await expect(handoff).toBeVisible();
    const firstUnmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
    if (await firstUnmask.isVisible()) await firstUnmask.click();
    const firstReady = page.getByRole("button", { name: /I am .*\(Ready\)/ });
    await scrollControlIntoView(firstReady);
    await firstReady.click();
    await page.getByRole("radio", { name: "Rock", exact: true }).click();
    const firstVersion = (await view(page, matchId)).deliveryVersion;
    await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
    await expect
      .poll(async () => (await view(page, matchId)).deliveryVersion)
      .toBeGreaterThan(firstVersion);
    const secondUnmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
    if (await secondUnmask.isVisible()) await secondUnmask.click();
    const secondReady = page.getByRole("button", { name: /I am .*\(Ready\)/ });
    await scrollControlIntoView(secondReady);
    await secondReady.click();
    await page.getByRole("radio", { name: "Paper", exact: true }).click();
    const secondVersion = (await view(page, matchId)).deliveryVersion;
    await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
    await expect
      .poll(async () => (await view(page, matchId)).deliveryVersion)
      .toBeGreaterThan(secondVersion);
    const reveal = page.getByRole("button", { name: "Reveal Outcome", exact: true });
    const geometry = await scrollControlIntoView(reveal);
    await reveal.click();
    await expect(page.getByText("Round 1 Result", { exact: true })).toBeVisible();
    const next = page.getByRole("button", { name: "Next Round", exact: true });
    await expect(next).toBeEnabled();
    return {
      geometry,
      accepted: "both-secret-locks-and-reveal",
      snapshot: await view(page, matchId),
      nextAction: await next.innerText(),
    };
  }

  if (game === "hand-cricket") {
    before = await view(page, matchId);
    if (before.gameState.phase === "toss") {
      const chooseRole = page.getByTestId("cricket-choose-bat");
      const geometry = await scrollControlIntoView(chooseRole);
      await chooseRole.click();
      await expect
        .poll(async () => (await view(page, matchId)).deliveryVersion)
        .toBeGreaterThan(before.deliveryVersion);
      const firstSecretView = await view(page, matchId);
      expect(firstSecretView.gameState.expectedChooser).toBe(firstSecretView.gameState.roles?.bat);
      const firstUnmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
      if (await firstUnmask.isVisible()) await firstUnmask.click();
      const firstChooserName =
        firstSecretView.participants[firstSecretView.gameState.expectedChooser].displayName;
      const ready = page.getByRole("button", {
        name: `I am ${firstChooserName} (Ready)`,
        exact: true,
      });
      await scrollControlIntoView(ready);
      await ready.click();
      await page.getByRole("radio", { name: "1 Run", exact: true }).click();
      const firstLockVersion = (await view(page, matchId)).deliveryVersion;
      await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
      await expect
        .poll(async () => (await view(page, matchId)).deliveryVersion)
        .toBeGreaterThan(firstLockVersion);
      const secondSecretView = await view(page, matchId);
      expect(secondSecretView.gameState.expectedChooser).toBe(
        secondSecretView.gameState.roles?.bowl,
      );
      const secondUnmask = page.getByRole("button", { name: "Resume & Unmask", exact: true });
      if (await secondUnmask.isVisible()) await secondUnmask.click();
      const secondChooserName =
        secondSecretView.participants[secondSecretView.gameState.expectedChooser].displayName;
      const secondReady = page.getByRole("button", {
        name: `I am ${secondChooserName} (Ready)`,
        exact: true,
      });
      await scrollControlIntoView(secondReady);
      await secondReady.click();
      await page.getByRole("radio", { name: "2 Runs", exact: true }).click();
      const secondLockVersion = (await view(page, matchId)).deliveryVersion;
      await page.getByRole("button", { name: "Lock Choice", exact: true }).click();
      await expect
        .poll(async () => (await view(page, matchId)).deliveryVersion)
        .toBeGreaterThan(secondLockVersion);
      const reveal = page.getByRole("button", { name: "Reveal ball", exact: true });
      await scrollControlIntoView(reveal);
      await reveal.click();
      await expect.poll(async () => (await view(page, matchId)).gameState.revealed).toBe(true);
      const resolved = await view(page, matchId);
      expect(resolved.gameState.lastDelivery).not.toBeNull();
      const nextLabel =
        resolved.gameState.lastDelivery.outcome === "out" && resolved.gameState.innings === 1
          ? "Switch batting"
          : "Next ball";
      const next = page.getByRole("button", { name: nextLabel, exact: true });
      await expect(next).toBeEnabled();
      return {
        geometry,
        accepted: "choose-role-and-full-secret-ball-through-reveal",
        snapshot: resolved,
        nextAction: nextLabel,
      };
    }
    throw new Error(`Expected an isolated Hand Cricket toss, received ${before.gameState.phase}`);
  }

  if (game === "sudoku") {
    const state = before.gameState;
    const emptyIndex = state.givens.split("").findIndex((digit: string) => digit === "0");
    expect(emptyIndex, "fixture must contain an editable Sudoku cell").toBeGreaterThanOrEqual(0);
    const solutions = JSON.parse(
      fs.readFileSync("content/sudoku/solutions.json", "utf8"),
    ) as Record<string, string>;
    const answer = Number(solutions[state.puzzleId][emptyIndex]);
    const row = Math.floor(emptyIndex / 9);
    const col = emptyIndex % 9;
    const cell = page.getByTestId(`sudoku-cell-${row}-${col}`);
    const geometry = await scrollControlIntoView(cell);
    await cell.click();
    const pad = page.getByTestId(`sudoku-pad-${answer}`);
    await pad.scrollIntoViewIfNeeded();
    await expect(pad).toBeEnabled();
    const version = before.deliveryVersion;
    await pad.click();
    await expect
      .poll(async () => (await view(page, matchId)).deliveryVersion)
      .toBeGreaterThan(version);
    const saved = await view(page, matchId);
    expect(saved.gameState.self.cells[emptyIndex]).toBe(answer);
    const nextDigit = (answer % 9) + 1;
    const next = page.getByTestId(`sudoku-pad-${nextDigit}`);
    await expect(next).toBeEnabled();
    return {
      geometry,
      accepted: "sudoku-practice-edit",
      snapshot: saved,
      nextAction: `Digit ${nextDigit}`,
    };
  }

  const control = controls[game];
  expect(control, `missing first legal control for ${game}`).toBeTruthy();
  const geometry = await scrollControlIntoView(control);
  if (game === "sos") await page.getByTestId("sos-select-s").click();
  const version = before.deliveryVersion;
  await control.click();
  await expect
    .poll(async () => (await view(page, matchId)).deliveryVersion)
    .toBeGreaterThan(version);
  const saved = await view(page, matchId);
  if (game === "connect-four") expect(saved.gameState.board[5][0]).toBe("A");
  if (game === "dots-boxes")
    await expect(page.getByTestId("edge-h-0-0")).toHaveAttribute("aria-label", /claimed by/);
  if (game === "sos")
    await expect(page.getByTestId("sos-cell-0-0")).toHaveAttribute("aria-label", /: S$/);
  const nextActions: Record<string, Locator> = {
    "snakes-and-ladders": page.getByTestId("snl-roll-button"),
    "connect-four": page.getByRole("button", { name: "Drop disc into column 2", exact: true }),
    "dots-boxes": page.getByTestId("edge-h-0-1"),
    sos: page.getByTestId("sos-cell-0-1"),
  };
  const next = nextActions[game];
  await expect(next, `${game}: next legal UI action is exposed`).toBeEnabled();
  return { geometry, accepted: game, snapshot: saved, nextAction: await visibleActionName(next) };
}

test("VIS-001..256: every appearance, width, motion, and game cell has a UI-accepted action", async ({
  page,
}) => {
  test.setTimeout(3_600_000);
  fs.mkdirSync(evidenceDir, { recursive: true });
  const allCells = readVisualCells();
  expect(allCells).toHaveLength(256);
  const resumeFrom = Number.parseInt(process.env.VIS_RESUME_FROM ?? "1", 10);
  expect(resumeFrom).toBeGreaterThanOrEqual(1);
  expect(resumeFrom).toBeLessThanOrEqual(256);
  const remainingCells = allCells.filter((cell) => Number(cell.id.slice(4)) >= resumeFrom);
  const maxCases = Number.parseInt(process.env.VIS_MAX_CASES ?? "0", 10);
  const cells = maxCases > 0 ? remainingCells.slice(0, maxCases) : remainingCells;
  await login(page, "A");
  const reportPath = path.join(evidenceDir, "VIS-001-256-assertions.json");
  const previous =
    resumeFrom > 1 && fs.existsSync(reportPath)
      ? (JSON.parse(fs.readFileSync(reportPath, "utf8")) as {
          records?: Array<Record<string, unknown>>;
          failures?: Array<{ id: string; message: string }>;
        })
      : null;
  const records: Array<Record<string, unknown>> = (previous?.records ?? []).filter(
    (record) => Number(String(record.id).slice(4)) < resumeFrom,
  );
  const failures: Array<{ id: string; message: string }> = (previous?.failures ?? []).filter(
    (failure) => Number(failure.id.slice(4).split("-")[0]) < resumeFrom,
  );
  const persistProgress = (runStatus: "IN_PROGRESS" | "RUN_COMPLETE") => {
    fs.writeFileSync(
      reportPath,
      JSON.stringify(
        {
          runStatus,
          run: "Playwright against scripts/browser-server.mjs local bundled Worker and SQLite Durable Objects",
          setup:
            "Synthetic local account A; API only creates fixtures and cleans isolated matches; accepted gameplay is UI-only.",
          expectedCells: 256,
          resumedAt: resumeFrom > 1 ? `VIS-${String(resumeFrom).padStart(3, "0")}` : null,
          processedCells:
            records.length + failures.filter((failure) => !failure.id.endsWith("-cleanup")).length,
          passedCellRecords: records.length,
          failures,
          records,
        },
        null,
        2,
      ),
    );
  };
  persistProgress("IN_PROGRESS");
  let matchId: string | undefined;
  let matchOwnerPage: Page | undefined;

  for (const cell of cells) {
    let sudokuLayout: Awaited<ReturnType<typeof inspectSudokuGridGeometry>> | undefined;
    try {
      await page.setViewportSize(viewports[cell.width]);
      await page.emulateMedia({
        reducedMotion: cell.motion === "reduced" ? "reduce" : "no-preference",
      });
      await chooseAppearance(page, cell);

      matchId = await create(
        page,
        cell.game,
        cell.playMode,
        cell.game === "sudoku" ? { puzzleId: "easy-002" } : {},
      );
      matchOwnerPage = page;

      if (cell.game === "hand-cricket") {
        expect((await view(page, matchId)).gameState.phase).toBe("toss");
      }

      await page.goto(`/matches/${matchId}`);
      await expect(page.locator(".arcade-match-main")).toBeVisible();
      const turnStatus = turnStatusLocator(page, cell.game);
      await expect(turnStatus).toBeVisible();
      await expectBoardVisible(page, cell.game);
      await expect(page.locator("html")).toHaveAttribute("data-theme-family", cell.family);
      await expect(page.locator("html")).toHaveAttribute("data-theme-mode", cell.mode);

      const motionSamplesPromise = sampleMotionFrames(
        page,
        cell.game === "rock-paper-scissors" || cell.game === "hand-cricket" ? 3000 : 900,
      );
      const accepted = await moveOnce(page, matchId, cell.game);
      const motionSamples = await motionSamplesPromise;
      const geometry = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        motionPreference: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "reduced"
          : "normal",
        turnText: "",
      }));
      geometry.turnText = (await turnStatus.innerText()).trim();
      expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth + 2);
      const acceptedState = accepted.snapshot as Awaited<ReturnType<typeof view>>;
      if (cell.game === "hand-cricket") {
        const cricket = acceptedState.gameState;
        const batterSeat = cricket.roles?.bat;
        expect(batterSeat, `${cell.id}: accepted Cricket state names the batter`).toBeTruthy();
        const batterName = acceptedState.participants?.[batterSeat!]?.displayName;
        expect(
          batterName,
          `${cell.id}: accepted Cricket batter has a visible identity`,
        ).toBeTruthy();
        expect(geometry.turnText, `${cell.id}: turn strip identifies the current batter`).toContain(
          batterName,
        );
        expect(geometry.turnText, `${cell.id}: turn strip labels the batting role`).toContain(
          "BATTING",
        );
        const expectedNextAction =
          cricket.lastDelivery?.outcome === "out" && cricket.innings === 1
            ? "Switch batting"
            : "Next ball";
        expect(accepted.nextAction, `${cell.id}: resolved Cricket ball exposes next action`).toBe(
          expectedNextAction,
        );
      } else {
        const activeName = acceptedState.participants?.[acceptedState.turnSeat]?.displayName;
        expect(activeName, `${cell.id}: accepted state names its active owner`).toBeTruthy();
        expect(geometry.turnText, `${cell.id}: visible active player/owner`).toContain(activeName);
      }
      if (cell.game === "sudoku") {
        const expectedSubtitle: Record<string, string> = {
          practice: "Practice",
          duel: "Duel",
          challenge: "Async Challenge",
          together: "Together",
          remote: "Remote",
        };
        await expect(page.locator(".arcade-match-header")).toContainText(
          expectedSubtitle[cell.playMode],
        );
        sudokuLayout = await inspectSudokuGridGeometry(page);
        expect(sudokuLayout.cellCount, `${cell.id}: all 81 Sudoku cells render`).toBe(81);
        expect(
          sudokuLayout.rowHeightSpread,
          `${cell.id}: Sudoku rows have equal height`,
        ).toBeLessThanOrEqual(1);
        expect(
          sudokuLayout.columnWidthSpread,
          `${cell.id}: Sudoku columns have equal width`,
        ).toBeLessThanOrEqual(1);
        expect(
          sudokuLayout.bottomOverflow,
          `${cell.id}: bottom row stays inside Sudoku board`,
        ).toBeLessThanOrEqual(0.5);
        expect(
          sudokuLayout.glyphCount,
          `${cell.id}: Sudoku digit glyphs are present`,
        ).toBeGreaterThan(0);
        expect(sudokuLayout.glyphsFit, `${cell.id}: digit glyphs fit within each cell`).toBe(true);
      }
      expect(accepted.nextAction, `${cell.id}: next UI action is documented`).toBeTruthy();
      expect(geometry.motionPreference).toBe(cell.motion);

      const animatedFrames = motionSamples.filter((sample) => sample.active.length > 0);
      if (cell.motion === "normal") {
        expect(animatedFrames.length, `${cell.id}: sampled accepted motion frames`).toBeGreaterThan(
          0,
        );
        const samplesByTarget = new Map<string, Set<string>>();
        for (const frame of animatedFrames) {
          for (const animation of frame.active) {
            const styles = samplesByTarget.get(animation.target) ?? new Set<string>();
            styles.add(`${animation.transform}|${animation.opacity}`);
            samplesByTarget.set(animation.target, styles);
          }
        }
        const changingTargets = [...samplesByTarget.values()].filter((styles) => styles.size > 1);
        expect(
          changingTargets,
          `${cell.id}: accepted move changes a sampled rendered animation frame`,
        ).not.toHaveLength(0);
      } else {
        const longTravelFrames = motionSamples.flatMap((sample) =>
          sample.active.filter((animation) => (animation.durationMs ?? 0) > 150),
        );
        expect(
          longTravelFrames,
          `${cell.id}: reduced motion has no active travel/countdown`,
        ).toEqual([]);
        expect(
          accepted.nextAction,
          `${cell.id}: reduced motion keeps equivalent next-action feedback`,
        ).toBeTruthy();
      }

      await settleBoardAndReturnToTop(page);
      const screenshot = path.join(evidenceDir, `${cell.id}.png`);
      await page.screenshot({ path: screenshot, fullPage: true, animations: "disabled" });
      records.push({
        id: cell.id,
        game: cell.game,
        family: cell.family,
        mode: cell.mode,
        width: cell.width,
        motion: cell.motion,
        playMode: cell.playMode,
        accepted: accepted.accepted,
        acceptedDeliveryVersion: accepted.snapshot.deliveryVersion,
        lifecycle: accepted.snapshot.lifecycle,
        acceptedNextAction: accepted.nextAction,
        turnStatus: geometry.turnText,
        viewport: viewports[cell.width],
        controlRect: accepted.geometry,
        documentScrollWidth: geometry.scrollWidth,
        motionSamples,
        ...(sudokuLayout ? { sudokuLayout } : {}),
        screenshot: path.relative(process.cwd(), screenshot).replaceAll("\\", "/"),
      });
    } catch (error) {
      failures.push({
        id: cell.id,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (matchId && matchOwnerPage) {
        try {
          const saved = await view(matchOwnerPage, matchId);
          if (saved.lifecycle === "active")
            await action(
              matchOwnerPage,
              matchId,
              saved.mode === "practice" ? "match.request-abandon" : "match.agree-abandon",
            );
        } catch (error) {
          failures.push({
            id: `${cell.id}-cleanup`,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      matchId = undefined;
      matchOwnerPage = undefined;
      persistProgress("IN_PROGRESS");
    }
  }

  const complete = records.length === allCells.length && failures.length === 0;
  persistProgress(complete ? "RUN_COMPLETE" : "IN_PROGRESS");
  expect(failures, `VIS failure records: ${reportPath}`).toEqual([]);
  const expectedIds = [
    ...(previous?.records ?? [])
      .filter((record) => Number(String(record.id).slice(4)) < resumeFrom)
      .map((record) => String(record.id)),
    ...cells.map((cell) => cell.id),
  ].sort();
  expect(records.map((record) => record.id)).toEqual(expectedIds);
});
