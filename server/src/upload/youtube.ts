import { createReadStream } from "node:fs";
import { getAuthenticatedYouTube } from "../auth/youtube-auth.js";
import { generateWaveformVideo } from "./video-gen.js";

export interface YouTubeUploadResult {
  id: string;
  url: string;
  title: string;
}

export async function uploadToYouTube(opts: {
  audioPath: string;
  title: string;
  description?: string;
  tags?: string[];
  privacyStatus?: "public" | "private" | "unlisted";
  artworkPath?: string;
}): Promise<YouTubeUploadResult> {
  const youtube = await getAuthenticatedYouTube();
  if (!youtube) {
    throw new Error(
      "Not authenticated with YouTube. Run distro_auth_youtube first."
    );
  }

  // Generate video from audio
  const videoPath = generateWaveformVideo({
    audioPath: opts.audioPath,
    artworkPath: opts.artworkPath,
  });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title: opts.title,
        description: opts.description || "",
        tags: opts.tags || [],
        categoryId: "10", // Music
      },
      status: {
        privacyStatus: opts.privacyStatus || "unlisted",
      },
    },
    media: {
      body: createReadStream(videoPath),
    },
  });

  const videoId = res.data.id!;
  return {
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: opts.title,
  };
}
