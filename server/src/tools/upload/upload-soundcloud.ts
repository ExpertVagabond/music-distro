import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import { getTrack, updateTrack } from "../../catalog/catalog.js";
import { resolveFilePath } from "../../catalog/metadata.js";
import { uploadToSoundCloud } from "../../upload/soundcloud.js";
import { existsSync } from "node:fs";

const schema = z.object({
  track_id: z.string().describe("Track ID from catalog"),
  sharing: z
    .enum(["public", "private"])
    .optional()
    .describe("Visibility (default: public)"),
});

export const uploadSoundCloudAction: McpAction = {
  tool: {
    name: "distro_upload_soundcloud",
    description: "Upload a track from the catalog to SoundCloud.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const args = schema.parse(request.params.arguments);
    const track = getTrack(args.track_id);
    if (!track) return errorResult(`Track not found: ${args.track_id}`);

    // Find best file to upload (prefer mp3, then m4a, then wav)
    const fileKey = track.files.mp3 || track.files.m4a || track.files.master || track.files.wav;
    if (!fileKey) return errorResult("No audio file found for this track");

    const filePath = resolveFilePath(fileKey);
    if (!existsSync(filePath)) return errorResult(`File not found: ${fileKey}`);

    try {
      const result = await uploadToSoundCloud({
        filePath,
        title: track.title,
        description: track.description,
        genre: track.genre,
        tags: track.tags,
        sharing: args.sharing,
        artworkPath: track.artwork ? resolveFilePath(track.artwork) : undefined,
      });

      updateTrack(args.track_id, {
        releases: {
          ...track.releases,
          soundcloud: {
            status: "uploaded",
            url: result.permalink_url,
            id: String(result.id),
            uploaded_at: new Date().toISOString(),
          },
        },
      });

      return textResult({
        message: `Uploaded to SoundCloud`,
        url: result.permalink_url,
        id: result.id,
      });
    } catch (err: any) {
      updateTrack(args.track_id, {
        releases: {
          ...track.releases,
          soundcloud: {
            status: "failed",
            url: null,
            id: null,
            uploaded_at: null,
            error: err.message,
          },
        },
      });
      return errorResult(err.message);
    }
  },
};
