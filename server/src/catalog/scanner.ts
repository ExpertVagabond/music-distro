import {
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join, extname, basename } from "node:path";
import { execSync } from "node:child_process";
import { loadConfig } from "../config.js";
import { loadCatalog, addTrack, saveCatalog } from "./catalog.js";
import type { TrackFiles, TrackStems } from "../types.js";

const AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".m4a", ".flac", ".aac", ".ogg"]);

interface AudioInfo {
  duration: number | null;
  sample_rate: number | null;
}

function getAudioInfo(filePath: string): AudioInfo {
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration -show_entries stream=sample_rate -of json "${filePath}"`,
      { timeout: 10000 }
    ).toString();
    const data = JSON.parse(out);
    return {
      duration: data.format?.duration ? parseFloat(data.format.duration) : null,
      sample_rate: data.streams?.[0]?.sample_rate
        ? parseInt(data.streams[0].sample_rate)
        : null,
    };
  } catch {
    return { duration: null, sample_rate: null };
  }
}

function findMatchingFiles(
  dir: string,
  baseName: string
): TrackFiles {
  const files: TrackFiles = {};
  const candidates = readdirSync(dir).filter((f) =>
    f.startsWith(baseName.replace(extname(baseName), ""))
  );
  for (const f of candidates) {
    const ext = extname(f).toLowerCase();
    const path = join(dir, f);
    if (ext === ".wav") files.wav = f;
    if (ext === ".mp3") files.mp3 = f;
    if (ext === ".m4a") files.m4a = f;
    if (f.includes("master") && ext === ".wav") files.master = f;
    if (f.includes("master") && ext === ".mp3") files.mp3 = f;
    if (f.includes("master") && ext === ".m4a") files.m4a = f;
  }
  return files;
}

function findStems(stemsDir: string, trackName: string): TrackStems | null {
  const htdemucsDir = join(stemsDir, "htdemucs");
  if (!existsSync(htdemucsDir)) return null;

  const cleanName = trackName.replace(extname(trackName), "");
  const stemDir = join(htdemucsDir, cleanName);
  if (!existsSync(stemDir)) return null;

  const stemFiles = readdirSync(stemDir).filter((f) =>
    AUDIO_EXTENSIONS.has(extname(f).toLowerCase())
  );
  if (stemFiles.length === 0) return null;

  return {
    model: "htdemucs",
    dir: `stems/htdemucs/${cleanName}`,
    tracks: stemFiles,
  };
}

export function scanForNewTracks(): {
  added: string[];
  skipped: string[];
  total: number;
} {
  const config = loadConfig();
  const catalog = loadCatalog();

  const knownFiles = new Set<string>();
  for (const t of catalog.tracks) {
    if (t.files.master) knownFiles.add(t.files.master);
    if (t.files.mp3) knownFiles.add(t.files.mp3);
    if (t.files.m4a) knownFiles.add(t.files.m4a);
    if (t.files.wav) knownFiles.add(t.files.wav);
  }

  const added: string[] = [];
  const skipped: string[] = [];

  if (!existsSync(config.outputDir)) {
    return { added, skipped, total: catalog.tracks.length };
  }

  const files = readdirSync(config.outputDir).filter((f) => {
    const ext = extname(f).toLowerCase();
    return AUDIO_EXTENSIONS.has(ext) && statSync(join(config.outputDir, f)).isFile();
  });

  // Group by base name (without -master suffix and extension)
  const groups = new Map<string, string[]>();
  for (const f of files) {
    const base = f
      .replace(/-master\.(wav|mp3|m4a)$/i, "")
      .replace(/\.(wav|mp3|m4a|flac)$/i, "");
    if (!groups.has(base)) groups.set(base, []);
    groups.get(base)!.push(f);
  }

  for (const [base, groupFiles] of groups) {
    // Skip if any file in group is already known
    if (groupFiles.some((f) => knownFiles.has(f))) {
      skipped.push(base);
      continue;
    }

    // Pick the best file for metadata
    const masterFile =
      groupFiles.find((f) => f.includes("master")) || groupFiles[0];
    const fullPath = join(config.outputDir, masterFile);
    const info = getAudioInfo(fullPath);

    const trackFiles = findMatchingFiles(config.outputDir, masterFile);
    if (Object.keys(trackFiles).length === 0) {
      trackFiles.wav = masterFile;
    }

    // Generate title from filename
    const title = base
      .replace(/^musicgen-/, "")
      .replace(/-\d+s$/, "")
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const stems = findStems(
      join(config.outputDir, "stems"),
      masterFile
    );

    const track = addTrack({
      title,
      files: trackFiles,
      duration_seconds: info.duration || undefined,
      sample_rate: info.sample_rate || undefined,
    });

    if (stems) {
      const catalogData = loadCatalog();
      const idx = catalogData.tracks.findIndex((t) => t.id === track.id);
      if (idx !== -1) {
        catalogData.tracks[idx].stems = stems;
        saveCatalog(catalogData);
      }
    }

    added.push(track.title);
  }

  return { added, skipped, total: catalog.tracks.length + added.length };
}
