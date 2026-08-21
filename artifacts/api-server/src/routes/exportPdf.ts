import { Router, type IRouter } from "express";
import puppeteer from "puppeteer";
import { execSync } from "child_process";
import path from "path";
import fs from "fs";

const router: IRouter = Router();

// The server is always started from Veloz-Trade/artifacts/api-server/ (see package.json "start" script).
// process.cwd() is therefore the api-server directory; two levels up reaches the Veloz-Trade root.
const HTML_PATH = path.resolve(
  process.cwd(),
  "../../veloztrade-platform-document.html",
);

// Warn clearly at startup if the source document is missing so the problem
// is caught immediately rather than at first PDF request.
if (!fs.existsSync(HTML_PATH)) {
  console.warn(
    `[exportPdf] WARNING: platform document not found at ${HTML_PATH}. ` +
      "PDF export will return 404 until the file is present.",
  );
}

function findChromiumExecutable(): string | undefined {
  const candidates = [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ];
  for (const bin of candidates) {
    try {
      const p = execSync(`which ${bin}`, { encoding: "utf-8" }).trim();
      if (p) return p;
    } catch {
      // not found, try next
    }
  }
  return undefined;
}

const CHROMIUM_PATH = findChromiumExecutable();

router.get("/export/platform-pdf", async (_req, res) => {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;
  try {
    if (!fs.existsSync(HTML_PATH)) {
      res.status(404).json({ error: "Platform document not found" });
      return;
    }

    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    };

    if (CHROMIUM_PATH) {
      launchOptions.executablePath = CHROMIUM_PATH;
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();

    const htmlContent = fs.readFileSync(HTML_PATH, "utf-8");

    await page.setContent(htmlContent, {
      waitUntil: "networkidle0",
      timeout: 30000,
    });

    await page.emulateMediaType("print");

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="VelozTrade-Platform-Overview.pdf"',
    );
    res.setHeader("Content-Length", pdfBuffer.byteLength);
    res.end(Buffer.from(pdfBuffer));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "PDF generation failed", details: message });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

export default router;
