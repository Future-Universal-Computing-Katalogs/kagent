# go/core/pkg/sandboxbackend/openshell — OpenShell Sandbox Backend

OpenShell-based sandbox executor for SandboxAgent CRDs. Translates sandbox specs into OpenShell API calls and manages sandbox lifecycle.

## Files

| File | Role |
|------|------|
| `agentharness_openshell_client.go` | OpenShell client for AgentHarness sandboxes |
| `client.go` | Generic OpenShell sandbox client |
| `config.go` | Backend configuration |
| `openclaw.go` | OpenClaw bootstrap helpers |
| `openshell.go` | OpenShell sandbox lifecycle wrapper |
| `policy.go` | Sandbox policy translation |
| `translate.go` | SandboxAgent CRD to OpenShell request translation |

## Sub-packages

| Package | Role |
|---------|------|
| `openclaw/` | OpenClaw provider (bootstrap, channels, credentials, model config, policy resolution) |
