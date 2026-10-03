import { test, expect } from "@playwright/test";
import { action, login, view } from "./helpers";

test("Back preserves an active match, saved setup resumes it, and intentional abandon is confirmed", async ({
  page,
}) => {
  await login(page, "A");
  await page.goto("/games/connect-four");
  await page.getByRole("button", { name: /^Together/ }).click();
  await page.getByRole("button", { name: "Start Match", exact: true }).click();
  await expect(page).toHaveURL(/\/matches\//);

  const matchId = page.url().split("/").at(-1)!;
  try {
    await expect(
      page.getByRole("button", { name: "Drop disc into column 1", exact: true }),
    ).toBeEnabled();
    expect((await view(page, matchId)).lifecycle).toBe("active");

    await page.getByRole("button", { name: "Go back", exact: true }).click();
    await expect(page).toHaveURL(/\/games\/connect-four$/);
    expect((await view(page, matchId)).lifecycle).toBe("active");

    await page.getByRole("button", { name: /^Together/ }).click();
    await expect(page.getByText("A together match is ready to resume")).toBeVisible();
    await page.getByRole("button", { name: "Resume Match", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/matches/${matchId}$`));
    expect((await view(page, matchId)).lifecycle).toBe("active");

    await page.getByRole("button", { name: "Match Options", exact: true }).click();
    await page.getByRole("button", { name: "Abandon without a score", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Abandon without a score?" })).toBeVisible();
    await page.getByRole("button", { name: "Confirm unscored abandonment", exact: true }).click();
    await expect.poll(async () => (await view(page, matchId)).lifecycle).toBe("abandoned");
  } finally {
    const saved = await view(page, matchId);
    if (saved.lifecycle === "active") await action(page, matchId, "match.agree-abandon");
  }
});
