import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { resolve, extname } from "node:path";
import { loadConfig } from "./config.js";
import { listTracks, getTrack, loadCatalog } from "./catalog/catalog.js";
import { scanForNewTracks } from "./catalog/scanner.js";
import { getAuthStatus } from "./auth/oauth.js";
import { exchangeSoundCloudCode } from "./auth/soundcloud-auth.js";
import { exchangeYouTubeCode } from "./auth/youtube-auth.js";

const config = loadConfig();

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

function jsonResponse(res: any, data: unknown, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function serveStatic(res: any, filePath: string) {
  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": mime });
  res.end(readFileSync(filePath));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${config.port}`);
  const path = url.pathname;

  // CORS
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  // --- API Routes ---

  if (path === "/api/tracks" && req.method === "GET") {
    return jsonResponse(res, { tracks: listTracks() });
  }

  if (path === "/api/scan" && req.method === "POST") {
    const result = scanForNewTracks();
    return jsonResponse(res, result);
  }

  if (path === "/api/status" && req.method === "GET") {
    const catalog = loadCatalog();
    const auth = getAuthStatus();
    return jsonResponse(res, {
      total_tracks: catalog.tracks.length,
      auth,
    });
  }

  if (path === "/api/auth/status" && req.method === "GET") {
    return jsonResponse(res, getAuthStatus());
  }

  // --- OAuth Callbacks ---

  if (path === "/callback/soundcloud") {
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing code parameter");
      return;
    }
    const redirectUri = `http://localhost:${config.port}/callback/soundcloud`;
    const token = await exchangeSoundCloudCode(code, redirectUri);
    if (token) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>SoundCloud Connected!</h1><p>You can close this tab.</p>");
    } else {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h1>SoundCloud Auth Failed</h1><p>Check the server logs.</p>");
    }
    return;
  }

  if (path === "/callback/youtube") {
    const code = url.searchParams.get("code");
    if (!code) {
      res.writeHead(400);
      res.end("Missing code parameter");
      return;
    }
    const redirectUri = `http://localhost:${config.port}/callback/youtube`;
    const token = await exchangeYouTubeCode(code, redirectUri);
    if (token) {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<h1>YouTube Connected!</h1><p>You can close this tab.</p>");
    } else {
      res.writeHead(500, { "Content-Type": "text/html" });
      res.end("<h1>YouTube Auth Failed</h1><p>Check the server logs.</p>");
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
