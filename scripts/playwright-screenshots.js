/**
 * Cross-browser screenshot matrix for the GEOGLOWS portal.
 *
 * Runs inside the official Playwright Docker container. Tests the
 * production build across Chrome, Safari (WebKit), and Firefox at
 * phone, tablet, and desktop viewports.
 *
 * Usage (from project root):
 *   npm run build
 *   npm run screenshots
 *
 * Or directly:
 *   docker run --rm -v /tmp/pw-screenshots:/tmp/screenshots \
 *     -v $(pwd)/dist:/dist:ro -w /work \
 *     mcr.microsoft.com/playwright:v1.52.0-noble \
 *     bash -c "npm init -y >/dev/null 2>&1 && npm i playwright@1.52.0 >/dev/null 2>&1 && node /dist/../scripts/playwright-screenshots.js"
 */

const { chromium, webkit, firefox, devices } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST_DIR = process.env.DIST_DIR || "/dist";
const OUT_DIR = process.env.OUT_DIR || "/tmp/screenshots";
const URL = process.env.TARGET_URL || null;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

const TARGETS = [
  { name: "chrome-phone", engine: chromium, opts: devices["iPhone 14"] },
  { name: "safari-phone", engine: webkit, opts: devices["iPhone 14"] },
  { name: "firefox-phone", engine: firefox, opts: { viewport: { width: 390, height: 844 } } },
  { name: "chrome-tablet", engine: chromium, opts: devices["iPad Mini"] },
  { name: "safari-tablet", engine: webkit, opts: devices["iPad Mini"] },
  { name: "firefox-tablet", engine: firefox, opts: { viewport: { width: 768, height: 1024 } } },
  { name: "chrome-desktop", engine: chromium, opts: { viewport: { width: 1440, height: 900 } } },
  { name: "safari-desktop", engine: webkit, opts: { viewport: { width: 1440, height: 900 } } },
  { name: "firefox-desktop", engine: firefox, opts: { viewport: { width: 1440, height: 900 } } },
];

function startLocalServer() {
  const server = http.createServer((req, res) => {
    let p = req.url.split("?")[0];
    if (p === "/") p = "/index.html";
    const fp = path.join(DIST_DIR, p);
    try {
      const data = fs.readFileSync(fp);
      const ext = path.extname(fp);
      res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(8888);
  return server;
}

async function testTarget(t, baseUrl) {
  const browser = await t.engine.launch({ headless: true });
  const context = await browser.newContext(t.opts);
  const page = await context.newPage();

  const result = { name: t.name, pass: false, dialog: "n/a", html: 0, cards: 0, error: null };

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 15000 });
    await page.waitForTimeout(2000);

    const dialogInfo = await page.evaluate(() => {
      const d = document.querySelector("#geoglows-disclaimer-modal");
      if (!d || !d.open) return null;
      const r = d.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    });

    if (dialogInfo) {
      result.dialog = `${dialogInfo.w}x${dialogInfo.h}`;
      await page.screenshot({ path: path.join(OUT_DIR, `${t.name}-modal.png`), fullPage: false });

      await page.click("#geoglows-disclaimer-accept", { timeout: 5000 });
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: path.join(OUT_DIR, `${t.name}-landing.png`), fullPage: false });

    const info = await page.evaluate(() => ({
      html: document.querySelector("#app").innerHTML.length,
      cards: document.querySelectorAll("[data-app-id]").length,
    }));

    result.html = info.html;
    result.cards = info.cards;
    result.pass = info.html > 1000 && info.cards > 0;

    // Scroll to cards
    await page.evaluate(() => {
      const el = document.querySelector("[data-anim=cascade]");
      if (el) el.scrollIntoView({ behavior: "instant" });
    });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, `${t.name}-cards.png`), fullPage: false });

    // Full page
    await page.screenshot({ path: path.join(OUT_DIR, `${t.name}-full.png`), fullPage: true });

  } catch (e) {
    result.error = e.message.split("\n")[0].substring(0, 60);
    await page.screenshot({ path: path.join(OUT_DIR, `${t.name}-error.png`), fullPage: false }).catch(() => {});
  }

  await context.close();
  await browser.close();
  return result;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let server = null;
  let baseUrl = URL;
  if (!baseUrl) {
    server = startLocalServer();
    baseUrl = "http://localhost:8888/";
  }

  const results = [];
  for (const t of TARGETS) {
    process.stdout.write(`  ${t.name}...`);
    const r = await testTarget(t, baseUrl);
    results.push(r);
    console.log(r.pass ? " OK" : ` FAIL${r.error ? " - " + r.error : ""}`);
  }

  console.log("");
  console.log("Device               | Pass | Dialog    | HTML   | Cards");
  console.log("---------------------|------|-----------|--------|------");
  for (const r of results) {
    console.log(
      r.name.padEnd(20) + " | " +
      (r.pass ? " OK " : "FAIL") + " | " +
      r.dialog.padEnd(9) + " | " +
      String(r.html).padEnd(6) + " | " +
      r.cards
    );
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log("");
  console.log(`${passed}/${total} passed. Screenshots saved to ${OUT_DIR}`);

  if (server) server.close();
  process.exit(passed === total ? 0 : 1);
})();
