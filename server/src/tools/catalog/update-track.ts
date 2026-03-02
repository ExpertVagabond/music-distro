import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import { updateTrack } from "../../catalog/catalog.js";
import { writeId3Tags, resolveFilePath } from "../../catalog/metadata.js";

const schema = z.object({
  id: z.string().describe("Track ID (UUID)"),
  title: z.string().optional(),
  artist: z.string().optional(),
  genre: z.string().optional(),
  album: z.string().optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isrc: z.string().optional(),
  bpm: z.number().optional(),
  key: z.string().optional(),
});

export const updateTrackAction: McpAction = {
  tool: {
    name: "distro_update_track",
    description: "Update metadata for an existing track in the catalog. Also writes ID3 tags to MP3 files.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const args = schema.parse(request.params.arguments);
    const { id, ...updates } = args;

    const track = updateTrack(id, updates);
    if (!track) {
      return errorResult(`Track not found: ${id}`);
    }

    // Sync ID3 tags to MP3 if it exists
    if (track.files.mp3) {
      const mp3Path = resolveFilePath(track.files.mp3);
      await writeId3Tags(mp3Path, {
        title: track.title,
        artist: track.artist,
        album: track.album,
        genre: track.genre,
      });
    }

    return textResult({
      message: "Track updated",
      track: {
        id: track.id,
        title: track.title,
        artist: track.artist,
        genre: track.genre,
      },
    });
  },
};
