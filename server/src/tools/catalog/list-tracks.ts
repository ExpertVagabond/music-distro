import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult } from "../../types.js";
import { listTracks } from "../../catalog/catalog.js";

const schema = z.object({
  genre: z.string().optional().describe("Filter by genre"),
  status: z
    .enum(["pending", "uploaded", "all"])
    .optional()
    .describe("Filter by release status (default: all)"),
});

export const listTracksAction: McpAction = {
  tool: {
    name: "distro_list_tracks",
    description:
      "List all tracks in the catalog with metadata and release status across platforms.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const args = schema.parse(request.params.arguments);
    let tracks = listTracks();

    if (args.genre) {
      tracks = tracks.filter(
        (t) => t.genre.toLowerCase() === args.genre!.toLowerCase()
      );
    }

    if (args.status && args.status !== "all") {
      tracks = tracks.filter((t) =>
        Object.values(t.releases).some((r) => r.status === args.status)
      );
    }

    const summary = tracks.map((t) => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      genre: t.genre,
      duration: t.duration_seconds
        ? `${Math.floor(t.duration_seconds / 60)}:${String(Math.floor(t.duration_seconds % 60)).padStart(2, "0")}`
        : "?",
      files: Object.keys(t.files).filter(
        (k) => t.files[k as keyof typeof t.files]
      ),
      soundcloud: t.releases.soundcloud.status,
      youtube: t.releases.youtube.status,
    }));

    return textResult({
      total: summary.length,
      tracks: summary,
    });
  },
};
