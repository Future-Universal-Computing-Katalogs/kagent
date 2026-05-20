# sota_adapter — SOTA Agent A2A Bridge

Bridges state-of-the-art agent CLIs (Claude Code, Codex) to the A2A protocol so they can be hosted as kagent agents.

## Files

| File | Role |
|------|------|
| `__main__.py` | CLI entry point |
| `_a2a.py` | A2A server wiring |
| `_discovery.py` | Skill / agent discovery |
| `_event_parser.py` | Generic event parser dispatch |
| `_executor.py` | A2A executor that drives the SOTA CLI |

## Sub-packages

| Package | Role |
|---------|------|
| `parsers/` | CLI-specific event parsers (Claude Code, Codex) |
