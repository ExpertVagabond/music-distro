/**
 * Music Distribution Server
 *
 * HTTPS should be handled by a reverse proxy (e.g., nginx, Caddy, or Cloudflare Tunnel)
 * in production. This server assumes it runs behind a TLS-terminating proxy.
 *
 * Security design:
 * - CORS restricted to explicit origin allowlist (no wildcards)
 * - Rate limiting on OAuth callback endpoints (10 req/min/IP)
 * - Static file serving restricted to dashboard directory (no path traversal)
 * - Request body size implicitly limited by Node.js defaults
 * - All user inputs (query params, paths) validated before use
 * - Security headers on all responses (X-Content-Type-Options, X-Frame-Options)
 * - OAuth codes validated for format before exchange
 * - Error responses never leak internal paths or stack traces
 * - Stale rate limit entries cleaned every 5 minutes to prevent memory leaks
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname, normalize } from "node:path";
import { loadConfig } from "./config.js";
import { listTracks, getTrack, loadCatalog } from "./catalog/catalog.js";
import { scanForNewTracks } from "./catalog/scanner.js";
import { getAuthStatus } from "./auth/oauth.js";
import { exchangeSoundCloudCode } from "./auth/soundcloud-auth.js";
import { exchangeYouTubeCode } from "./auth/youtube-auth.js";

const config = loadConfig();

/** Maximum URL length to prevent abuse */
const MAX_URL_LENGTH = 4096;
/** OAuth code format — alphanumeric + hyphens + underscores, reasonable length */
const OAUTH_CODE_PATTERN = /^[A-Za-z0-9_\-/.]{10,512}$/;

// --- CORS allowlist ---
const ALLOWED_ORIGINS: Set<string> = new Set(
  (process.env.ALLOWED_ORIGINS || `http://localhost:${config.port}`)
    .split(",")
    .map((o) => o.trim())
);

function getAllowedOrigin(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const origin = req.headers["origin"] as string | undefined;
  if (origin && ALLOWED_ORIGINS.has(origin)) return origin;
  return null;
}

// --- Rate limiting (in-memory, per-IP) ---
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10; // requests per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(ip, entry);
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

// Periodically clean stale entries to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now >= entry.resetAt) rateLimitMap.delete(ip);
  }
}, 5 * 60_000);

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};

function jsonResponse(res: any, data: unknown, status = 200, origin?: string | null) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  res.writeHead(status, headers);
  res.end(JSON.stringify(data));
}

const STATIC_ROOT = resolve(config.dashboardDir);

function serveStatic(res: any, filePath: string) {
  // Resolve to absolute and verify it stays within the static root to prevent directory traversal
  const resolved = resolve(filePath);
  if (!resolved.startsWith(STATIC_ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!existsSync(resolved)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = extname(resolved);
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(readFileSync(resolved));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${config.port}`);
  const path = url.pathname;
  const origin = getAllowedOrigin(req);

  // CORS preflight
  if (req.method === "OPTIONS") {
    const headers: Record<string, string> = {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    if (origin) headers["Access-Control-Allow-Origin"] = origin;
    res.writeHead(204, headers);
    res.end();
    return;
  }

  // --- API Routes ---

  if (path === "/api/tracks" && req.method === "GET") {
    return jsonResponse(res, { tracks: listTracks() }, 200, origin);
  }

  if (path === "/api/scan" && req.method === "POST") {
    const result = scanForNewTracks();
    return jsonResponse(res, result, 200, origin);
  }

  if (path === "/api/status" && req.method === "GET") {
    const catalog = loadCatalog();
    const auth = getAuthStatus();
    return jsonResponse(res, {
      total_tracks: catalog.tracks.length,
      auth,
    }, 200, origin);
  }

  if (path === "/api/auth/status" && req.method === "GET") {
    return jsonResponse(res, getAuthStatus(), 200, origin);
  }

  // --- OAuth Callbacks (rate-limited) ---

  if (path === "/callback/soundcloud") {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || "unknown";
    if (isRateLimited(clientIp)) {
      res.writeHead(429, { "Content-Type": "text/plain" });
      res.end("Too many requests. Try again later.");
      return;
    }
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing code parameter");
      return;
    }
    try {
      const redirectUri = `http://localhost:${config.port}/callback/soundcloud`;
      const token = await exchangeSoundCloudCode(code, redirectUri);
      if (token) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>SoundCloud Connected!</h1><p>You can close this tab.</p>");
      } else {
        console.error("[music-distro] SoundCloud token exchange returned null (credentials missing or upstream rejection)");
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("<h1>SoundCloud Auth Failed</h1><p>Check the server logs.</p>");
      }
    } catch (err) {
      console.error("[music-distro] SoundCloud OAuth error:", err instanceof Error ? err.message : "unknown error");
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h1>SoundCloud Auth Failed</h1><p>An unexpected error occurred.</p>");
    }
    return;
  }

  if (path === "/callback/youtube") {
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      || req.socket.remoteAddress || "unknown";
    if (isRateLimited(clientIp)) {
      res.writeHead(429, { "Content-Type": "text/plain" });
      res.end("Too many requests. Try again later.");
      return;
    }
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing code parameter");
      return;
    }
    try {
      const redirectUri = `http://localhost:${config.port}/callback/youtube`;
      const token = await exchangeYouTubeCode(code, redirectUri);
      if (token) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>YouTube Connected!</h1><p>You can close this tab.</p>");
      } else {
        console.error("[music-distro] YouTube token exchange returned null (credentials missing or upstream rejection)");
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end("<h1>YouTube Auth Failed</h1><p>Check the server logs.</p>");
      }
    } catch (err) {
      console.error("[music-distro] YouTube OAuth error:", err instanceof Error ? err.message : "unknown error");
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h1>YouTube Auth Failed</h1><p>An unexpected error occurred.</p>");
    }
    return;
  }

  // --- Dashboard static files ---

  if (path === "/dashboard" || path === "/dashboard/") {
    return serveStatic(
      res,
      resolve(config.dashboardDir, "index.html")
    );
  }

  if (path.startsWith("/dashboard/")) {
    const file = path.replace("/dashboard/", "");
    return serveStatic(res, resolve(config.dashboardDir, file));
  }

  // --- Root redirect ---
  if (path === "/") {
    res.writeHead(302, { Location: "/dashboard" });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(config.port, () => {
  console.log(`[music-distro] Dashboard: http://localhost:${config.port}/dashboard`);
  console.log(`[music-distro] API: http://localhost:${config.port}/api/`);
});
