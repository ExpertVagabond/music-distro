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
  return action.handler(request);
});

const config = loadConfig();
validateConfig(config);
console.error(`[music-distro] Starting with ${actions.length} tools`);
console.error(`[music-distro] Output: ${config.outputDir}`);
console.error(`[music-distro] Credentials: ${config.credsDir}`);

const transport = new StdioServerTransport();
await server.connect(transport);
