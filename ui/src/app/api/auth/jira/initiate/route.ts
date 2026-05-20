import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import {
  getJiraConfig,
  JIRA_CLIENT_ID_COOKIE,
  JIRA_STATE_COOKIE,
  JIRA_VERIFIER_COOKIE,
  JIRA_REFERER_COOKIE,
} from "@/lib/jira";

export async function GET(req: NextRequest) {
  const serverUrlParam = req.nextUrl.searchParams.get("server_url") ?? undefined;
  const config = getJiraConfig(serverUrlParam);

  let metaRes: Response;
  try {
    metaRes = await fetch(`${config.serverUrl}/.well-known/oauth-authorization-server`);
  } catch (e) {
    return NextResponse.json({ error: `Failed reaching Jira MCP server: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
  if (!metaRes.ok) {
    const text = await metaRes.text();
    return NextResponse.json({ error: `Jira MCP OAuth metadata request failed (${metaRes.status}): ${text}` }, { status: 502 });
  }
  const meta = (await metaRes.json()) as {
    authorization_endpoint: string;
    token_endpoint: string;
    registration_endpoint: string;
  };
  const { authorization_endpoint: authorizationEndpoint, token_endpoint: tokenEndpoint, registration_endpoint: registrationEndpoint } = meta;

  const cookieStore = await cookies();
  let clientId = cookieStore.get(JIRA_CLIENT_ID_COOKIE)?.value ?? null;
  let freshlyRegistered = false;

  if (!clientId) {
    let regRes: Response;
    try {
      regRes = await fetch(registrationEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: [`http://localhost:${config.relayPort}/callback`],
          client_name: "kagent",
        }),
      });
    } catch (e) {
      return NextResponse.json({ error: `Failed reaching Jira MCP server: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
    }
    if (!regRes.ok) {
      const text = await regRes.text();
      return NextResponse.json({ error: `Dynamic client registration failed: ${text}` }, { status: 502 });
    }
    const regData = (await regRes.json()) as { client_id: string };
    clientId = regData.client_id;
    freshlyRegistered = true;
  }

  const codeVerifier = randomBytes(43).toString("base64url").slice(0, 43);
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(24).toString("hex");

  const redirectUri = `http://localhost:${config.relayPort}/callback`;
  const authorizationUrl =
    `${authorizationEndpoint}?response_type=code` +
    `&client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&state=${state}`;

  const referer = req.headers.get("referer") ?? "/";

  const response = NextResponse.json({
    authorizationUrl,
    clientId,
    tokenEndpoint,
    codeVerifier,
    state,
    relayPort: config.relayPort,
  });

  response.cookies.set(JIRA_STATE_COOKIE, state, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  response.cookies.set(JIRA_VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
  });
  response.cookies.set(JIRA_REFERER_COOKIE, referer, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 600,
  });

  if (freshlyRegistered) {
    response.cookies.set(JIRA_CLIENT_ID_COOKIE, clientId, {
      httpOnly: false, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}
