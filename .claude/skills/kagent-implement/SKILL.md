---
name: kagent-implement
description: >
  Feature implementation pipeline. Local Claude Code generates a structured spec
  file; cloud Claude Code (on orc) picks it up, implements the feature, deploys,
  and validates. Use this skill to hand off planned features to autonomous cloud
  execution.
argument-hint: "<feature-slug> (optional, will prompt if omitted)"
---

# Kagent Implement — Feature Implementation Pipeline

Hand off feature specs from local to cloud Claude Code for autonomous implementation and testing.

## Architecture

```
┌──────────────────┐        git push         ┌──────────────────────┐
│  Local Claude    │ ──────────────────────▶  │  Cloud Claude Code   │
│  (plan + spec)   │                          │  (orc cluster agent) │
└──────────────────┘                          └──────────────────────┘
       │                                              │
       │ 1. Generate spec                             │ 3. Read spec
       │ 2. Push to develop                           │ 4. Implement
       │                                              │ 5. Deploy to orc
       │                                              │ 6. Run /kagent-test
       │         git pull                             │ 7. Push results
       │ ◀──────────────────────────────────────────  │
       │ 8. Check spec status                         │
       └──────────────────────────────────────────────┘
```

## Spec File Location

All specs live in: `.claude/specs/<feature-slug>.md`

---

## Phase 1: Spec Generation (LOCAL)

This phase runs locally. Interactive with user.

### Step 1.1: Gather Requirements

Ask the user:
- What feature to build?
- What modules are affected?
- Any architectural constraints?
- What tests should validate it?

### Step 1.2: Generate Spec File

Create `.claude/specs/<slug>.md` using the template:

```bash
SLUG="<feature-slug>"  # e.g., "session-pinning-patch"
SPEC_FILE=".claude/specs/${SLUG}.md"

cat > "$SPEC_FILE" << 'SPEC_EOF'
---
id: feature-<slug>
status: pending
author: <github-username>
created: <YYYY-MM-DD>
target-branch: develop
deploy-target: orc
test-phases: [1,2,3,4,11]
---

# Feature: <Title>

## Objective
<What to build and why — 2-3 sentences>

## Acceptance Criteria
- [ ] Criterion 1 (observable outcome)
- [ ] Criterion 2 (observable outcome)
- [ ] All existing tests pass
- [ ] /kagent-test specified phases pass on orc

## Affected Modules
| Module | Changes |
|--------|---------|
| go/api | <CRD field additions, type changes> |
| go/core | <Controller logic, HTTP handlers> |
| python/ | <ADK changes> |
| ui/ | <Frontend changes> |
| helm/ | <Chart/values changes> |

## Implementation Notes
<Guidance from local planning:>
- Architecture decisions made
- Patterns to follow (reference existing code paths)
- Files to modify (specific paths)
- Order of operations

## Test Requirements
<What /kagent-test phases to run, plus any custom validation:>
- Phase X: validates <aspect>
- Custom: curl $API_BASE/api/<endpoint> should return <expected>

## Constraints
- Backward compatibility: <yes/no, details>
- Performance: <any SLAs>
- Security: <any considerations>
- Do NOT modify: <files/modules to leave alone>

## Progress Log
<!-- Cloud agent appends entries below -->
SPEC_EOF

echo "Spec created: $SPEC_FILE"
```

### Step 1.3: Commit and Push

```bash
git add ".claude/specs/${SLUG}.md"
git commit -m "spec: ${SLUG}"
git push origin develop
echo "Spec pushed to origin/develop"
```

---

## Phase 2: Trigger Cloud Agent

### Option A: Manual Trigger (via A2A)

Instruct the orc Claude Code agent to implement:

```bash
# Port-forward to orc controller
KUBECONFIG=".local/secrets/orc"
kubectl --kubeconfig=$KUBECONFIG --context=cluster-admin-blue \
  port-forward -n kagent svc/kagent-controller 8083:8083 &
sleep 2

# Send implementation instruction via A2A
AGENT_NS="kagent"
AGENT_NAME="kagent-claude-code"  # The sync/implement agent deployed on orc

curl -X POST http://localhost:8083/api/a2a/$AGENT_NS/$AGENT_NAME \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "id": "impl-'$SLUG'",
    "params": {
      "message": {
        "role": "user",
        "parts": [{
          "type": "text",
          "text": "Implement the feature described in .claude/specs/'$SLUG'.md on branch develop. Follow the spec exactly. After implementation: invoke /kagent-ci orc to deploy, then /kagent-test for the phases specified in the spec. Update the spec status field when done."
        }]
      }
    }
  }'
echo "Implementation request sent to cloud agent"
```

### Option B: Manual Instruction

If A2A is not configured, tell the user:
> SSH/exec into the Claude Code agent pod on orc and run:
> `claude "Implement feature from spec .claude/specs/<slug>.md on branch develop"`

---

## Phase 3: Implementation (CLOUD — Instructions for Cloud Agent)

The cloud agent should execute these steps:

```bash
# 3.1 Pull latest
git fetch origin develop
git checkout develop
git pull origin develop

# 3.2 Read spec
SPEC=$(cat .claude/specs/<slug>.md)
# Parse status — only proceed if "pending"

# 3.3 Update status to in-progress
sed -i 's/status: pending/status: in-progress/' .claude/specs/<slug>.md

# 3.4 Implement changes per acceptance criteria
# (Claude Code reads the spec and implements)

# 3.5 Verify
make -C go lint
make -C go test

# 3.6 Commit
git add -A
git commit -m "feat: <description from spec>"

# 3.7 Append to progress log
echo "- [$(date +%Y-%m-%d\ %H:%M)] Implementation complete, tests passing" >> .claude/specs/<slug>.md
git add .claude/specs/<slug>.md
git commit -m "spec: update progress for <slug>"
```

---

## Phase 4: Deploy & Test (CLOUD)

The cloud agent invokes the existing skills as primitives — do **not** inline
the deploy contract here.

```
# 4.1 Deploy (build + push + rollout)
/kagent-ci orc

# 4.2 Validate (smoke tests)
/kagent-test
# Run with the phases listed in spec's test-phases field
```

Retry loop (max 3 attempts):

```bash
RETRY=0
while [ $RETRY -lt 3 ]; do
  # /kagent-ci orc        — redeploy after fixes
  # /kagent-test          — re-validate
  # If pass: break; else read error, fix code, loop
  RETRY=$((RETRY + 1))
done

# 4.5 Update spec status
if [ $TESTS_PASSED ]; then
  sed -i 's/status: in-progress/status: completed/' .claude/specs/<slug>.md
else
  sed -i 's/status: in-progress/status: failed/' .claude/specs/<slug>.md
fi

# 4.6 Push results
git add -A
git commit -m "spec: mark <slug> as completed"
git push origin develop
```

---

## Phase 5: Monitor & Collect Results (LOCAL)

After triggering the cloud agent, monitor progress:

```bash
# Poll spec status every 3 minutes
check_status() {
  git fetch origin develop --quiet
  STATUS=$(git show origin/develop:.claude/specs/${SLUG}.md | grep "^status:" | awk '{print $2}')
  echo "Spec status: $STATUS"

  case "$STATUS" in
    completed)
      echo "Feature implementation SUCCEEDED"
      git pull origin develop
      echo "Changes pulled. Review with: git log main..develop --oneline"
      ;;
    failed)
      echo "Feature implementation FAILED"
      git pull origin develop
      echo "Check progress log: cat .claude/specs/${SLUG}.md"
      ;;
    in-progress)
      echo "Still in progress..."
      ;;
  esac
}
```

Use CronCreate for automated polling:
```
CronCreate(
  cron: "*/3 * * * *",
  prompt: "Check implementation status: git fetch origin develop && git show origin/develop:.claude/specs/<slug>.md | head -10",
  recurring: true
)
```

---

## Spec Lifecycle

```
pending → in-progress → completed
                     ↘ failed
```

| Status | Meaning | Action |
|--------|---------|--------|
| pending | Spec written, waiting for cloud pickup | Trigger cloud agent |
| in-progress | Cloud is implementing | Monitor/wait |
| completed | All criteria met, tests pass | Pull and review |
| failed | Implementation or tests failed 3x | Read progress log, fix spec, retry |

---

## Cloud Agent Prerequisites

The Claude Code agent on orc needs:

| Requirement | How |
|------------|-----|
| Git write access | SSH key or PAT mounted as Secret |
| `gh` CLI | Baked into golang-adk-cc image |
| ModelConfig | Anthropic API key or AI Core proxy configured |
| deploy.sh access | Mounted from repo (or cloned) |
| kubectl access | ServiceAccount with cluster-admin in kagent namespace |
| Skill files | Repo checked out with `.claude/skills/` |

---

## Example Usage

```bash
# 1. User plans locally with Claude Code
# User: "I want to add a readiness probe to the agent deployment"
# Claude: plans the approach, identifies files

# 2. Generate and push spec
/kagent-implement

# 3. Claude interacts to build the spec, commits, pushes
# 4. Triggers cloud agent
# 5. Monitors until completion
# 6. User reviews changes on develop branch
```

---

## Quick Reference

```bash
# Create a new feature spec (interactive)
/kagent-implement

# Check status of a spec
cat .claude/specs/<slug>.md | grep "^status:"

# List all specs
ls .claude/specs/*.md

# Pull latest from cloud
git pull origin develop

# Retry a failed spec (reset to pending)
sed -i 's/status: failed/status: pending/' .claude/specs/<slug>.md
git add .claude/specs/<slug>.md && git commit -m "spec: retry <slug>" && git push origin develop
```
