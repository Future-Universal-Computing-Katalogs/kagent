# ui/src/app/api/auth/jira — Jira OAuth Flow

Next.js Route Handlers for Jira OAuth 2.0 (3LO).

| Route | Purpose |
|-------|---------|
| `initiate/` | Start OAuth flow (redirect to Atlassian) |
| `complete/` | OAuth callback — exchange code for tokens |
| `status/` | Connection status check |
| `refresh/` | Refresh access token |
| `disconnect/` | Revoke and clear stored tokens |
| `token/` | Issue short-lived token to UI clients |
| `route.ts` | Top-level handler (currently a redirect) |
