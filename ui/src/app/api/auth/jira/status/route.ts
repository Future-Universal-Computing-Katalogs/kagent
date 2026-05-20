import { NextRequest, NextResponse } from "next/server";
import { getJiraConfig, JIRA_TOKEN_COOKIE, JIRA_EXPIRES_COOKIE, JIRA_CONNECTED_COOKIE, JIRA_SERVER_URL_COOKIE } from "@/lib/jira";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(JIRA_TOKEN_COOKIE)?.value;
  const expiresRaw = req.cookies.get(JIRA_EXPIRES_COOKIE)?.value;
  const isExpired = expiresRaw ? Date.now() > parseInt(expiresRaw, 10) : false;
  const connected = !!token && !isExpired;

  const serverUrlFromCookie = req.cookies.get(JIRA_SERVER_URL_COOKIE)?.value;
  const serverUrl = serverUrlFromCookie ? Buffer.from(serverUrlFromCookie, "base64").toString() : undefined;
  const config = getJiraConfig(serverUrl);

  const response = NextResponse.json({ connected, serverUrl: config?.serverUrl ?? null });

  if (!connected) {
    response.cookies.set(JIRA_CONNECTED_COOKIE, "", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 0 });
  }

  return response;
}
