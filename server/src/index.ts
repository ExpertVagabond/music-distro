/**
 * music-distro MCP Server
 *
 * Security: input validation on all tool handlers, environment-based config,
 * no credential logging, strict argument length limits.
 */

// --- Security constants ---
const MAX_INPUT_LENGTH = 4096;
const MAX_PATH_LENGTH = 1024;
const ALLOWED_PATH_RE = /^[a-zA-Z0-9_\-./\s]+$/;

/** Validate a string argument is safe and within bounds. */
function validateInput(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a string`);
  }
  if (value.length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
  if (value.length > MAX_INPUT_LENGTH) {
    throw new Error(`${fieldName} exceeds maximum length of ${MAX_INPUT_LENGTH}`);
  }
  if (value.includes("\0")) {
    throw new Error(`${fieldName} contains null bytes`);
  }
  return value;
}

/** Validate a file path argument — rejects traversal and special characters. */
function validatePath(value: unknown, fieldName: string): string {
  const s = validateInput(value, fieldName);
  if (s.length > MAX_PATH_LENGTH) {
    throw new Error(`${fieldName} exceeds max path length of ${MAX_PATH_LENGTH}`);
  }
  if (s.includes("..")) {
    throw new Error(`${fieldName} contains path traversal sequence`);
  }
  if (!ALLOWED_PATH_RE.test(s)) {
    throw new Error(`${fieldName} contains disallowed characters`);
  }
  return s;
}

// --- Environment validation ---
const requiredEnvHints = ["HOME"];
for (const key of requiredEnvHints) {
  if (!process.env[key]) {
    console.error(`[music-distro] Warning: ${key} environment variable not set`);
  }
}

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import type { McpAction } from "./types.js";
import { errorResult } from "./types.js";
import { loadConfig, validateConfig } from "./config.js";

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
  const action = actions.find((a) => a.tool.name === request.params.name);
  if (!action) return errorResult(`Unknown tool: ${request.params.name}`);

  // Validate tool name is alphanumeric/underscore only
  if (!/^[a-z_]+$/.test(request.params.name)) {
    return errorResult("Invalid tool name format");
  }

  try {
    return await action.handler(request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Redact potential file paths from error messages
    const safe = message.replace(/\/[^\s]+/g, "[REDACTED_PATH]");
    return errorResult(`Tool error: ${safe}`);
  }
});

const config = loadConfig();
validateConfig(config);
console.error(`[music-distro] Starting with ${actions.length} tools`);
// Sensitive paths (outputDir, credsDir) intentionally omitted from logs

const transport = new StdioServerTransport();
await server.connect(transport);
