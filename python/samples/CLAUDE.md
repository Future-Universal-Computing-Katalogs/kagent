# python/samples/ - Example Agents

Sample agent implementations demonstrating each supported framework.

| Directory | Framework | Examples |
|-----------|-----------|----------|
| `adk/` | Google ADK (kagent-adk) | Basic agent |
| `crewai/` | CrewAI (kagent-crewai) | Poem flow, Research crew |
| `langgraph/` | LangGraph (kagent-langgraph) | Currency, HITL-tools, Kebab |
| `openai/` | OpenAI Agents (kagent-openai) | Basic agent |
| `sota/` | SOTA adapter (kagent-sota-adapter) | Claude Code agent, Codex agent |

Each sample is a standalone UV workspace member with its own `pyproject.toml`, `Dockerfile`, and `agent.yaml` (Kubernetes manifest).
