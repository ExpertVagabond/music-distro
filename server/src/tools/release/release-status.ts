import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { McpAction, ToolInputSchema } from "../../types.js";
import { textResult } from "../../types.js";
import { listTracks } from "../../catalog/catalog.js";
import { getAuthStatus } from "../../auth/oauth.js";

const schema = z.object({});

export const releaseStatusAction: McpAction = {
  tool: {
    name: "distro_release_status",
    description:
      "Get a summary of all tracks and their release status across platforms, plus auth status.",
    inputSchema: zodToJsonSchema(schema) as ToolInputSchema,
  },
  handler: async () => {
    const tracks = listTracks();
    const auth = getAuthStatus();

    const summary = tracks.map((t) => ({
      title: t.title,
      artist: t.artist,
      soundcloud: t.releases.soundcloud.status,
      soundcloud_url: t.releases.soundcloud.url,
      youtube: t.releases.youtube.status,
      youtube_url: t.releases.youtube.url,
    }));

    const counts = {
      total: tracks.length,
      soundcloud_uploaded: tracks.filter(
        (t) => t.releases.soundcloud.status === "uploaded"
      ).length,
      youtube_uploaded: tracks.filter(
        (t) => t.releases.youtube.status === "uploaded"
      ).length,
      pending: tracks.filter((t) =>
        Object.values(t.releases).every((r) => r.status === "pending")
      ).length,
    };

    return textResult({ auth, counts, tracks: summary });
  },
};
