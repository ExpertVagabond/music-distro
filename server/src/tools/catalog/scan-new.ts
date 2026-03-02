import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult } from "../../types.js";
import { scanForNewTracks } from "../../catalog/scanner.js";

const schema = z.object({});

export const scanNewAction: McpAction = {
  tool: {
    name: "distro_scan_new",
    description:
      "Scan ~/Desktop/AI-Music/ for new audio files not yet in the catalog. Auto-populates metadata from filenames and ffprobe.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async () => {
    const result = scanForNewTracks();
    return textResult({
      message:
        result.added.length > 0
          ? `Added ${result.added.length} new tracks to catalog`
          : "No new tracks found",
      added: result.added,
      skipped: result.skipped.length,
      total_tracks: result.total,
    });
  },
};
