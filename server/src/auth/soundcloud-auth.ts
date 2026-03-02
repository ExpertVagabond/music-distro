import { loadClientCreds, saveToken, type TokenData } from "./oauth.js";

const SC_AUTH_URL = "https://api.soundcloud.com/connect";
const SC_TOKEN_URL = "https://api.soundcloud.com/oauth2/token";

export function getSoundCloudAuthUrl(redirectUri: string): string | null {
  const creds = loadClientCreds("soundcloud");
  if (!creds) return null;

  const params = new URLSearchParams({
    client_id: creds.client_id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "non-expiring",
  });

  return `${SC_AUTH_URL}?${params.toString()}`;
}

export async function exchangeSoundCloudCode(
  code: string,
  redirectUri: string
): Promise<TokenData | null> {
  const creds = loadClientCreds("soundcloud");
  if (!creds) return null;

  const resp = await fetch(SC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: creds.client_id,
      client_secret: creds.client_secret,
      redirect_uri: redirectUri,
      code,
    }),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  const token: TokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in
      ? Date.now() + data.expires_in * 1000
      : undefined,
    token_type: data.token_type,
  };

  saveToken("soundcloud", token);
  return token;
}
