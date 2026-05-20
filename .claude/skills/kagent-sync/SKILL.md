---
name: kagent-sync
description: >
  Code synchronization skill. Pulls upstream kagent-dev/kagent into fork main,
  pushes to fork, rebases develop onto main with intelligent conflict resolution,
  deploys to orc, and validates with kagent-test. Use on a schedule or before
  feature work to stay current with upstream.
argument-hint: "optional: --skip-deploy"
---

# Kagent Sync — Upstream Code Synchronization

Drives Claude Code (bypass mode) to synchronize the fork with upstream and validate on orc.

## Repositories

| Remote | URL | Purpose |
|--------|-----|---------|
| upstream | https://github.com/kagent-dev/kagent | Source of truth |
| origin | https://github.com/Future-Universal-Computing-Katalogs/kagent | Our fork |

## Branches

| Branch | Role |
|--------|------|
| main | Mirror of upstream main (no fork-only commits) |
| develop | Fork customizations rebased on top of main |

---

## Workflow

### Phase 0: Preflight

Verify all prerequisites before starting any git operations.

```bash
# 0.1 Check git remotes
echo "=== Preflight ==="
git remote -v

UPSTREAM=$(git remote get-url upstream 2>/dev/null)
ORIGIN=$(git remote get-url origin 2>/dev/null)

if [ -z "$UPSTREAM" ]; then
  git remote add upstream https://github.com/kagent-dev/kagent.git
  echo "Added upstream remote"
fi

echo "upstream: $UPSTREAM"
echo "origin: $ORIGIN"

# 0.2 Verify credentials
gh auth status
git ls-remote --exit-code origin HEAD >/dev/null && echo "OK: push access to origin" || echo "FAIL: no push access"

# 0.3 Verify orc cluster (optional — needed for Phase 4)
KUBECONFIG_FILE=""
if [ -f ".local/secrets/orc" ]; then
  KUBECONFIG_FILE=".local/secrets/orc"
elif [ -f "$HOME/dbci-agentic-ai-platform/kubeconfigs/orc" ]; then
  KUBECONFIG_FILE="$HOME/dbci-agentic-ai-platform/kubeconfigs/orc"
fi

if [ -n "$KUBECONFIG_FILE" ]; then
  kubectl --kubeconfig="$KUBECONFIG_FILE" --context=cluster-admin-blue get ns kagent >/dev/null 2>&1 && \
    echo "OK: orc cluster reachable" || echo "WARN: orc cluster not reachable (Phase 4 will skip)"
else
  echo "WARN: no orc kubeconfig found (Phase 4 will skip)"
fi

# 0.4 Stash any working changes
if [ -n "$(git status --porcelain)" ]; then
  git stash push -m "kagent-sync: auto-stash before sync"
  echo "Stashed local changes"
fi
```

---

### Phase 1: Pull Upstream → Main

```bash
echo "=== Phase 1: Sync main with upstream ==="

# Fetch upstream
git fetch upstream main --tags

# Record current positions
UPSTREAM_SHA=$(git rev-parse upstream/main)
MAIN_SHA=$(git rev-parse origin/main 2>/dev/null || echo "none")
echo "upstream/main: $UPSTREAM_SHA"
echo "origin/main:   $MAIN_SHA"

# Switch to main and fast-forward
git checkout main
git reset --hard upstream/main

echo "OK: main now at upstream/main ($UPSTREAM_SHA)"
```

---

### Phase 2: Push Main to Fork

```bash
echo "=== Phase 2: Push main to fork ==="

git push origin main --force-with-lease

# Verify
PUSHED_SHA=$(git rev-parse origin/main)
echo "OK: origin/main pushed ($PUSHED_SHA)"
```

---

### Phase 3: Rebase Develop onto Main

This is the critical phase — develop has fork-only commits that must be rebased.

```bash
echo "=== Phase 3: Rebase develop onto main ==="

git checkout develop

# Count commits ahead of main
AHEAD=$(git log main..develop --oneline | wc -l | tr -d ' ')
echo "develop is $AHEAD commits ahead of main"

# Attempt rebase
git rebase main
```

#### Conflict Resolution Strategy

If rebase encounters conflicts, resolve them using this priority:

| Path Pattern | Strategy | Command |
|-------------|----------|---------|
| `.local/*` | Keep ours (fork) | `git checkout --ours <file> && git add <file>` |
| `.claude/*` | Keep ours (fork) | `git checkout --ours <file> && git add <file>` |
| `go/core/internal/sap/*` | Keep ours (fork) | `git checkout --ours <file> && git add <file>` |
| `scripts/build/*` | Keep ours (fork) | `git checkout --ours <file> && git add <file>` |
| `helm/kagent/values.yaml` | Manual merge | Inspect both sides, keep fork additions alongside upstream changes |
| `docker/*` | Keep ours (fork) | `git checkout --ours <file> && git add <file>` |
| Everything else | Keep theirs (upstream) | `git checkout --theirs <file> && git add <file>` |

```bash
# Automatic conflict resolution (called per conflicting file)
resolve_conflict() {
  local FILE="$1"
  case "$FILE" in
    .local/*|.claude/*|go/core/internal/sap/*|scripts/build/*|docker/*)
      git checkout --ours "$FILE" && git add "$FILE"
      echo "  Resolved $FILE → kept ours (fork)"
      ;;
    helm/kagent/values.yaml)
      # For values.yaml, attempt to merge both sides
      # If auto-merge fails, keep ours and flag for manual review
      git checkout --ours "$FILE" && git add "$FILE"
      echo "  WARN: $FILE → kept ours, may need manual review"
      ;;
    *)
      git checkout --theirs "$FILE" && git add "$FILE"
      echo "  Resolved $FILE → kept theirs (upstream)"
      ;;
  esac
}

# If rebase is in progress with conflicts
while [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; do
  CONFLICTS=$(git diff --name-only --diff-filter=U)
  if [ -z "$CONFLICTS" ]; then
    git rebase --continue
    continue
  fi

  echo "Conflicts in:"
  echo "$CONFLICTS"

  ATTEMPT=0
  MAX_ATTEMPTS=3
  while [ -n "$CONFLICTS" ] && [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    for FILE in $CONFLICTS; do
      resolve_conflict "$FILE"
    done
    ATTEMPT=$((ATTEMPT + 1))
    CONFLICTS=$(git diff --name-only --diff-filter=U 2>/dev/null)
  done

  if [ -n "$CONFLICTS" ]; then
    echo "FAIL: Unresolvable conflicts after $MAX_ATTEMPTS attempts:"
    echo "$CONFLICTS"
    echo "Aborting rebase. Manual intervention required."
    git rebase --abort
    exit 1
  fi

  git rebase --continue || true
done

echo "OK: rebase completed"
```

#### Push Develop

```bash
# Force push develop (rebased history)
git push origin develop --force-with-lease
echo "OK: develop pushed"

# Summary
DEVELOP_SHA=$(git rev-parse HEAD)
echo "develop HEAD: $DEVELOP_SHA"
echo "Commits on develop above main: $(git log main..develop --oneline | wc -l | tr -d ' ')"
```

---

### Phase 4: Deploy & Validate on orc

Only runs if orc cluster is reachable.

```bash
echo "=== Phase 4: Deploy & Validate ==="

if [ -z "$KUBECONFIG_FILE" ]; then
  echo "SKIP: No orc kubeconfig, skipping deploy+test"
  exit 0
fi
```

Then **invoke the `kagent-ci` skill**:

```
/kagent-ci orc
```

`kagent-ci` wraps `.local/deploy.sh` (build + push + deploy + rollout-wait).
Do not inline the deploy contract here — the skill is the single source of truth.

After deploy succeeds, **invoke `/kagent-test`** to validate (minimum passing: phases 1-4).

---

### Phase 5: Report

```bash
echo ""
echo "========================================"
echo "  KAGENT SYNC COMPLETE"
echo "========================================"
echo ""
echo "Upstream SHA: $(git rev-parse upstream/main)"
echo "Fork main:   $(git rev-parse origin/main)"
echo "Develop:     $(git rev-parse origin/develop)"
echo "Ahead of main: $(git log main..develop --oneline | wc -l | tr -d ' ') commits"
echo ""
echo "Conflicts resolved:"
# (populated during Phase 3)
echo ""
echo "Deployment: ${DEPLOY_STATUS:-skipped}"
echo "Tests: ${TEST_STATUS:-skipped}"
echo "========================================"

# Unstash if we stashed earlier
if git stash list | grep -q "kagent-sync: auto-stash"; then
  git stash pop
  echo "Restored stashed changes"
fi
```

---

## Error Recovery

| Failure | Recovery |
|---------|----------|
| Rebase conflict (unresolvable) | `git rebase --abort`, report conflicting files |
| Push rejected | `git push --force-with-lease` or report |
| Deploy fails | Capture pod logs, report, mark sync as partial |
| Tests fail | Report results, mark sync as successful (tests validate, don't gate) |
| Network error | Retry once, then report |

---

## Scheduling

To run on a schedule (e.g., daily):

```
CronCreate(
  cron: "23 2 * * *",
  prompt: "/kagent-sync",
  recurring: true,
  durable: true
)
```

This runs at 2:23 AM daily. Adjust based on team timezone.

---

## Quick Reference

```bash
# Full sync
/kagent-sync

# Sync without deploy (just git operations)
/kagent-sync --skip-deploy

# Check what would happen (dry run)
git fetch upstream main && git log main..upstream/main --oneline
git log main..develop --oneline
```
