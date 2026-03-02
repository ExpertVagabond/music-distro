import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult } from "../../types.js";
import { getAuthStatus } from "../../auth/oauth.js";

const schema = z.object({});

export const authStatusAction: McpAction = {
  tool: {
    name: "distro_auth_status",
    description: "Check which platforms are connected and authenticated.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async () => {
    const status = getAuthStatus();
    return textResult({
      soundcloud: status.soundcloud.connected ? "Connected" : "Not connected",
      youtube: status.youtube.connected ? "Connected" : "Not connected",
    });
  },
};
