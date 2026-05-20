"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, Check, Copy, Loader2, ExternalLink, Link2, XCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function isJiraTokenExpired(): boolean {
  const expiresRaw = getCookie("kagent_jira_expires");
  if (!expiresRaw) return false;
  const expiresAt = parseInt(expiresRaw, 10);
  return !isNaN(expiresAt) && Date.now() > expiresAt;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function GitHubIcon({ connected }: { connected?: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className={connected ? "text-foreground" : "text-muted-foreground"}>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
  );
}

function JiraIcon({ connected }: { connected?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" className={connected ? "text-foreground" : "text-muted-foreground"}>
      <path d="M11.571 11.513H0a5.218 5.218 0 0 0 5.232 5.215h2.13v2.057A5.215 5.215 0 0 0 12.575 24V12.518a1.005 1.005 0 0 0-1.004-1.005zm5.723-5.756H5.757a5.215 5.215 0 0 0 5.215 5.214h2.129v2.058a5.218 5.218 0 0 0 5.215 5.214V6.762a1.005 1.005 0 0 0-1.022-1.005zM23.013 0H11.455a5.215 5.215 0 0 0 5.215 5.215h2.129v2.057A5.215 5.215 0 0 0 24.017 12.49V1.005A1.005 1.005 0 0 0 23.013 0z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubInstance {
  id: string;
  label: string;
  connected: boolean;
  disabled?: boolean;
  loginUrl?: string;
}

interface ConnectionsDropdownProps {
  onGithubTokenExpired?: (labels: string[]) => void;
  onJiraTokenExpired?: () => void;
  onOpen?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ConnectionsDropdown({
  onGithubTokenExpired,
  onJiraTokenExpired,
  onOpen,
}: ConnectionsDropdownProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // GitHub state
  const [githubInstances, setGithubInstances] = useState<GitHubInstance[]>([]);
  const [githubDisconnecting, setGithubDisconnecting] = useState<GitHubInstance | null>(null);
  const [githubPreLogin, setGithubPreLogin] = useState<GitHubInstance | null>(null);

  // Jira state
  const [jiraConnected, setJiraConnected] = useState(false);
  const [jiraServerUrl, setJiraServerUrl] = useState<string | null>(null);
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false);
  const [jiraAuthorizing, setJiraAuthorizing] = useState(false);
  const [jiraAuthorizationUrl, setJiraAuthorizationUrl] = useState<string | null>(null);
  const [jiraInitiateError, setJiraInitiateError] = useState<string | null>(null);
  const [jiraRelayPort, setJiraRelayPort] = useState(7541);
  const [jiraCopied, setJiraCopied] = useState(false);
  const [jiraRefreshing, setJiraRefreshing] = useState(false);
  const [jiraBrokerStatus, setJiraBrokerStatus] = useState<"idle" | "checking" | "healthy" | "unhealthy">("idle");


  // Close menu on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [menuOpen]);

  // Init: fetch both statuses
  useEffect(() => {
    fetch("/actions/api/auth/github/status")
      .then((r) => r.json())
      .then((data) => {
        if (!data.instances) return;
        const fetched: GitHubInstance[] = (data.instances as GitHubInstance[])
          .filter((i) => !i.disabled)
          .map((i) => ({
            ...i,
            connected: i.connected || getCookie(`kagent_github_connected_${i.id}`) === "true",
          }));
        setGithubInstances(fetched);

        const connected = fetched.filter((i) => i.connected);
        if (connected.length === 0) return;

        fetch("/actions/api/auth/github/validate")
          .then((r) => r.json())
          .then((v: { instances: { id: string; valid: boolean }[] }) => {
            const invalidIds = new Set(v.instances.filter((r) => !r.valid).map((r) => r.id));
            if (invalidIds.size === 0) return;
            setGithubInstances((prev) =>
              prev.map((i) => (invalidIds.has(i.id) ? { ...i, connected: false } : i))
            );
            const expiredLabels = fetched.filter((i) => invalidIds.has(i.id)).map((i) => i.label);
            onGithubTokenExpired?.(expiredLabels);
          })
          .catch(() => {});
      })
      .catch(() => setGithubInstances([]));

    fetch("/actions/api/auth/jira/status")
      .then((r) => r.json())
      .then((data: { connected: boolean; serverUrl: string | null }) => {
        setJiraConnected(data.connected && !isJiraTokenExpired());
        setJiraServerUrl(data.serverUrl);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Proactive token refresh: check every minute, refresh if within 5 min of expiry
  useEffect(() => {
    const check = () => {
      const expiresRaw = getCookie("kagent_jira_expires");
      if (!expiresRaw) return;
      const expiresAt = parseInt(expiresRaw, 10);
      if (isNaN(expiresAt)) return;
      if (Date.now() > expiresAt) {
        // Token expired — update connected state and clear stale cookie server-side
        fetch("/actions/api/auth/jira/status")
          .then((r) => r.json())
          .then((data: { connected: boolean }) => setJiraConnected(data.connected))
          .catch(() => {});
        setJiraConnected(false);
        onJiraTokenExpired?.();
      } else if (expiresAt - Date.now() < 5 * 60 * 1000) {
        // Within 5 min of expiry — attempt proactive refresh
        fetch("/actions/api/auth/jira/refresh", { method: "POST" })
          .then((r) => { if (!r.ok) throw new Error(`refresh failed: ${r.status}`); })
          .catch(() => { setJiraConnected(false); onJiraTokenExpired?.(); });
      }
    };
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Refresh Jira connection status when tab becomes visible (user returns from OAuth popup)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetch("/actions/api/auth/jira/status")
          .then((r) => r.json())
          .then((data: { connected: boolean; serverUrl: string | null }) => {
            setJiraConnected(data.connected && !isJiraTokenExpired());
            setJiraServerUrl(data.serverUrl);
          })
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  // Jira auth completion: postMessage listener (instant)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "jira-auth-complete") {
        setJiraConnected(true);
        setJiraAuthorizing(false);
        setJiraDialogOpen(false);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!jiraAuthorizing) return;
    const id = setInterval(() => {
      fetch("/actions/api/auth/jira/status")
        .then((r) => r.json())
        .then((data: { connected: boolean; serverUrl: string | null }) => {
          if (data.connected) {
            setJiraConnected(true);
            setJiraAuthorizing(false);
            setJiraDialogOpen(false);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [jiraAuthorizing]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const openMenu = () => {
    setMenuOpen(true);
    // Re-fetch Jira status on open to reflect current cookie state
    fetch("/actions/api/auth/jira/status")
      .then((r) => r.json())
      .then((data: { connected: boolean; serverUrl: string | null }) => {
        setJiraConnected(data.connected && !isJiraTokenExpired());
        setJiraServerUrl(data.serverUrl);
      })
      .catch(() => {});
    onOpen?.();
  };
  const closeMenu = () => setMenuOpen(false);

  const handleGithubConnect = (inst: GitHubInstance) => {
    closeMenu();
    if (inst.loginUrl) {
      setGithubPreLogin(inst);
    } else {
      window.location.assign(`/actions/api/auth/github?instance=${encodeURIComponent(inst.id)}`);
    }
  };

  const handleGithubDisconnectClick = (inst: GitHubInstance) => {
    closeMenu();
    setGithubDisconnecting(inst);
  };

  const handleGithubProceedConnect = (inst: GitHubInstance) => {
    setGithubPreLogin(null);
    window.location.assign(`/actions/api/auth/github?instance=${encodeURIComponent(inst.id)}`);
  };

  const handleGithubDisconnectConfirm = (inst: GitHubInstance) => {
    fetch(`/actions/api/auth/github/disconnect?instance=${encodeURIComponent(inst.id)}`, { method: "POST" })
      .then(() => setGithubInstances((prev) => prev.map((i) => i.id === inst.id ? { ...i, connected: false } : i)))
      .catch(() => setGithubInstances((prev) => prev.map((i) => i.id === inst.id ? { ...i, connected: false } : i)))
      .finally(() => setGithubDisconnecting(null));
  };

  const handleJiraConnectClick = async () => {
    closeMenu();

    const expiresRaw = getCookie("kagent_jira_expires");
    const hasRefreshIndicator = getCookie("kagent_jira_has_refresh") === "1";
    // Also try refresh if expires cookie exists but has_refresh indicator is missing
    // (user connected before has_refresh cookie was introduced)
    const hasRefresh = hasRefreshIndicator || !!expiresRaw;
    const isExpired = expiresRaw ? Date.now() > parseInt(expiresRaw, 10) : true;

    if (isExpired && hasRefresh) {
      // Try silent refresh before showing the full connect dialog
      setJiraRefreshing(true);
      setJiraDialogOpen(true);
      try {
        const res = await fetch("/actions/api/auth/jira/refresh", { method: "POST" });
        if (res.ok) {
          setJiraConnected(true);
          setJiraDialogOpen(false);
          setJiraRefreshing(false);
          return;
        }
      } catch {
        // fall through to show connect form
      }
      setJiraRefreshing(false);
      // refresh failed — stay in dialog and show connect form
    } else {
      setJiraAuthorizing(false);
      setJiraDialogOpen(true);
    }
  };

  const handleJiraDisconnectClick = () => {
    closeMenu();
    fetch("/actions/api/auth/jira/disconnect", { method: "POST" }).catch(() => {});
    setJiraConnected(false);
  };

  const handleJiraAuthorize = async () => {
    setJiraAuthorizing(true);
    setJiraInitiateError(null);
    try {
      const initRes = await fetch(`/actions/api/auth/jira/initiate`);
      if (!initRes.ok) {
        const err = (await initRes.json()) as { error?: string };
        console.error("Jira initiate failed:", err.error);
        setJiraInitiateError(`${err.error ?? "Jira initiate request failed."}\nPlease check network/VPN connection.`);
        setJiraAuthorizing(false);
        return;
      }
      const initData = (await initRes.json()) as {
        authorizationUrl: string;
        clientId: string;
        tokenEndpoint: string;
        codeVerifier: string;
        state: string;
        relayPort: string;
      };
      const port = parseInt(initData.relayPort, 10) || 8080;
      setJiraRelayPort(port);

      const startUrl =
        `http://localhost:${port}/start` +
        `?verifier=${encodeURIComponent(initData.codeVerifier)}` +
        `&client_id=${encodeURIComponent(initData.clientId)}` +
        `&token_endpoint=${encodeURIComponent(initData.tokenEndpoint)}` +
        `&complete_url=${encodeURIComponent(window.location.origin + "/actions/api/auth/jira/complete")}`;

      await fetch(startUrl);

      // form.submit() with target="_blank" is never blocked by popup blockers.
      // Params must be added as hidden inputs — GET form submission drops the action query string.
      const authUrl = new URL(initData.authorizationUrl);
      const form = document.createElement("form");
      form.method = "GET";
      form.action = authUrl.origin + authUrl.pathname;
      form.target = "_blank";
      authUrl.searchParams.forEach((value, key) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      setJiraAuthorizationUrl(initData.authorizationUrl);
    } catch (e) {
      setJiraAuthorizing(false);
      setJiraInitiateError(e instanceof Error ? `${e.message}\nPlease check network/VPN connection.` : "Jira initiate request failed.\nPlease check network/VPN connection.");
    }
  };

  const handleJiraCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setJiraCopied(true);
      setTimeout(() => setJiraCopied(false), 2000);
    }).catch(() => {});
  };

  const handleJiraBrokerHealthCheck = async () => {
    setJiraBrokerStatus("checking");
    try {
      const res = await fetch(`http://localhost:${jiraRelayPort}/health`);
      setJiraBrokerStatus(res.ok ? "healthy" : "unhealthy");
    } catch {
      setJiraBrokerStatus("unhealthy");
    }
  };

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  const githubConnectedCount = githubInstances.filter((i) => i.connected).length;
  const totalConnected = githubConnectedCount + (jiraConnected ? 1 : 0);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Trigger + plain div popover — avoids all Radix portal pointer-event issues */}
      <div ref={menuRef} className="relative">
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => menuOpen ? closeMenu() : openMenu()}
        >
          <Link2 className="h-3.5 w-3.5" />
          Connections
          {totalConnected > 0 && (
            <span className="text-green-600 ml-0.5">({totalConnected})</span>
          )}
          <ChevronDown className="h-3 w-3" />
        </Button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-md border bg-popover shadow-md p-1 text-popover-foreground">
            {/* GitHub entries */}
            {githubInstances.length === 0 ? (
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent cursor-pointer text-left text-muted-foreground"
                onClick={() => handleGithubConnect({ id: "default", label: "github.tools.sap", connected: false })}
              >
                <GitHubIcon connected={false} />
                <span className="flex-1">github.tools.sap</span>
                <span className="text-xs opacity-50">Connect</span>
              </button>
            ) : (
              githubInstances.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  className={`w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-left hover:bg-accent ${inst.connected ? "hover:text-red-600" : ""}`}
                  onClick={() => inst.connected ? handleGithubDisconnectClick(inst) : handleGithubConnect(inst)}
                  title={inst.connected ? "Click to disconnect" : "Click to connect"}
                >
                  <GitHubIcon connected={inst.connected} />
                  <span className={`flex-1 ${inst.connected ? "text-foreground" : "text-muted-foreground"}`}>
                    {inst.label}
                  </span>
                  {inst.connected
                    ? <span className="text-xs text-green-600 font-medium">Connected</span>
                    : <span className="text-xs opacity-50">Connect</span>
                  }
                </button>
              ))
            )}

            {/* Separator */}
            <div className="-mx-1 my-1 h-px bg-muted" />

            {/* Jira entry */}
            {jiraConnected ? (
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-left hover:bg-accent hover:text-red-600"
                onClick={handleJiraDisconnectClick}
                title="Click to disconnect"
              >
                <JiraIcon connected={true} />
                <span className="flex-1">
                  {jiraServerUrl ? new URL(jiraServerUrl).hostname : "Jira MCP"}
                </span>
                <span className="text-xs text-green-600 font-medium">Connected</span>
              </button>
            ) : (
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer text-left hover:bg-accent text-muted-foreground"
                onClick={handleJiraConnectClick}
              >
                <JiraIcon connected={false} />
                <span className="flex-1">
                  {jiraServerUrl ? new URL(jiraServerUrl).hostname : "Jira MCP"}
                </span>
                <span className="text-xs opacity-50">Connect</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* GitHub disconnect confirmation */}
      <AlertDialog open={!!githubDisconnecting} onOpenChange={(open) => { if (!open) setGithubDisconnecting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke access to <strong>{githubDisconnecting?.label}</strong>. You will need to re-authorize to connect again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => githubDisconnecting && handleGithubDisconnectConfirm(githubDisconnecting)}
              className="bg-red-600 hover:bg-red-700"
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* GitHub pre-login dialog */}
      <AlertDialog open={!!githubPreLogin} onOpenChange={(open) => { if (!open) setGithubPreLogin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign in to {githubPreLogin?.label}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  To avoid being redirected away, please sign in to{" "}
                  <strong>{githubPreLogin?.label}</strong> first, then come back and click{" "}
                  <strong>Continue</strong>.
                </p>
                {githubPreLogin?.loginUrl && (
                  <a
                    href={githubPreLogin.loginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 underline"
                  >
                    Open {githubPreLogin.label}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => githubPreLogin && handleGithubProceedConnect(githubPreLogin)}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Jira connect dialog */}
      <Dialog open={jiraDialogOpen} onOpenChange={(open) => { if (!open) { setJiraDialogOpen(false); setJiraAuthorizing(false); setJiraAuthorizationUrl(null); setJiraRefreshing(false); setJiraInitiateError(null); setJiraBrokerStatus("idle"); } }}>
        <DialogContent className="sm:max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>Connect Jira MCP</DialogTitle>
          </DialogHeader>
          {jiraRefreshing ? (
            <div className="flex items-center justify-center gap-3 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              <span>Refreshing connection...</span>
            </div>
          ) : (
          <div className="space-y-5 py-2">
            {/* Step 1 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Step 1: Clone the repo below</p>
              <div className="relative">
                <pre className="bg-muted rounded-md px-4 py-3 text-xs font-mono whitespace-pre-wrap break-all pr-10">git clone https://github.tools.sap/cloud-infra-cn/sap-jira-mcp-oauth-broker.git</pre>
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute top-1.5 right-1.5 h-7 w-7 p-0"
                  onClick={() => handleJiraCopy("git clone https://github.tools.sap/cloud-infra-cn/sap-jira-mcp-oauth-broker.git")}
                  aria-label="Copy git clone command"
                >
                  {jiraCopied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Step 2: Start the localhost broker</p>
              <p className="text-xs text-muted-foreground">Go to the cloned repo, check <code className="font-mono">README.md</code>, then run:</p>
              <pre className="bg-muted rounded-md px-4 py-3 text-xs font-mono whitespace-pre-wrap">{`cd sap-jira-mcp-oauth-broker\nnpm install\nnpm run build\nnpm run start`}</pre>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Step 3: Check broker health</p>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleJiraBrokerHealthCheck}
                  disabled={jiraBrokerStatus === "checking"}
                  className="gap-1.5 shrink-0"
                >
                  {jiraBrokerStatus === "checking" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Broker health
                </Button>
                {jiraBrokerStatus === "healthy" && (
                  <span className="flex items-center gap-1.5 text-sm text-green-600">
                    <Check className="h-4 w-4 shrink-0" />
                    Healthy
                  </span>
                )}
                {jiraBrokerStatus === "unhealthy" && (
                  <span className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Unreachable
                  </span>
                )}
              </div>
            </div>

            {/* Step 4: Authorize */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Step 4: Authorize with Jira</p>
              {!jiraAuthorizationUrl ? (
                <div className="space-y-2">
                  <Button onClick={handleJiraAuthorize} disabled={jiraBrokerStatus !== "healthy" || jiraAuthorizing} className="w-full gap-2">
                    {jiraAuthorizing ? "Preparing authorization..." : "Authorize with Jira"}
                  </Button>
                  {jiraInitiateError && (
                    <p className="flex items-start gap-1.5 text-sm text-red-600 dark:text-red-400 whitespace-pre-line">
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      {jiraInitiateError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    onClick={() => jiraAuthorizationUrl && window.open(jiraAuthorizationUrl, "_blank")}
                    className="w-full gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Jira Authorization
                  </Button>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    <span>Complete the login in the opened tab — this dialog will close automatically once done.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
