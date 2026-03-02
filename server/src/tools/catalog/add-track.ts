import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import { addTrack } from "../../catalog/catalog.js";
import { readMetadata, resolveFilePath } from "../../catalog/metadata.js";
import { existsSync } from "node:fs";
import { basename } from "node:path";

const schema = z.object({
  file: z.string().describe("Audio file path or filename in AI-Music directory"),
  title: z.string().optional().describe("Track title (auto-detected from filename if not provided)"),
  artist: z.string().optional().describe("Artist name (default: Matthew Karsten)"),
  genre: z.string().optional().describe("Genre"),
  description: z.string().optional().describe("Track description"),
  tags: z.array(z.string()).optional().describe("Tags for the track"),
});

export const addTrackAction: McpAction = {
  tool: {
    name: "distro_add_track",
    description: "Add an audio file to the catalog with metadata.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const args = schema.parse(request.params.arguments);
    const filePath = resolveFilePath(args.file);

    if (!existsSync(filePath)) {
      return errorResult(`File not found: ${args.file}`);
    }

    const meta = await readMetadata(filePath);
    const ext = filePath.split(".").pop()?.toLowerCase() || "wav";
    const filename = basename(filePath);

    const title =
      args.title ||
      meta.title ||
      filename
        .replace(/\.[^.]+$/, "")
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());

    const track = addTrack({
      title,
      artist: args.artist || meta.artist,
      genre: args.genre || meta.genre,
      description: args.description,
      tags: args.tags,
      files: { [ext]: filename },
      duration_seconds: meta.duration_seconds || undefined,
      sample_rate: meta.sample_rate || undefined,
    });

    return textResult({
      message: `Track added to catalog`,
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration_seconds,
      },
    });
  },
};
