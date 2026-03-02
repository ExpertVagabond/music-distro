import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { loadConfig } from "../config.js";

export function generateWaveformVideo(opts: {
  audioPath: string;
  artworkPath?: string;
  outputPath?: string;
}): string {
  const config = loadConfig();
  const outDir = resolve(config.outputDir, "videos");
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const base = basename(opts.audioPath, extname(opts.audioPath));
  const output = opts.outputPath || resolve(outDir, `${base}.mp4`);

  if (opts.artworkPath && existsSync(opts.artworkPath)) {
    // Static image + audio
    execSync(
      `ffmpeg -y -loop 1 -i "${opts.artworkPath}" -i "${opts.audioPath}" ` +
        `-c:v libx264 -tune stillimage -c:a aac -b:a 192k ` +
        `-pix_fmt yuv420p -shortest "${output}"`,
      { timeout: 300000 }
    );
  } else {
    // Generate waveform visualization
    execSync(
      `ffmpeg -y -i "${opts.audioPath}" -filter_complex ` +
        `"[0:a]showwaves=s=1920x1080:mode=cline:colors=0x00ffaa@0.8:rate=25,` +
        `format=yuv420p[v]" -map "[v]" -map 0:a ` +
        `-c:v libx264 -c:a aac -b:a 192k "${output}"`,
      { timeout: 300000 }
    );
  }

  return output;
}
