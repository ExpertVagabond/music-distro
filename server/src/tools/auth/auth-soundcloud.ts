import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import { getSoundCloudAuthUrl } from "../../auth/soundcloud-auth.js";
import { loadConfig } from "../../config.js";
import { loadClientCreds } from "../../auth/oauth.js";
import { execSync } from "node:child_process";

const schema = z.object({});

export const authSoundCloudAction: McpAction = {
  tool: {
    name: "distro_auth_soundcloud",
    description:
      "Initiate SoundCloud OAuth flow. Opens browser for authorization. Requires SoundCloud client credentials in the credentials vault.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async () => {
    const creds = loadClientCreds("soundcloud");
    if (!creds) {
      return errorResult(
        `SoundCloud client credentials not found. Create $CREDS_DIR/soundcloud-client.json with { "client_id": "...", "client_secret": "..." }`
      );
    }

    const config = loadConfig();
    const redirectUri = `http://localhost:${config.port}/callback/soundcloud`;
    const url = getSoundCloudAuthUrl(redirectUri);
    if (!url) return errorResult("Failed to generate auth URL");

    try {
      execSync(`open "${url}"`);
      return textResult({
        message:
          "Browser opened for SoundCloud authorization. Complete the flow in your browser. Make sure the HTTP server is running (node build/server.js) to receive the callback.",
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
