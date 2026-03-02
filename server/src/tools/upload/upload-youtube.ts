import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import { getTrack, updateTrack } from "../../catalog/catalog.js";
import { resolveFilePath } from "../../catalog/metadata.js";
import { uploadToYouTube } from "../../upload/youtube.js";
import { existsSync } from "node:fs";

const schema = z.object({
  track_id: z.string().describe("Track ID from catalog"),
  privacy: z
    .enum(["public", "private", "unlisted"])
    .optional()
    .describe("Privacy status (default: unlisted)"),
});

export const uploadYouTubeAction: McpAction = {
  tool: {
    name: "distro_upload_youtube",
    description:
      "Generate a waveform video from a track and upload it to YouTube.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const args = schema.parse(request.params.arguments);
    const track = getTrack(args.track_id);
    if (!track) return errorResult(`Track not found: ${args.track_id}`);

    const fileKey =
      track.files.master || track.files.wav || track.files.mp3 || track.files.m4a;
    if (!fileKey) return errorResult("No audio file found for this track");

    const filePath = resolveFilePath(fileKey);
    if (!existsSync(filePath)) return errorResult(`File not found: ${fileKey}`);

    try {
      const result = await uploadToYouTube({
        audioPath: filePath,
        title: track.title,
        description: track.description,
        tags: track.tags,
        privacyStatus: args.privacy,
        artworkPath: track.artwork ? resolveFilePath(track.artwork) : undefined,
      });

      updateTrack(args.track_id, {
        releases: {
          ...track.releases,
          youtube: {
            status: "uploaded",
            url: result.url,
            id: result.id,
            uploaded_at: new Date().toISOString(),
          },
        },
      });

      return textResult({
        message: `Uploaded to YouTube`,
        url: result.url,
        id: result.id,
      });
    } catch (err: any) {
      updateTrack(args.track_id, {
        releases: {
          ...track.releases,
          youtube: {
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
