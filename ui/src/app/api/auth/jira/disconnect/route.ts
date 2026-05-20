import { NextResponse } from "next/server";
import {
  JIRA_TOKEN_COOKIE,
  JIRA_REFRESH_COOKIE,
  JIRA_EXPIRES_COOKIE,
  JIRA_CONNECTED_COOKIE,
  JIRA_HAS_REFRESH_COOKIE,
} from "@/lib/jira";

export async function POST() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(JIRA_TOKEN_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(JIRA_REFRESH_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(JIRA_EXPIRES_COOKIE, "", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(JIRA_CONNECTED_COOKIE, "", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(JIRA_HAS_REFRESH_COOKIE, "", { httpOnly: false, sameSite: "lax", path: "/", maxAge: 0 });

  return response;
}
