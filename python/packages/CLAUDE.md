# python/packages/ - Workspace Packages

All installable Python packages in the UV workspace.

| Package | Role | Key Dependencies |
|---------|------|-----------------|
| `kagent-adk` | Main ADK runtime - agent execution, MCP toolset, model integration, A2A server | google-adk, openai, anthropic, mcp, a2a-sdk |
| `kagent-core` | Shared library - config, A2A protocol, OpenTelemetry tracing | a2a-sdk, opentelemetry-* |
| `kagent-skills` | Skill discovery and loading from YAML definitions | pydantic, pyyaml |
| `kagent-crewai` | CrewAI framework integration | crewai |
| `kagent-langgraph` | LangGraph framework integration with A2A server | langgraph, langchain-core |
| `kagent-openai` | OpenAI Agents SDK integration with A2A server | openai-agents, openai |
| `kagent-sota-adapter` | SOTA agent adapter (Claude Code, Codex) bridging to A2A | a2a-sdk |
| `agentsts-adk` | ADK-specific security token exchange bindings | google-adk, PyJWT |
| `agentsts-core` | RFC 8693 OAuth 2.0 Token Exchange client | httpx, cryptography, PyJWT |
