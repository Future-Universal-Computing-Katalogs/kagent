import { NextRequest, NextResponse } from "next/server";
import {
  getJiraConfig,
  JIRA_TOKEN_COOKIE,
  JIRA_REFRESH_COOKIE,
  JIRA_EXPIRES_COOKIE,
  JIRA_CONNECTED_COOKIE,
  JIRA_SERVER_URL_COOKIE,
  JIRA_HAS_REFRESH_COOKIE,
  JIRA_STATE_COOKIE,
  JIRA_VERIFIER_COOKIE,
  JIRA_REFERER_COOKIE,
  JIRA_COOKIE_MAX_AGE,
} from "@/lib/jira";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const accessToken = searchParams.get("access_token");
  const refreshToken = searchParams.get("refresh_token");
  const expiresIn = searchParams.get("expires_in");
  const state = searchParams.get("state");

  const savedState = req.cookies.get(JIRA_STATE_COOKIE)?.value;
  if (!state || !savedState || state !== savedState) {
    return new NextResponse(errorPage("Invalid OAuth state — please try connecting again."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!accessToken) {
    return new NextResponse(errorPage("Missing access token in callback — please try connecting again."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const expiresAt = expiresIn ? String(Date.now() + parseInt(expiresIn, 10) * 1000) : "0";

  const response = new NextResponse(successPage(), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });

  response.cookies.set(JIRA_TOKEN_COOKIE, accessToken, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
  });
  if (refreshToken) {
    response.cookies.set(JIRA_REFRESH_COOKIE, refreshToken, {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
    });
    response.cookies.set(JIRA_HAS_REFRESH_COOKIE, "1", {
      httpOnly: false, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
    });
  }
  response.cookies.set(JIRA_EXPIRES_COOKIE, expiresAt, {
    httpOnly: false, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
  });
  response.cookies.set(JIRA_CONNECTED_COOKIE, "true", {
    httpOnly: false, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
  });

  // Store server URL base64-encoded to avoid cookie serialization encoding issues
  const config = getJiraConfig();
  if (config) {
    response.cookies.set(JIRA_SERVER_URL_COOKIE, Buffer.from(config.serverUrl).toString("base64"), {
      httpOnly: false, sameSite: "lax", path: "/", maxAge: JIRA_COOKIE_MAX_AGE,
    });
  }

  response.cookies.delete(JIRA_STATE_COOKIE);
  response.cookies.delete(JIRA_VERIFIER_COOKIE);
  response.cookies.delete(JIRA_REFERER_COOKIE);

  return response;
}

function successPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Jira Connected</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 2.5rem 3rem; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; max-width: 400px; }
    .icon { margin-bottom: 1rem; }
    .icon svg { width: 3rem; height: 3rem; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; color: #111; }
    p { color: #6b7280; margin: 0; font-size: 0.95rem; }
  </style>
  <script>
    // Notify the opener (kagent UI) that auth completed successfully
    if (window.opener) {
      window.opener.postMessage({ type: "jira-auth-complete" }, window.location.origin);
    }
  </script>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="12" fill="#22c55e"/>
        <path d="M7 12.5l3.5 3.5 6.5-7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <h1>Authorization complete</h1>
    <p>You can close this tab and return to the platform.</p>
  </div>
</body>
</html>`;
}

function errorPage(message: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Authorization Failed</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; }
    .card { background: white; border-radius: 12px; padding: 2.5rem 3rem; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; max-width: 400px; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; color: #111; }
    p { color: #ef4444; margin: 0; font-size: 0.95rem; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">❌</div>
    <h1>Authorization failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
