import { createReadStream } from "node:fs";
import { basename } from "node:path";
import { loadToken } from "../auth/oauth.js";

const SC_API = "https://api.soundcloud.com";

export interface SoundCloudUploadResult {
  id: number;
  permalink_url: string;
  title: string;
}

export async function uploadToSoundCloud(opts: {
  filePath: string;
  title: string;
  description?: string;
  genre?: string;
  tags?: string[];
  sharing?: "public" | "private";
  artworkPath?: string;
}): Promise<SoundCloudUploadResult> {
  const token = loadToken("soundcloud");
  if (!token) throw new Error("Not authenticated with SoundCloud. Run distro_auth_soundcloud first.");

  const formData = new FormData();

  // Read file as blob
  const { readFile } = await import("node:fs/promises");
  const audioBuffer = await readFile(opts.filePath);
  const audioBlob = new Blob([audioBuffer]);
  formData.append("track[asset_data]", audioBlob, basename(opts.filePath));

  formData.append("track[title]", opts.title);
  if (opts.description) formData.append("track[description]", opts.description);
  if (opts.genre) formData.append("track[genre]", opts.genre);
  if (opts.tags?.length) {
    formData.append("track[tag_list]", opts.tags.map(t => t.includes(" ") ? `"${t}"` : t).join(" "));
  }
  formData.append("track[sharing]", opts.sharing || "public");
  formData.append("track[downloadable]", "true");

  if (opts.artworkPath) {
    const artBuffer = await readFile(opts.artworkPath);
    const artBlob = new Blob([artBuffer]);
    formData.append("track[artwork_data]", artBlob, basename(opts.artworkPath));
  }

  const resp = await fetch(`${SC_API}/tracks`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${token.access_token}`,
    },
    body: formData,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SoundCloud upload failed (${resp.status}): ${text}`);
  }

  const data = await resp.json();
  return {
    id: data.id,
    permalink_url: data.permalink_url,
    title: data.title,
  };
}
