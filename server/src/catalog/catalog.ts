import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { CatalogData, TrackMeta, TrackFiles } from "../types.js";
import { loadConfig } from "../config.js";

const DEFAULT_CATALOG: CatalogData = {
  tracks: [],
  settings: {
    default_artist: "Matthew Karsten",
    default_genre: "Electronic",
    isrc_prefix: "",
  },
};

function defaultRelease() {
  return {
    status: "pending" as const,
    url: null,
    id: null,
    uploaded_at: null,
  };
}

export function loadCatalog(): CatalogData {
  const config = loadConfig();
  if (!existsSync(config.catalogPath)) {
    return { ...DEFAULT_CATALOG, tracks: [] };
  }
  const raw = readFileSync(config.catalogPath, "utf-8");
  return JSON.parse(raw) as CatalogData;
}

export function saveCatalog(catalog: CatalogData): void {
  const config = loadConfig();
  const dir = dirname(config.catalogPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(config.catalogPath, JSON.stringify(catalog, null, 2), "utf-8");
}

export function addTrack(opts: {
  title: string;
  artist?: string;
  genre?: string;
  description?: string;
  tags?: string[];
  files: TrackFiles;
  duration_seconds?: number;
  sample_rate?: number;
}): TrackMeta {
  const catalog = loadCatalog();
  const now = new Date().toISOString();

  const track: TrackMeta = {
    id: randomUUID(),
    title: opts.title,
    artist: opts.artist || catalog.settings.default_artist,
    album: "",
    genre: opts.genre || catalog.settings.default_genre,
    isrc: "",
    bpm: null,
    key: "",
    description: opts.description || "",
    tags: opts.tags || [],
    artwork: null,
    duration_seconds: opts.duration_seconds || null,
    sample_rate: opts.sample_rate || null,
    files: opts.files,
    stems: null,
    releases: {
      soundcloud: defaultRelease(),
      youtube: defaultRelease(),
    },
    created_at: now,
    updated_at: now,
  };

  catalog.tracks.push(track);
  saveCatalog(catalog);
  return track;
}

export function updateTrack(
  id: string,
  updates: Partial<Omit<TrackMeta, "id" | "created_at">>
): TrackMeta | null {
  const catalog = loadCatalog();
  const idx = catalog.tracks.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  catalog.tracks[idx] = {
    ...catalog.tracks[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  saveCatalog(catalog);
  return catalog.tracks[idx];
}

export function getTrack(id: string): TrackMeta | null {
  const catalog = loadCatalog();
  return catalog.tracks.find((t) => t.id === id) || null;
}

export function listTracks(): TrackMeta[] {
  return loadCatalog().tracks;
}

export function deleteTrack(id: string): boolean {
  const catalog = loadCatalog();
  const before = catalog.tracks.length;
  catalog.tracks = catalog.tracks.filter((t) => t.id !== id);
  if (catalog.tracks.length < before) {
    saveCatalog(catalog);
    return true;
  }
  return false;
}
