import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig } from "../config.js";

export interface TokenData {
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  token_type?: string;
}

export function loadToken(platform: string): TokenData | null {
  const config = loadConfig();
  const path = resolve(config.credsDir, `${platform}-token.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function saveToken(platform: string, token: TokenData): void {
  const config = loadConfig();
  const dir = config.credsDir;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = resolve(dir, `${platform}-token.json`);
  writeFileSync(path, JSON.stringify(token, null, 2), "utf-8");
  chmodSync(path, 0o600);
}

export function loadClientCreds(
  platform: string
): { client_id: string; client_secret: string; redirect_uri?: string } | null {
  const config = loadConfig();
  const path = resolve(config.credsDir, `${platform}-client.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

export function isAuthenticated(platform: string): boolean {
  const token = loadToken(platform);
  if (!token) return false;
  if (token.expires_at && Date.now() > token.expires_at) return false;
  return true;
}

export function getAuthStatus(): {
  soundcloud: { connected: boolean; expires_at?: number };
  youtube: { connected: boolean; expires_at?: number };
} {
  const sc = loadToken("soundcloud");
  const yt = loadToken("youtube");
  return {
    soundcloud: {
      connected: sc !== null && (!sc.expires_at || Date.now() < sc.expires_at),
      expires_at: sc?.expires_at,
    },
    youtube: {
      connected: yt !== null && (!yt.expires_at || Date.now() < yt.expires_at),
      expires_at: yt?.expires_at,
    },
  };
}
