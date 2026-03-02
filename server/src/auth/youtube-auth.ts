import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../config.js";
import { saveToken, loadToken, type TokenData } from "./oauth.js";

export function getYouTubeClientSecretPath(): string {
  const config = loadConfig();
  return resolve(config.credsDir, "youtube-client-secret.json");
}

export function hasYouTubeClientSecret(): boolean {
  return existsSync(getYouTubeClientSecretPath());
}

export async function getYouTubeAuthUrl(
  redirectUri: string
): Promise<string | null> {
  if (!hasYouTubeClientSecret()) return null;

  const { google } = await import("googleapis");
  const secretPath = getYouTubeClientSecretPath();
  const creds = JSON.parse(readFileSync(secretPath, "utf-8"));
  const installed = creds.installed || creds.web;
  if (!installed) return null;

  const oauth2 = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    redirectUri
  );

  return oauth2.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });
}

export async function exchangeYouTubeCode(
  code: string,
  redirectUri: string
): Promise<TokenData | null> {
  if (!hasYouTubeClientSecret()) return null;

  const { google } = await import("googleapis");
  const secretPath = getYouTubeClientSecretPath();
  const creds = JSON.parse(readFileSync(secretPath, "utf-8"));
  const installed = creds.installed || creds.web;

  const oauth2 = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret,
    redirectUri
  );

  const { tokens } = await oauth2.getToken(code);
  if (!tokens.access_token) return null;

  const token: TokenData = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || undefined,
    expires_at: tokens.expiry_date || undefined,
    token_type: tokens.token_type || "Bearer",
  };

  saveToken("youtube", token);
  return token;
}

export async function getAuthenticatedYouTube() {
  const token = loadToken("youtube");
  if (!token) return null;
  if (!hasYouTubeClientSecret()) return null;

  const { google } = await import("googleapis");
  const secretPath = getYouTubeClientSecretPath();
  const creds = JSON.parse(readFileSync(secretPath, "utf-8"));
  const installed = creds.installed || creds.web;

  const oauth2 = new google.auth.OAuth2(
    installed.client_id,
    installed.client_secret
  );
  oauth2.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token,
  });

  return google.youtube({ version: "v3", auth: oauth2 });
}
