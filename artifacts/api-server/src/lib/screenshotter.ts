import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import archiver from "archiver";
import path from "path";
import os from "os";
import fs from "fs";
import { execSync } from "child_process";
import { logger } from "./logger";

function findSystemChromium(): string | undefined {
  if (process.platform === "win32") {
    return undefined;
  }
  for (const candidate of ["chromium", "chromium-browser", "google-chrome"]) {
    try {
      const resolved = execSync(`which ${candidate}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();
      if (resolved) return resolved;
    } catch {
      // not found, try next
    }
  }
  return undefined;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const MAX_URLS = 50;
const PAGE_TIMEOUT_MS = 10000;
const VIEWPORT_WIDTH = 1440;

export type LogType = "info" | "success" | "error" | "warning";

export interface LogEntry {
  timestamp: string;
  message: string;
  type: LogType;
}

export interface ScreenshotJob {
  id: string;
  url: string;
  mode: "crawl" | "single";
  status: "pending" | "running" | "completed" | "cancelled" | "failed";
  screenshotCount: number;
  totalUrls: number;
  currentUrl?: string;
  log: LogEntry[];
  downloadReady: boolean;
  zipPath?: string;
  pngPath?: string;
  createdAt: string;
  completedAt?: string;
  abortController: AbortController;
}

function addLog(job: ScreenshotJob, message: string, type: LogType = "info") {
  job.log.push({
    timestamp: new Date().toISOString(),
    message,
    type,
  });
  logger.info({ jobId: job.id, message, type }, "Job log");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomDelay(signal?: AbortSignal): Promise<void> {
  const ms = 1000 + Math.random() * 2000;
  return new Promise<void>((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
  });
}

function isSameDomain(urlStr: string, baseHost: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./, "");
    const base = baseHost.replace(/^www\./, "");
    return host === base;
  } catch {
    return false;
  }
}

function isPageLink(urlStr: string): boolean {
  const skipExtensions = [
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
    ".rar",
    ".exe",
    ".dmg",
    ".pkg",
    ".deb",
    ".rpm",
    ".apk",
    ".docx",
    ".xlsx",
    ".pptx",
    ".csv",
    ".xml",
    ".json",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".mp4",
    ".mp3",
    ".wav",
    ".avi",
    ".mov",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
  ];
  try {
    const u = new URL(urlStr);
    const scheme = u.protocol;
    if (!["http:", "https:"].includes(scheme)) return false;
    const ext = path.extname(u.pathname).toLowerCase();
    if (skipExtensions.includes(ext)) return false;
    return true;
  } catch {
    return false;
  }
}

function normalizeUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    u.hash = "";
    let pathname = u.pathname.replace(/\/+$/, "") || "/";
    u.pathname = pathname;
    return u.toString();
  } catch {
    return urlStr;
  }
}

function slugifyUrl(urlStr: string, index: number): string {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.replace(/^www\./, "");
    const pathname = u.pathname
      .replace(/^\//, "")
      .replace(/\//g, "-")
      .replace(/[^a-zA-Z0-9-]/g, "")
      .toLowerCase()
      .slice(0, 40);
    const label = pathname || "homepage";
    const idx = String(index).padStart(2, "0");
    return `${idx}_${host.replace(/\./g, "-")}_${label}`;
  } catch {
    return `${String(index).padStart(2, "0")}_page`;
  }
}

function isBotWall(title: string): boolean {
  const lower = title.toLowerCase();
  return lower.includes("captcha") || lower.includes("access denied") || lower.includes("robot") || lower.includes("are you human");
}

async function runSingleShot(
  job: ScreenshotJob,
  browser: Awaited<ReturnType<typeof chromium.launch>>,
  signal: AbortSignal,
  tmpDir: string
): Promise<void> {
  job.totalUrls = 1;

  addLog(job, `Taking full-page screenshot of ${job.url}…`, "info");

  let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

  const onAbort = () => { page?.close().catch(() => {}); };
  signal.addEventListener("abort", onAbort, { once: true });

  try {
    page = await browser.newPage();
    if (signal.aborted) {
      job.status = "cancelled";
      addLog(job, "Job cancelled by user", "warning");
      return;
    }

    await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });
    await page.setViewportSize({ width: VIEWPORT_WIDTH, height: 900 });

    const response = await page.goto(job.url, {
      timeout: PAGE_TIMEOUT_MS,
      waitUntil: "load",
    });

    if (!response || response.status() >= 400) {
      addLog(job, `Failed to load page — HTTP ${response?.status()}`, "error");
      job.status = "failed";
      job.completedAt = new Date().toISOString();
      return;
    }

    const title = await page.title();
    if (isBotWall(title)) {
      addLog(job, "Bot detection wall encountered — screenshot may be incomplete", "warning");
    }

    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
    await page.waitForTimeout(800);
    await page.evaluate("window.scrollTo(0, 0)");
    await page.waitForTimeout(400);

    const pngPath = path.join(os.tmpdir(), `websnap-${job.id}.png`);

    await page.screenshot({ path: pngPath, fullPage: true });

    job.pngPath = pngPath;
    job.screenshotCount = 1;
    job.downloadReady = true;
    job.status = "completed";
    job.completedAt = new Date().toISOString();
    addLog(job, "Screenshot captured — ready to download!", "success");
  } catch (err) {
    if (signal.aborted) {
      addLog(job, "Job cancelled by user", "warning");
      job.status = "cancelled";
    } else {
      addLog(job, `Failed: ${String(err)}`, "error");
      job.status = "failed";
    }
    job.completedAt = new Date().toISOString();
  } finally {
    signal.removeEventListener("abort", onAbort);
    if (page) await page.close().catch(() => {});
  }
}

export async function runScreenshotJob(job: ScreenshotJob): Promise<void> {
  const signal = job.abortController.signal;

  chromium.use(StealthPlugin());

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "websnap-"));

  try {
    job.status = "running";
    addLog(job, `Starting job for ${job.url}`, "info");

    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ];

    const envExecutable = process.env["CHROMIUM_EXECUTABLE_PATH"];

    if (envExecutable) {
      browser = await chromium.launch({
        headless: true,
        executablePath: envExecutable,
        args: launchArgs,
      });
    } else {
      try {
        browser = await chromium.launch({
          headless: true,
          args: launchArgs,
        });
      } catch (bundledErr) {
        const systemExecutable = findSystemChromium();
        if (!systemExecutable) {
          throw bundledErr;
        }
        logger.warn(
          { systemExecutable, err: bundledErr },
          "Bundled Chromium unavailable; falling back to system binary",
        );
        browser = await chromium.launch({
          headless: true,
          executablePath: systemExecutable,
          args: launchArgs,
        });
      }
    }

    if (signal.aborted) {
      addLog(job, "Job cancelled before starting", "warning");
      job.status = "cancelled";
      return;
    }

    if (job.mode === "single") {
      await runSingleShot(job, browser, signal, tmpDir);
      return;
    }

    addLog(job, "Discovering links... (one hop only — no recursive crawling)", "info");

    const discoveryPage = await browser.newPage();

    const onAbortDiscovery = () => { discoveryPage.close().catch(() => {}); };
    signal.addEventListener("abort", onAbortDiscovery, { once: true });

    await discoveryPage.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });
    await discoveryPage.setViewportSize({ width: VIEWPORT_WIDTH, height: 900 });

    let discoveredLinks: string[] = [];

    try {
      if (signal.aborted) throw new Error("Aborted");

      const response = await discoveryPage.goto(job.url, {
        timeout: PAGE_TIMEOUT_MS,
        waitUntil: "domcontentloaded",
      });

      if (!response || response.status() >= 400) {
        addLog(job, `Failed to load ${job.url} — status ${response?.status()}`, "error");
        job.status = "failed";
        await discoveryPage.close();
        return;
      }

      const title = await discoveryPage.title();
      if (isBotWall(title)) {
        addLog(job, `Bot detection on ${job.url} — aborting`, "error");
        job.status = "failed";
        await discoveryPage.close();
        return;
      }

      const baseUrl = new URL(job.url);
      const baseHost = baseUrl.hostname;

      const hrefs: string[] = await discoveryPage.evaluate(
        "Array.from(document.querySelectorAll('a[href]')).map(a => a.href)"
      ) as string[];

      const seen = new Set<string>();
      seen.add(normalizeUrl(job.url));

      for (const href of hrefs) {
        const normalized = normalizeUrl(href);
        if (
          !seen.has(normalized) &&
          isSameDomain(normalized, baseHost) &&
          isPageLink(normalized)
        ) {
          seen.add(normalized);
          discoveredLinks.push(normalized);
        }
      }
    } catch (err) {
      signal.removeEventListener("abort", onAbortDiscovery);
      await discoveryPage.close().catch(() => {});
      if (signal.aborted) {
        addLog(job, "Job cancelled by user", "warning");
        job.status = "cancelled";
        return;
      }
      addLog(job, `Error loading ${job.url}: ${String(err)}`, "error");
      job.status = "failed";
      return;
    }

    signal.removeEventListener("abort", onAbortDiscovery);
    await discoveryPage.close().catch(() => {});

    if (discoveredLinks.length > MAX_URLS - 1) {
      addLog(
        job,
        `Found ${discoveredLinks.length + 1} links — only the first ${MAX_URLS} will be screenshotted to keep things manageable.`,
        "warning"
      );
      discoveredLinks = discoveredLinks.slice(0, MAX_URLS - 1);
    } else {
      addLog(
        job,
        `Discovered ${discoveredLinks.length} link${discoveredLinks.length !== 1 ? "s" : ""}. Preparing to screenshot...`,
        "info"
      );
    }

    const urlsToShot = [job.url, ...discoveredLinks];
    job.totalUrls = urlsToShot.length;

    const indexLines: string[] = [];
    let screenshotIndex = 0;

    let activePage: Awaited<ReturnType<typeof browser.newPage>> | null = null;
    const onAbort = () => {
      activePage?.close().catch(() => {});
    };
    signal.addEventListener("abort", onAbort, { once: true });

    for (let i = 0; i < urlsToShot.length; i++) {
      if (signal.aborted) {
        addLog(job, "Job cancelled by user", "warning");
        job.status = "cancelled";
        break;
      }

      const url = urlsToShot[i];
      const filename = slugifyUrl(url, i + 1);
      job.currentUrl = url;

      addLog(job, `Taking screenshot ${i + 1} of ${urlsToShot.length}: ${url}`, "info");

      let page: Awaited<ReturnType<typeof browser.newPage>> | null = null;

      try {
        page = await browser.newPage();
        activePage = page;
        if (signal.aborted) break;
        await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });
        await page.setViewportSize({ width: VIEWPORT_WIDTH, height: 900 });

        const response = await page.goto(url, {
          timeout: PAGE_TIMEOUT_MS,
          waitUntil: "load",
        });

        if (!response || response.status() >= 400) {
          addLog(job, `Skipped ${url} — HTTP ${response?.status()}`, "warning");
          indexLines.push(`-\t${url}\t[blocked]`);
          await page.close();
          page = null;
          continue;
        }

        const title = await page.title();

        if (isBotWall(title)) {
          addLog(job, `Skipped ${url} — bot detection wall detected`, "warning");
          indexLines.push(`-\t${url}\t[blocked]`);
          await page.close();
          page = null;
          continue;
        }

        await page
          .waitForLoadState("networkidle", { timeout: 5000 })
          .catch(() => {});

        await page.evaluate(
          "window.scrollTo(0, document.body.scrollHeight)"
        );
        await page.waitForTimeout(800);
        await page.evaluate("window.scrollTo(0, 0)");
        await page.waitForTimeout(400);

        const pageHeight = await page.evaluate(
          "document.documentElement.scrollHeight"
        ) as number;
        const LONG_PAGE_THRESHOLD = 900 * 3;
        const isLongPage = pageHeight > LONG_PAGE_THRESHOLD;

        if (isLongPage) {
          const fullLengthFilename = `${filename}-full-length.png`;
          const regularFilename = `${filename}-regular.png`;

          await page.screenshot({
            path: path.join(tmpDir, fullLengthFilename),
            fullPage: true,
          });

          await page.setViewportSize({ width: VIEWPORT_WIDTH, height: 900 });
          await page.screenshot({
            path: path.join(tmpDir, regularFilename),
            fullPage: false,
          });

          screenshotIndex++;
          job.screenshotCount = screenshotIndex;
          indexLines.push(`${fullLengthFilename}\t${url}`);
          indexLines.push(`${regularFilename}\t${url}`);
          addLog(job, `Captured: ${fullLengthFilename} + ${regularFilename} (long page: ${pageHeight}px)`, "success");
        } else {
          const singleFilename = `${filename}.png`;

          await page.screenshot({
            path: path.join(tmpDir, singleFilename),
            fullPage: true,
          });

          screenshotIndex++;
          job.screenshotCount = screenshotIndex;
          indexLines.push(`${singleFilename}\t${url}`);
          addLog(job, `Captured: ${singleFilename}`, "success");
        }
      } catch (err) {
        if (signal.aborted) {
          break;
        }
        const errMsg = String(err);
        const isTimeout =
          errMsg.toLowerCase().includes("timeout") ||
          errMsg.toLowerCase().includes("timed out");
        addLog(
          job,
          `Skipped ${url} — ${isTimeout ? "timed out" : "error loading page"}`,
          "warning"
        );
        indexLines.push(`-\t${url}\t[blocked]`);
      } finally {
        if (page) {
          await page.close().catch(() => {});
        }
        activePage = null;
      }

      if (i < urlsToShot.length - 1 && !signal.aborted) {
        await randomDelay(signal);
      }
    }

    signal.removeEventListener("abort", onAbort);

    if (signal.aborted && job.status !== "cancelled") {
      addLog(job, "Job cancelled by user", "warning");
      job.status = "cancelled";
    }

    if (job.status !== "cancelled") {
      const indexContent =
        "filename\turl\tstatus\n" +
        indexLines.join("\n") +
        "\n";
      fs.writeFileSync(path.join(tmpDir, "index.txt"), indexContent, "utf-8");

      const zipPath = path.join(os.tmpdir(), `websnap-${job.id}.zip`);
      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 6 } });

        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);
        archive.directory(tmpDir, false);
        archive.finalize();
      });

      job.zipPath = zipPath;
      job.downloadReady = true;
      job.status = "completed";
      job.completedAt = new Date().toISOString();
      addLog(
        job,
        `Done! ${job.screenshotCount} screenshot${job.screenshotCount !== 1 ? "s" : ""} captured.`,
        "success"
      );
    }
  } catch (err) {
    addLog(job, `Job failed: ${String(err)}`, "error");
    job.status = "failed";
    job.completedAt = new Date().toISOString();
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    fs.rm(tmpDir, { recursive: true, force: true }, () => {});
  }
}
