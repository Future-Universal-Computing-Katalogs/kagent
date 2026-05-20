export interface JiraConfig {
  serverUrl: string;
  relayPort: string;
}

export function getJiraConfig(serverUrlOverride?: string): JiraConfig {
  const serverUrl = serverUrlOverride || process.env.JIRA_MCP_SERVER_URL || "https://mcp.jira.tools.sap/mcp";

  return {
    serverUrl,
    relayPort: process.env.JIRA_RELAY_PORT ?? "7541",
  };
}

export const JIRA_TOKEN_COOKIE = "kagent_jira_token";
export const JIRA_REFRESH_COOKIE = "kagent_jira_refresh";
export const JIRA_EXPIRES_COOKIE = "kagent_jira_expires";
export const JIRA_CONNECTED_COOKIE = "kagent_jira_connected";
export const JIRA_CLIENT_ID_COOKIE = "kagent_jira_client_id";
export const JIRA_SERVER_URL_COOKIE = "kagent_jira_server_url";

export const JIRA_HAS_REFRESH_COOKIE = "kagent_jira_has_refresh";
export const JIRA_STATE_COOKIE = "kagent_oauth_jira_state";
export const JIRA_VERIFIER_COOKIE = "kagent_oauth_jira_verifier";
export const JIRA_REFERER_COOKIE = "kagent_oauth_jira_referer";

// 30 days — cookies outlive any token so refresh can always run
export const JIRA_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
