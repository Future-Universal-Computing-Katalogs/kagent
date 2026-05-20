import { NextRequest, NextResponse } from "next/server";
import { JIRA_TOKEN_COOKIE } from "@/lib/jira";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(JIRA_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: "Not connected" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
