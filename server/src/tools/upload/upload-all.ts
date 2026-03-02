import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult, errorResult } from "../../types.js";
import { getTrack } from "../../catalog/catalog.js";
import { isAuthenticated } from "../../auth/oauth.js";
import { uploadSoundCloudAction } from "./upload-soundcloud.js";
import { uploadYouTubeAction } from "./upload-youtube.js";

const schema = z.object({
  track_id: z.string().describe("Track ID from catalog"),
});

export const uploadAllAction: McpAction = {
  tool: {
    name: "distro_upload_all",
    description:
      "Upload a track to all connected platforms (SoundCloud, YouTube).",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async (request) => {
    const args = schema.parse(request.params.arguments);
    const track = getTrack(args.track_id);
    if (!track) return errorResult(`Track not found: ${args.track_id}`);

    const results: Record<string, string> = {};

    if (isAuthenticated("soundcloud")) {
      try {
        const r = await uploadSoundCloudAction.handler(request);
        const text = r.content[0] && "text" in r.content[0] ? r.content[0].text : "";
        results.soundcloud = r.isError ? `Failed: ${text}` : "Uploaded";
      } catch (e: any) {
        results.soundcloud = `Error: ${e.message}`;
      }
    } else {
      results.soundcloud = "Skipped (not authenticated)";
    }

    if (isAuthenticated("youtube")) {
      try {
        const r = await uploadYouTubeAction.handler(request);
        const text = r.content[0] && "text" in r.content[0] ? r.content[0].text : "";
        results.youtube = r.isError ? `Failed: ${text}` : "Uploaded";
      } catch (e: any) {
        results.youtube = `Error: ${e.message}`;
      }
    } else {
      results.youtube = "Skipped (not authenticated)";
    }

    return textResult({
      track: track.title,
      results,
    });
  },
};
