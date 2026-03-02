import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult } from "../../types.js";
import { loadConfig } from "../../config.js";
import { execSync } from "node:child_process";

const schema = z.object({});

export const openDashboardAction: McpAction = {
  tool: {
    name: "distro_open_dashboard",
    description:
      "Open the music distribution dashboard in the default browser. Requires the HTTP server to be running.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async () => {
    const config = loadConfig();
    const url = `http://localhost:${config.port}/dashboard`;
    try {
      execSync(`open "${url}"`);
      return textResult({ message: `Dashboard opened at ${url}` });
    } catch {
      return textResult({
        message: `Start the dashboard server first: node build/server.js\nThen open: ${url}`,
      });
    }
  },
};
