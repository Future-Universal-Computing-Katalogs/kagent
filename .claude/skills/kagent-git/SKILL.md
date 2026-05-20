---
name: kagent-git
description: >
  Reorganize and squash messy commits on the current branch into clean, atomic commits.
  Group strictly by feature — one commit per concrete feature, regardless of how many
  scope layers (api, controller, runtime, ui, helm) it touches. Use this skill when the
  user asks to tidy up commits, reorganize git history, or prepare a branch for PR review.
argument-hint: ""
---

# Kagent Git — Atomic Commit Reorganization

Reorganize all commits on the current branch (since diverging from main) into clean,
atomic commits. The key principle: **One feature = one commit.**

## Splitting Strategy

### Group by feature, not by layer

A "feature" is a user-facing capability or a cohesive logical unit of work. All changes
that implement a single feature — across API, controller, runtime, UI, helm, anything —
go into **one commit**, even when that touches dozens of files across all subprojects.

Examples of features:
- "Scheduled Runs" — CRD + controller + scheduler + HTTP handlers + UI page → ONE commit
- "Inline Skills" — CRD + translator + init container + runtime executor → ONE commit
- "Jira OAuth" — UI routes + ConnectionsDropdown + nginx routing → ONE commit
- "Agent Ownership" — DB schema + filtering + auth proxy + GitHub OAuth UI → ONE commit
- "MCP OAuth" — OAuth tools + memory cache + session storage → ONE commit

### Why feature-first (not layer-first)

A reviewer reading `feat(scheduled-runs)` should see the full picture in one diff —
the type, the controller logic that uses it, and the UI that exposes it. Splitting into
`feat(scheduled-runs/api)`, `feat(scheduled-runs/controller)`, `feat(scheduled-runs/ui)`
forces the reviewer to mentally stitch three commits back together. Don't make them.

### When to keep separate

- Two different features that happen to touch the same layer → separate commits
- A feature stack where one builds on another (e.g. `platform-credentials` CRDs are a
  prerequisite for `credential-mounts`) → keep them as separate commits in dependency
  order, not bundled
- A pre-existing layer-only commit that genuinely doesn't fit any feature (e.g. a
  generic `feat(controller): session pinning, prompt templates` of unrelated small
  improvements) → leave as is

### Special group: Build & CI (always ONE single commit, at the end)

All build/CI/tooling/skill/doc changes go into **one commit** at the bottom of the stack.

**Included:**
- `Makefile`, `**/Makefile`
- `**/Dockerfile*`
- `.github/**`, `.claude/skills/**`, `CLAUDE.md`
- `docker/**`, `.goreleaser*`, `.dockerignore`, `.gitignore`
- `helm/**/Chart.yaml` (packaging only — feature-related helm changes go with the feature)
- Changelog, architecture docs that don't belong to a specific feature

**Commit message:** `chore: update build, CI, tooling, skills, and docs`

## Commit Message Format

```
<type>(<feature>): <one-line summary spanning all layers>
```

If the feature lives entirely in one scope and there's a clear single layer, use that
as the scope:
```
<type>(<scope>): <description>
```

**Examples:**
```
feat(scheduled-runs): add ScheduledRun CRD, scheduler, HTTP handlers, and UI
feat(inline-skills): add InlineSkill CRD, controller translation, and runtime execution
feat(ownership): private mode, ownership filtering, proxy auth, and GitHub OAuth UI
feat(jira-oauth): MCP OAuth flow, ConnectionsDropdown, and nginx routing
feat(sap): AI Core proxy, credential broker, and platform adapters
feat(runtime): MCP OAuth tools and memory service caching
feat(controller): session pinning and prompt templates
chore: update build, CI, tooling, skills, and docs
```

## Execution Procedure

### Step 1: Analyze

```bash
git merge-base main HEAD
git diff --name-only $(git merge-base main HEAD)..HEAD
git log --oneline $(git merge-base main HEAD)..HEAD
```

Study the full diff. Identify distinct features by reading commit messages AND file
changes. Look especially for:
- Megacommits that touch multiple unrelated features → split them
- The same feature scattered across multiple commits (typical pattern: `feat(X)` then
  later `fix(X)` and another `feat(X/ui)`) → consolidate them

### Step 2: Plan — Feature Matrix

Present a matrix to the user:

| # | Feature | Source commits | Key files | Proposed message |
|---|---------|----------------|-----------|------------------|
| 1 | scheduled-runs | abc123 + def456 + parts of ghi789 | CRD, scheduler, UI | `feat(scheduled-runs): ...` |
| 2 | ownership | jkl012 + mno345 | DB, auth proxy, OAuth UI | `feat(ownership): ...` |
| ... | | | | |
| N | build/ci | xyz999 | Makefile, Dockerfile, skills | `chore: ...` |

**Rules for the matrix:**
- One row = one feature = one final commit, regardless of how many layers it spans
- If a single source commit contains multiple features, list it with "parts of" and
  identify the file globs that belong to each feature
- Files serving multiple features: ask the user or assign to the primary feature
- Generated files go with the commit that caused generation

**Wait for user approval before proceeding.**

### Step 3: Execute

```bash
ORIGINAL_HEAD=$(git rev-parse HEAD)
BASE=$(git merge-base main HEAD)

# Backup branch (safety net before destructive history rewrite)
git branch backup/pre-reorg-$(date +%Y%m%d-%H%M%S) HEAD

# Soft reset to merge-base — all changes become staged
git reset --soft $BASE

# Unstage everything
git reset HEAD .

# Commit each feature (bottom of stack first → build/ci last)
# Feature 1
git add <files-for-feature-1...>
git commit -s -m "<type>(<feature>): <description>"

# Feature 2
git add <files-for-feature-2...>
git commit -s -m "<type>(<feature>): <description>"

# ... repeat for all features ...

# Last: Build & CI
git add <remaining build files...>
git commit -s -m "chore: update build, CI, tooling, skills, and docs"
```

### Step 4: Verify

```bash
# Must be empty — no code lost
git diff $ORIGINAL_HEAD HEAD

# Clean tree
git status

# New log
git log --oneline $BASE..HEAD
```

If diff is non-empty, investigate and fix before proceeding. The backup branch lets you
recover by `git reset --hard backup/pre-reorg-<timestamp>`.

## Ordering of Commits

Commits should be ordered for reviewability — bottom of log = foundational, top = latest:

1. **Foundational features first** — CRDs and types other features depend on (e.g.
   `platform-credentials` before `credential-mounts`)
2. **Independent features** in any reasonable order, largest first within a group
3. **Cross-cutting infra** (helm features, visibility) before build/CI
4. **Build & CI last** (tooling, always at top of log)

Within the same dependency tier, order by size (largest feature first).

## Important Notes

- **NEVER force-push without user confirmation.**
- **Preserve all changes.** `git diff $ORIGINAL_HEAD HEAD` must be empty.
- **Sign commits** with `-s` flag.
- **Backup first** — always create a `backup/pre-reorg-<timestamp>` branch before reset.
- **When in doubt, ask.** If a file could belong to multiple features, ask the user.
- **Untracked build artifacts** should NOT be committed. Mention them to the user.
- **Generated files** go with the commit that caused generation.
- **Helm CRD templates** that mirror CRD YAML go with the feature commit (not build/CI).
