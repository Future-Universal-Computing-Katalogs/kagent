import { NextRequest, NextResponse } from "next/server";
import {
  getJiraConfig,
  JIRA_TOKEN_COOKIE,
  JIRA_REFRESH_COOKIE,
  JIRA_EXPIRES_COOKIE,
  JIRA_CLIENT_ID_COOKIE,
  JIRA_SERVER_URL_COOKIE,
  JIRA_HAS_REFRESH_COOKIE,
  JIRA_COOKIE_MAX_AGE,
} from "@/lib/jira";

export async function POST(req: NextRequest) {
  // Prefer env var, fall back to cookie set during /complete (base64-encoded)
  const serverUrlFromCookie = req.cookies.get(JIRA_SERVER_URL_COOKIE)?.value;
  const serverUrl = serverUrlFromCookie ? Buffer.from(serverUrlFromCookie, "base64").toString() : undefined;
  const config = getJiraConfig(serverUrl);

  const refreshToken = req.cookies.get(JIRA_REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const clientId = req.cookies.get(JIRA_CLIENT_ID_COOKIE)?.value;
  if (!clientId) {
    return NextResponse.json({ error: "No client_id" }, { status: 400 });
  }

  const metaRes = await fetch(`${config.serverUrl}/.well-known/oauth-authorization-server`);
  if (!metaRes.ok) {
    return NextResponse.json({ error: "Failed to fetch OAuth metadata" }, { status: 502 });
  }
  const meta = (await metaRes.json()) as { token_endpoint: string };
  const { token_endpoint: tokenEndpoint } = meta;

  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return NextResponse.json({ error: `Token refresh failed: ${text}` }, { status: 502 });
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
  const { access_token, refresh_token, expires_in } = tokenData;

  if (!access_token) {
    return NextResponse.json({ error: "No access_token in refresh response" }, { status: 502 });
  }

  const expiresAt = expires_in !== undefined ? String(Date.now() + expires_in * 1000) : "0";

  const response = NextResponse.json({ ok: true });

  response.cookies.set(JIRA_TOKEN_COOKIE, access_token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
  });
  if (refresh_token) {
    response.cookies.set(JIRA_REFRESH_COOKIE, refresh_token, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
    });
    response.cookies.set(JIRA_HAS_REFRESH_COOKIE, "1", {
      httpOnly: false, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
    });
  }
  response.cookies.set(JIRA_EXPIRES_COOKIE, expiresAt, {
    httpOnly: false, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
  });

  return response;
}
