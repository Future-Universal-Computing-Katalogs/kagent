# SAP Fork Changelog

This file documents changes our fork (`Future-Universal-Computing-Katalogs/kagent`)
adds on top of upstream `kagent-dev/kagent`. The upstream changelog is in
`CHANGELOG.md` and is not modified by us.

## Architecture

- `main` = upstream mirror (no fork-only changes)
- `develop` = `main` + the changes documented below
- All fork work lands on `develop`; periodic upstream syncs rebase `develop` onto a
  refreshed `main`

---

## Features

### Inline Skills (commits: 76315377, 65f80a77, fec4da6f)
Bundle reusable skill definitions directly into an Agent so the runtime can load
prompts and execute shell-based skills inside the agent pod.

- `go/api/v1alpha2/agent_types.go`: new `InlineSkillSpec` with OCI and Git
  source types, plus CLI tool container support
- `go/core/internal/controller/translator/agent/manifest_builder.go`:
  inline skill translation that renders a unified `skills-init` container,
  with golden tests for OCI, Git, and mixed-source agents
- `python/packages/kagent-skills/src/kagent/skills/{prompts.py,shell.py}`:
  skill execution + prompt loading at runtime
- CRD schema regenerated (`kagent.dev_agents.yaml`)

### ScheduledRun CRD (commits: fcfeec76, 0461ae91, cb481661)
A new top-level CRD that schedules recurring agent invocations on a cron
expression, with full UI for management.

- `go/api/v1alpha2/scheduledrun_types.go` + `kagent.dev_scheduledruns.yaml`:
  CRD types and validation
- `go/core/internal/controller/scheduledrun_controller.go` and
  `scheduledrun_scheduler.go`: reconciler + cron scheduler that fires A2A
  SendMessage calls
- `go/core/internal/httpserver/handlers/scheduledruns.go`: REST endpoints
- `ui/src/app/schedules/**` and `ui/src/components/schedules/**`: list/detail/new
  pages, run-history table, scheduled-run list component

### PlatformCredential & SandboxAgent CRDs (commit: cd360b04)
Two new CRDs that anchor the platform credential broker and sandbox-agent
runtime variant.

- `go/api/v1alpha2/platformcredential_types.go`: 135-line CRD with credential
  source types and access policy
- `kagent.dev_platformcredentials.yaml` and `kagent.dev_sandboxagents.yaml`
  (both `go/api/config/crd/bases/` and `helm/kagent-crds/templates/`)

### Multi-user Ownership & GitHub OAuth (commits: c758ac64, 7ebba3f4)
Move kagent from single-tenant to per-user ownership, with GitHub OAuth as the
identity provider in the UI.

- Controller side: `auth/proxy_authn.go` (proxy auth header trust),
  migrations `000004_agent_private_mode`, `000006_toolserver_user_id` for
  ownership filtering on agents and tool servers
- UI side: `ui/src/app/actions/api/auth/github/{callback,disconnect,status,validate}/route.ts`,
  `GitHubConnectButton.tsx`, `Identicon.tsx`, `TokenExpiryBanner.tsx`,
  enhanced `AuthContext`, `userStore`, `oidcUser`

### Agent Comments & Feedback (commits: 95a91178, 90381946)
Comment threads attached to agents, plus a normalized feedback table.

- DB migration `000007_agent_comments` + `000008_feedback_single_pk`
- `httpserver/handlers/comments.go` REST API
- `ui/src/app/actions/comments.ts` and `AgentComments.tsx` component

### Analytics Dashboard & Leaderboard (commits: 0839d8fe, b8eec329)
Usage analytics view that ranks agents and surfaces popular MCP tools.

- `database/queries/stats.sql` + generated `stats.sql.go`
- `httpserver/handlers/stats.go`
- `ui/src/app/dashboard/page.tsx` plus
  `dashboard/{AgentLeaderboard,HotMCPs,StatCard}.tsx`

### SOTA Adapter — Claude Code & Codex Runtimes (commits: bd30aecc, 0d4b36b5)
A new agent runtime that wraps state-of-the-art coding CLIs (Anthropic Claude
Code and OpenAI Codex) as A2A-compatible agents.

- `python/packages/kagent-sota-adapter/`: full Python package with executor,
  discovery, A2A wrapper, and per-CLI event parsers
  (`parsers/_claude_code.py`, `parsers/_codex.py`); tests for parsers,
  discovery, executor, entrypoint
- `go/adk/pkg/cli/executor.go` + `models/passthrough.go`: native Go CLI
  executor that spawns `claude` / `codex` subprocesses
- `go/api/v1alpha2/agent_types.go`: `ClaudeCodeConfig`, `CodexConfig` runtime
  types
- Sample agents under `python/samples/sota/{claude_code_agent,codex_agent}`

### Cross-Reference Protection (refcheck) (commit: c288174b)
Prevents deletion of CRDs that other resources reference.

- `httpserver/handlers/refcheck.go` (+ unit + e2e tests in
  `core/test/e2e/refprotection_test.go`)

### MCP OAuth Tools & Memory Cache (commit: 8034e73c)
Runtime support for tools that need OAuth tokens, plus an in-memory caching
layer for the memory service.

- `kagent-adk/src/kagent/adk/tools/mcp_oauth_tools.py`
- `tools/set_mcp_token_tool.py` (+ unit tests)
- `_memory_service.py` cache implementation

### A2A Executor, Remote Tool, ADK Config (commit: 430886e4)
Polish to the A2A and remote-tool surfaces.

- Go: `go/adk/pkg/tools/remote_a2a_tool.go`, `go/api/adk/types.go`
- Python: `kagent-adk/src/kagent/adk/{_a2a.py,_agent_executor.py,_remote_a2a_tool.py,types.py}`
  with new `tools/__init__.py` exports and remote-A2A unit tests

### Session Pinning, Prompt Templates, Controller API (commit: 3b1440d6)
- DB migration `000005_session_pinned`; queries updated for agents/sessions/tools
- `httpserver/handlers/{prompttemplates.go,sessions.go,toolservers.go}`
  expanded; new `agents_test.go`
- Controller: `agent_controller.go`, `reconciler.go` updates; agent translator
  `template.go` + tests; new e2e `smoketest_test.go`

### SAP AI Core Proxy + Credential Broker (commit: 8f3d2047)
The largest fork-only feature: a SAP-AI-Core-aware HTTP proxy and a multi-platform
credential broker covering GitHub, Jira, K8s, Outlook, Slack.

- `go/cmd/aicore-proxy/main.go` + `go/core/internal/aicoreproxy/{anthropic.go,deployment.go,proxy.go,token.go}`
- `go/core/internal/broker/`: `broker.go`, `errors.go`, and per-platform
  adapters (`github_adapter.go`, `jira_adapter.go`, `k8s_adapter.go`,
  `outlook_adapter.go`, `slack_adapter.go`)
- `controller/platformcredential_controller.go` reconciler
- `core/cli/internal/cli/platform/{connect.go,oauth.go}`: CLI subcommands
- `python/packages/kagent-adk/src/kagent/adk/models/_sap_ai_core.py`:
  Python-side AI Core client refactor

### UI: Agent Management & MCP Servers (commit: 5422e0a2)
A broad UI revamp.

- New pages: `app/servers/page.tsx`, `app/tools/page.tsx`,
  `api/config/route.ts`, `api/toolservers/route.ts`
- New components: `AddServerDialog`, `AgentFilterToolbar`, `CategoryCombobox`
- Heavily reworked: `agents/new/page.tsx`, `Header.tsx`, `AgentCard.tsx`,
  `AgentList.tsx`, sidebars, onboarding, MCP/prompts/models pages
- Lib: `appConfig.ts`, `configStore.ts`, `github.ts`, `constants.ts`

### Helm: Feature Flags, RBAC, UI ConfigMap, Nginx Routing (commit: ec78692a)
- `helm/kagent/files/nginx.conf`: routing rules
- `templates/rbac/{getter-role,writer-role}.yaml`: extra rules
- `templates/{ui-configmap.yaml,ui-deployment.yaml}` + new feature-flag
  values in `values.yaml`

### Cherry-pick from dbci: credentialMounts, Slack BotToken, Kubeconfig, Jira UI (commit: 186b429e)
Ports landed from the internal `dbci-agentic-ai-platform` fork.

- ScheduledRun: include `MessageID` on A2A `SendMessage` (required by trpc-a2a-go)
- `TokenExpiryBanner` z-index fix (sits above header)
- `PlatformCredential`: drop `OAuth2UserDelegation`, add `Kubeconfig` source
- `agent_types.go`: `CredentialMounts` on `SharedDeploymentSpec`
- Broker: remove user-delegation paths; tighten adapter signatures with
  `credNamespace`; Slack simplified to BotToken-only; K8s adapter accepts
  Kubeconfig source
- Translator: resolve `credentialMounts` -> Volumes/VolumeMounts with
  `AccessPolicy` enforcement
- `httpserver/handlers/credentials.go`: `GET /api/v1/credentials` with
  platform/type filters
- UI: serviceAccountName + credentialMounts editor on agent create page;
  full Jira MCP OAuth flow
  (`actions/api/auth/jira/{initiate,complete,refresh,status,disconnect,token}`);
  `ConnectionsDropdown` unifying GitHub + Jira; `JiraExpiryBanner`; `a2a` route
  propagates `X-MCP-Token-jira` header

### Build / CI / Tooling & Per-Directory CLAUDE.md (commit: b6fe3894)
Repo-wide developer-experience commit.

- `.claude/skills/`: `kagent-{build,ci,dev,docs,feature,git,spec,test}/SKILL.md`
  + `goal-driven/SKILL.md`; new `references/` for fork-go-controller and
  fork-python-adk
- ~120 per-directory `CLAUDE.md` files added across `go/`, `python/`,
  `ui/`, `helm/`, `docker/`, `docs/`, `scripts/`, `contrib/`
- `Makefile` and `.gitignore` extended; `changelog/` directory with
  per-feature notes (01-10)
- New Dockerfiles: `go/Dockerfile.{claude-code,codex}.local`,
  `python/Dockerfile.{claude-code-runtime,codex-runtime}`,
  `ui/Dockerfile.local`
- DB migrations `000009_resource_visibility` (core) and
  `000004_memory_visibility` (vector); generated query code updated
- `httpserver/handlers/agents.go` extended

---

## Fixes

### Jira OAuth UI route placement (commit: a2dd1009)
Moves Jira auth routes from `app/actions/api/auth/jira/` to `app/api/auth/jira/`
because Next.js App Router serves API routes from `app/api/`. Fixes 404s on
`/api/auth/jira/*`.

### Helm nginx routing for Jira UI auth (commit: a5e1eeff)
Adds an explicit `location /api/auth/jira/` block to `helm/kagent/files/nginx.conf`
in front of the generic `/api/` rule, so Jira OAuth endpoints reach the Next.js
UI instead of the controller backend.
