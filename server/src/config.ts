import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { homedir } from "node:os";

export interface DistroConfig {
  outputDir: string;
  catalogPath: string;
  credsDir: string;
  port: number;
  dashboardDir: string;
}

function env(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

export function loadConfig(): DistroConfig {
  const outputDir = env(
    "MUSIC_OUTPUT_DIR",
    resolve(homedir(), "Desktop/AI-Music")
  );
  const credsDir = env(
    "CREDS_DIR",
    "/Volumes/Virtual Server/configs/credentials/music-distro"
  );
  const port = parseInt(env("MUSIC_DISTRO_PORT", "3847"));
  const dashboardDir = env(
    "DASHBOARD_DIR",
    resolve(import.meta.dirname || ".", "../../dashboard")
  );

  return {
    outputDir,
    catalogPath: resolve(outputDir, "catalog.json"),
    credsDir,
    port,
    dashboardDir,
  };
}

export function validateConfig(config: DistroConfig): void {
  if (!existsSync(config.outputDir)) {
    console.error(
      `[music-distro] Warning: Output dir not found at ${config.outputDir}`
    );
  }
  if (!existsSync(config.credsDir)) {
    console.error(
      `[music-distro] Warning: Credentials dir not found at ${config.credsDir}`
    );
  }
}
