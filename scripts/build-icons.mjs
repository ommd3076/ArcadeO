import fs from "node:fs";
import path from "node:path";
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.resolve(".local/browsers");
const { chromium } = await import("playwright");
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const svg = fs.readFileSync("public/icon.svg", "utf8");
  for (const size of [192, 512]) {
    const png = await page.evaluate(async ({ svg, size }) => {
      const img = new Image();
      img.src = `data:image/svg+xml;base64,${btoa(svg)}`;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      canvas.getContext("2d").drawImage(img, 0, 0, size, size);
      return canvas.toDataURL("image/png").split(",")[1];
    }, { svg, size });
    fs.writeFileSync(`public/icon-${size}.png`, Buffer.from(png, "base64"));
  }
} finally { await browser.close(); }
console.log("INSTALLATION_ICONS_BUILT");
