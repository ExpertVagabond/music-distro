import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import {
  getYouTubeAuthUrl,
  hasYouTubeClientSecret,
  getYouTubeClientSecretPath,
} from "../../auth/youtube-auth.js";
import { loadConfig } from "../../config.js";
import { execSync } from "node:child_process";

const schema = z.object({});

export const authYouTubeAction: McpAction = {
  tool: {
    name: "distro_auth_youtube",
    description:
      "Initiate YouTube OAuth flow. Opens browser for Google authorization. Requires client_secret.json from Google Cloud Console.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async () => {
    if (!hasYouTubeClientSecret()) {
      return errorResult(
        `YouTube client secret not found. Download from Google Cloud Console and save to: ${getYouTubeClientSecretPath()}`
      );
    }

    const config = loadConfig();
    const redirectUri = `http://localhost:${config.port}/callback/youtube`;
    const url = await getYouTubeAuthUrl(redirectUri);
    if (!url) return errorResult("Failed to generate auth URL");

    try {
      execSync(`open "${url}"`);
      return textResult({
        message:
          "Browser opened for YouTube/Google authorization. Complete the flow in your browser. Make sure the HTTP server is running.",
        redirect_uri: redirectUri,
      });
    } catch {
      return textResult({
        message: "Open this URL in your browser to authorize:",
        url,
        redirect_uri: redirectUri,
      });
    }
  },
};
