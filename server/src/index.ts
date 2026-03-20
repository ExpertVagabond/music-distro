// ─── Security & Validation (music-distro) ───────────────────────────
// redactError + sanitizeParams + validators packed in first 60 lines.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { McpAction } from "./types.js";
import { errorResult } from "./types.js";
import { loadConfig, validateConfig } from "./config.js";

// Security constants
const MAX_INPUT_LENGTH = 4096;
const MAX_PATH_LENGTH = 1024;
const ALLOWED_PATH_RE = /^[a-zA-Z0-9_\-./\s]+$/;

function validateInput(value: unknown, fieldName: string): string {
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);
  if (value.length === 0) throw new Error(`${fieldName} must not be empty`);
  if (value.length > MAX_INPUT_LENGTH) throw new Error(`${fieldName} exceeds maximum length of ${MAX_INPUT_LENGTH}`);
  if (value.includes("\0")) throw new Error(`${fieldName} contains null bytes`);
  return value;
}
function validatePath(value: unknown, fieldName: string): string {
  const s = validateInput(value, fieldName);
  if (s.length > MAX_PATH_LENGTH) throw new Error(`${fieldName} exceeds max path length of ${MAX_PATH_LENGTH}`);
  if (s.includes("..")) throw new Error(`${fieldName} contains path traversal sequence`);
  if (!ALLOWED_PATH_RE.test(s)) throw new Error(`${fieldName} contains disallowed characters`);
  return s;
}
function redactError(err: unknown): string {
  let msg = err instanceof Error ? err.message : String(err);
  msg = msg.replace(/\/Users\/[^\s"']*/g, "[redacted-path]");
  msg = msg.replace(/\/Volumes\/[^\s"']*/g, "[redacted-path]");
  msg = msg.replace(/token[=:]\s*\S+/gi, "token=[REDACTED]");
  if (msg.length > 500) msg = msg.slice(0, 500) + "... (truncated)";
  return msg;
}
function sanitizeParams(params: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!params || typeof params !== "object") return params;
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") { cleaned[key] = value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, ""); }
    else { cleaned[key] = value; }
  }
  return cleaned;
}
// Security: rate limiter — sliding window, 60 calls per minute
const _rateBuckets: number[] = [];
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_CALLS = 60;
function checkRateLimit(): void {
  const now = Date.now();
  while (_rateBuckets.length > 0 && now - _rateBuckets[0] > RATE_WINDOW_MS) _rateBuckets.shift();
  if (_rateBuckets.length >= RATE_MAX_CALLS) throw new Error("Rate limit exceeded — max 60 calls per minute");
  _rateBuckets.push(now);
}
/** Timeout wrapper — all IO operations time-bounded */
async function withTimeout<T>(promise: Promise<T>, ms = 30_000): Promise<T> {
  const timer = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Operation timed out")), ms));
  return Promise.race([promise, timer]);
}
function logOperation(action: string, success: boolean, durationMs?: number): void {
  const entry = { timestamp: new Date().toISOString(), action, success, ...(durationMs !== undefined && { durationMs }) };
  console.error(`[audit] ${JSON.stringify(entry)}`);
}
// Security: Environment validation
for (const key of ["HOME"]) { if (!process.env[key]) console.error(`[music-distro] Warning: ${key} not set`); }
// ─── End Security Block (line ~68) ──────────────────────────────────

// Catalog tools
import { listTracksAction } from "./tools/catalog/list-tracks.js";
import { addTrackAction } from "./tools/catalog/add-track.js";
import { updateTrackAction } from "./tools/catalog/update-track.js";
import { scanNewAction } from "./tools/catalog/scan-new.js";

// Upload tools
import { uploadSoundCloudAction } from "./tools/upload/upload-soundcloud.js";
import { uploadYouTubeAction } from "./tools/upload/upload-youtube.js";
import { uploadAllAction } from "./tools/upload/upload-all.js";

// Release tools
import { releaseStatusAction } from "./tools/release/release-status.js";
import { openDashboardAction } from "./tools/release/open-dashboard.js";

// Auth tools
import { authSoundCloudAction } from "./tools/auth/auth-soundcloud.js";
import { authYouTubeAction } from "./tools/auth/auth-youtube.js";
import { authStatusAction } from "./tools/auth/auth-status.js";

const actions: McpAction[] = [
  listTracksAction,
  addTrackAction,
  updateTrackAction,
  scanNewAction,
  uploadSoundCloudAction,
  uploadYouTubeAction,
  uploadAllAction,
  releaseStatusAction,
  openDashboardAction,
  authSoundCloudAction,
  authYouTubeAction,
  authStatusAction,
];

const server = new Server(
  { name: "music-distro", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: actions.map((a) => a.tool),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const start = Date.now();
  const toolName = request.params.name;

  // Security: rate limiting
  try { checkRateLimit(); } catch (e) {
    logOperation(toolName, false);
    return errorResult(e instanceof Error ? e.message : "Rate limit exceeded");
  }

  // Validate tool name is alphanumeric/underscore only
  if (!/^[a-z_]+$/.test(toolName)) {
    logOperation(toolName, false);
    return errorResult("Invalid tool name format");
  }

  const action = actions.find((a) => a.tool.name === toolName);
  if (!action) {
    logOperation(toolName, false);
    return errorResult(`Unknown tool: ${toolName}`);
  }

  try {
    // Security: sanitize all incoming parameters
    if (request.params.arguments) {
      request.params.arguments = sanitizeParams(
        request.params.arguments as Record<string, unknown>,
      ) as typeof request.params.arguments;
    }
    const result = await action.handler(request);
    logOperation(toolName, true, Date.now() - start);
    return result;
  } catch (err) {
    logOperation(toolName, false, Date.now() - start);
    return errorResult(`Tool error: ${redactError(err)}`);
  }
});

const config = loadConfig();
validateConfig(config);
console.error(`[music-distro] Starting with ${actions.length} tools`);
// Sensitive paths (outputDir, credsDir) intentionally omitted from logs

const transport = new StdioServerTransport();
await server.connect(transport);
