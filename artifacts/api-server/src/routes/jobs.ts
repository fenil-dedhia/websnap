import { Router, type IRouter, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import dns from "dns/promises";
import fs from "fs";
import type { ScreenshotJob } from "../lib/screenshotter";
import { runScreenshotJob } from "../lib/screenshotter";

const router: IRouter = Router();

const jobs = new Map<string, ScreenshotJob>();

let activeJobId: string | null = null;

function isValidUrl(str: string): boolean {
  try {
    const u = new URL(str);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

const BLOCKED_PRIVATE_RANGES = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^::1$/,
  /^0\./,
  /^169\.254\./,
  /^100\.64\./,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^0\.0\.0\.0/,
];

function isPrivateIp(ip: string): boolean {
  return BLOCKED_PRIVATE_RANGES.some((re) => re.test(ip));
}

function isPrivateHostnameSync(hostname: string): boolean {
  return isPrivateIp(hostname);
}

async function isPrivateHostDns(urlStr: string): Promise<boolean> {
  try {
    const u = new URL(urlStr);
    const hostname = u.hostname;
    if (isPrivateIp(hostname)) return true;
    let addresses: string[] = [];
    try {
      const result = await dns.resolve4(hostname);
      addresses = addresses.concat(result);
    } catch {
      // no IPv4 — that's fine, try IPv6
    }
    try {
      const result = await dns.resolve6(hostname);
      addresses = addresses.concat(result);
    } catch {
      // no IPv6 — that's fine
    }
    if (addresses.length === 0) {
      return false;
    }
    return addresses.some((ip) => isPrivateIp(ip));
  } catch {
    return true;
  }
}

function serializeJob(job: ScreenshotJob) {
  return {
    id: job.id,
    url: job.url,
    mode: job.mode,
    status: job.status,
    screenshotCount: job.screenshotCount,
    totalUrls: job.totalUrls,
    currentUrl: job.currentUrl,
    log: job.log,
    downloadReady: job.downloadReady,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
  };
}

function getJobId(req: Request): string {
  const raw = req.params["jobId"];
  return Array.isArray(raw) ? (raw[0] ?? "") : (raw ?? "");
}

router.post("/jobs", async (req: Request, res: Response) => {
  const { url, mode: rawMode } = req.body as { url?: string; mode?: string };
  const mode: "crawl" | "single" = rawMode === "single" ? "single" : "crawl";

  if (!url || !isValidUrl(url)) {
    res.status(400).json({ error: "A valid http/https URL is required." });
    return;
  }

  if (isPrivateHostnameSync(url) || (await isPrivateHostDns(url))) {
    res.status(400).json({ error: "URLs pointing to private or internal network addresses are not allowed." });
    return;
  }

  if (activeJobId !== null) {
    const active = jobs.get(activeJobId);
    if (active && (active.status === "pending" || active.status === "running")) {
      res.status(409).json({ error: "A job is already in progress." });
      return;
    }
    activeJobId = null;
  }

  const jobId = randomUUID();
  const abortController = new AbortController();

  const job: ScreenshotJob = {
    id: jobId,
    url,
    mode,
    status: "pending",
    screenshotCount: 0,
    totalUrls: 0,
    log: [],
    downloadReady: false,
    createdAt: new Date().toISOString(),
    abortController,
  };

  jobs.set(jobId, job);
  activeJobId = jobId;

  runScreenshotJob(job).then(() => {
    if (activeJobId === jobId) {
      activeJobId = null;
    }
  });

  res.status(201).json(serializeJob(job));
});

router.get("/jobs/:jobId", (req: Request, res: Response) => {
  const jobId = getJobId(req);
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  res.json(serializeJob(job));
});

router.post("/jobs/:jobId/cancel", (req: Request, res: Response) => {
  const jobId = getJobId(req);
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }

  if (job.status === "running" || job.status === "pending") {
    job.abortController.abort();
  }

  res.json(serializeJob(job));
});

router.get("/jobs/:jobId/download", (req: Request, res: Response) => {
  const jobId = getJobId(req);
  const job = jobs.get(jobId);
  if (!job) {
    res.status(404).json({ error: "Job not found." });
    return;
  }
  if (!job.downloadReady) {
    res.status(404).json({ error: "Download not ready." });
    return;
  }

  if (job.mode === "single") {
    if (!job.pngPath) {
      res.status(404).json({ error: "Download not ready." });
      return;
    }
    try {
      const { hostname } = new URL(job.url);
      const safeName = hostname.replace(/[^a-zA-Z0-9.-]/g, "-");
      const filename = `websnap-${safeName}.png`;
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      const stream = fs.createReadStream(job.pngPath);
      stream.on("error", (err: Error) => {
        req.log.error({ err }, "Error streaming PNG file");
        if (!res.headersSent) res.status(500).json({ error: "Failed to stream file." });
      });
      stream.pipe(res);
    } catch {
      res.status(500).json({ error: "Failed to stream file." });
    }
    return;
  }

  if (!job.zipPath) {
    res.status(404).json({ error: "Download not ready." });
    return;
  }

  const filename = `websnap-screenshots.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const stream = fs.createReadStream(job.zipPath);
  stream.on("error", (err: Error) => {
    req.log.error({ err }, "Error streaming ZIP file");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream file." });
    }
  });
  stream.pipe(res);
});

export default router;
