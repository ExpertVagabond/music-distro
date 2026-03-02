import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, extname } from "node:path";
import { loadConfig } from "../config.js";

export interface AudioMetadata {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  year?: string;
  duration_seconds: number | null;
  sample_rate: number | null;
  channels: number | null;
  bitrate_kbps: number | null;
  format: string;
}

export async function readMetadata(filePath: string): Promise<AudioMetadata> {
  const ext = extname(filePath).toLowerCase();

  // Use ffprobe for all formats
  try {
    const out = execSync(
      `ffprobe -v error -show_entries format=duration,bit_rate -show_entries format_tags=title,artist,album,genre,date -show_entries stream=sample_rate,channels -of json "${filePath}"`,
      { timeout: 10000 }
    ).toString();
    const data = JSON.parse(out);
    const tags = data.format?.tags || {};
    const stream = data.streams?.[0] || {};

    return {
      title: tags.title || tags.TITLE,
      artist: tags.artist || tags.ARTIST,
      album: tags.album || tags.ALBUM,
      genre: tags.genre || tags.GENRE,
      year: tags.date || tags.DATE,
      duration_seconds: data.format?.duration
        ? parseFloat(data.format.duration)
        : null,
      sample_rate: stream.sample_rate ? parseInt(stream.sample_rate) : null,
      channels: stream.channels || null,
      bitrate_kbps: data.format?.bit_rate
        ? Math.round(parseInt(data.format.bit_rate) / 1000)
        : null,
      format: ext.replace(".", ""),
    };
  } catch {
    return {
      duration_seconds: null,
      sample_rate: null,
      channels: null,
      bitrate_kbps: null,
      format: ext.replace(".", ""),
    };
  }
}

export async function writeId3Tags(
  filePath: string,
  tags: {
    title?: string;
    artist?: string;
    album?: string;
    genre?: string;
    year?: string;
  }
): Promise<boolean> {
  const ext = extname(filePath).toLowerCase();
  if (ext !== ".mp3") return false;

  try {
    const NodeID3 = await import("node-id3");
    const id3Tags: Record<string, string> = {};
    if (tags.title) id3Tags.title = tags.title;
    if (tags.artist) id3Tags.artist = tags.artist;
    if (tags.album) id3Tags.album = tags.album;
    if (tags.genre) id3Tags.genre = tags.genre;
    if (tags.year) id3Tags.year = tags.year;

    const result = NodeID3.default.update(id3Tags, filePath);
    return result === true;
  } catch {
    return false;
  }
}

export function resolveFilePath(filename: string): string {
  const config = loadConfig();
  const full = resolve(config.outputDir, filename);
  if (existsSync(full)) return full;
  if (existsSync(filename)) return filename;
  return full;
}
