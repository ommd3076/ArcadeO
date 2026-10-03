import fs from "node:fs";
import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(".local/browsers");
const { chromium } = await import("playwright");
const a = JSON.parse(fs.readFileSync(".local/accounts.json", "utf8"));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => console.log("PAGE_ERROR", e.message));
  await page.goto("http://localhost:8787/login");
  console.log("LOGIN", await page.locator("body").innerText());
  await page.getByLabel(/Username|Account/).fill(a.playerAUser);
  await page.getByLabel("Password").fill(a.playerAPassword);
  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await page.waitForURL("http://localhost:8787/");
  console.log("HOME", await page.locator("body").innerText());
  fs.mkdirSync(".local/evidence", { recursive: true });
  await page.screenshot({ path: ".local/evidence/home-mobile-initial.png", fullPage: true });
} finally { await browser.close(); }
