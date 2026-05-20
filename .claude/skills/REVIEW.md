# Skills Review (2026-05-20)

Scope: all 12 SKILL.md files under `.claude/skills/`. Strategy is REFRESH (no
changelog appended to each file) — this REVIEW.md is the single audit artifact.

---

## Inventory

| Skill | Purpose (one line) | Invokes | Invoked by |
|---|---|---|---|
| `goal-driven` | Generic master/sub orchestrator with 3-min monitor loop | (any) | — |
| `kagent` | End-user guide: kagent CLI, CRDs, MCP, A2A — *not* dev | (none) | — |
| `kagent-dev` | Dev reference: fork map, CRD workflow, E2E debugging, CI failures | (none — pure reference) | `kagent-feature`, `kagent-implement` (cloud side) |
| `kagent-build` | Incremental parallel rebuild based on git diff | per-component `scripts/build/*.sh` | `kagent-feature` (Phase 2/3), `kagent-ci` (build phase) |
| `kagent-ci` | One-shot deploy via `.local/deploy.sh` (orc/haas) | per-component build scripts | `kagent-feature` (Phase 3), `kagent-sync` (Phase 4), `kagent-implement` (cloud Phase 4) |
| `kagent-test` | Post-deploy HTTP smoke test (8 phases) | (none) | `kagent-sync` (Phase 4), `kagent-feature` (Phase 4), `kagent-implement` |
| `kagent-spec` | CLAUDE.md drift scanner — refresh stale per-dir docs | (none) | — |
| `kagent-docs` | Docs freshness checker for `docs/architecture/`, READMEs, CHANGELOG | (none) | — |
| `kagent-git` | Reorganize commits: feature × layer matrix | (none) | `kagent-feature` (Phase 5) |
| `kagent-sync` | Pull upstream → rebase develop → deploy → test | `kagent-test`, `.local/deploy.sh` (= ci) | scheduled cron |
| `kagent-feature` | Master-Sub feature pipeline: develop → test → deploy → validate → cleanup | `kagent-dev`, `kagent-build`, `kagent-ci`, `kagent-test`, `kagent-git` | user |
| `kagent-implement` | Local-writes-spec → cloud-Claude-Code-implements pipeline | `kagent-test`, `.local/deploy.sh` (= ci) | user |

---

## Composability Graph

```
                   user
                    │
      ┌─────────────┼─────────────────┐
      ▼             ▼                 ▼
  kagent-feature  kagent-implement   kagent-sync (cron)
      │             │                 │
      ├──► kagent-dev (reference docs only)
      ├──► kagent-build (Phase 2/3)
      ├──► kagent-ci    ◄──────────── ┤  (deploy)
      ├──► kagent-test  ◄──────────── ┘  (validate)
      └──► kagent-git   (Phase 5 only)

  goal-driven   ── generic, project-agnostic; sibling pattern to kagent-feature
  kagent-spec   ── CLAUDE.md drift; standalone
  kagent-docs   ── architecture-doc drift; standalone
  kagent (UG)   ── end-user guide; standalone
```

Three orchestrators converge on the same execution primitives (`kagent-ci`,
`kagent-test`). `kagent-dev` is a reference handbook, not an action — it's
"linked to" not "invoked".

---

## Issues Found

### Fixed in-place

- **`kagent-feature/SKILL.md`** — referenced non-existent `kagent-ci-kind`
  skill in 3 places (Phase 3 prompt, Sub-agent context, Section 4 delegation
  map). Updated to `kagent-ci` + cross-link to `kagent-build` and `kagent-test`.
- **`kagent-dev/SKILL.md`** — same `kagent-ci-kind` ghost reference under "Kind
  Deployment (Detailed)". Repointed to `kagent-ci` / `kagent-build` /
  `kagent-test`. Also added missing `argument-hint`.
- **`kagent-git/SKILL.md`** — missing `argument-hint` (added empty hint).
- **`kagent-implement/SKILL.md`** — missing `argument-hint` (added
  `<feature-slug>`).
- **`kagent-sync/SKILL.md`** — missing `argument-hint` (added
  `--skip-deploy`); fixed bogus `/kagent-test orc` invocation (the test skill
  doesn't take a cluster arg — it auto-detects).
- **`kagent-test/SKILL.md`** — missing `argument-hint` (added phase number
  list).

Total fixed in-place: **6 skills touched, 8 discrete edits**.

### Open recommendations (master decides)

1. **`kagent-feature` vs `goal-driven` overlap.** Both are master/sub
   orchestrators. `goal-driven` is generic, `kagent-feature` is kagent-specific.
   Consider making `kagent-feature` explicitly say "if your task is generic,
   use `goal-driven` instead" in its description so the LLM picks correctly.
   **RESOLVED 2026-05-20** — `kagent-feature` description now disambiguates
   from `goal-driven` and `kagent-implement`.
2. **`kagent-implement` should call `kagent-ci` and `kagent-test` by name.**
   It currently inlines `.local/deploy.sh` and "invoke /kagent-test". Tighten
   to: cloud agent literally invokes the two skills as primitives. Reduces
   drift if deploy.sh interface changes.
   **RESOLVED 2026-05-20** — Phase 4 + cloud-agent prompt now invoke
   `/kagent-ci orc` and `/kagent-test` instead of inlining `.local/deploy.sh`.
3. **`kagent-sync` Phase 4 likewise inlines deploy.** Same fix — call
   `kagent-ci orc` instead of repeating the deploy contract.
   **RESOLVED 2026-05-20** — Phase 4 now invokes `/kagent-ci orc`; the inline
   `.local/deploy.sh` + rollout-status block was removed.
4. **`kagent` (user guide) and `kagent-dev` (developer guide)** have a clean
   split today, but `kagent` description is 11 lines long. LLMs may
   over-trigger it. Consider trimming to 3 sentences.
   **OPEN** — needs editorial pass on user-facing description.
5. **`kagent-build` and `kagent-ci` have overlapping logic** — both can build.
   ci's "build phase" is redundant with the standalone build skill. Could
   refactor `kagent-ci` to literally `invoke kagent-build && push && deploy`.
   Currently they just both call the same per-component scripts independently
   — works, but composition would be cleaner.
   **PARTIALLY RESOLVED 2026-05-20** — Both skills now carry "see also" cross
   links. Full refactor (ci-invokes-build) deferred — `.local/deploy.sh` is
   the actual primitive, both skills wrap it; rewriting deploy.sh to delegate
   to `scripts/build/*.sh` is out of scope for a docs pass.
6. **`kagent-spec` and `kagent-docs` are siblings** (one verifies CLAUDE.md,
   the other verifies docs/). Worth a one-line cross-link in each so LLM picks
   the right one based on the file the user mentions. Today there's no link.
   **RESOLVED 2026-05-20** — Both files now carry a "see also" block at the top.
7. **`kagent-feature` Phase 5 prompt** still references "kagent-git skill
   EXACTLY" which is fine, but the prompt body re-paraphrases kagent-git rules
   inline. Risk of drift. Recommend: prompt should *only* tell sub-agent to
   "follow the kagent-git skill" and not duplicate its content.
   **RESOLVED 2026-05-20** — Phase 5 prompt collapsed to "invoke `/kagent-git`
   and follow its workflow"; the paraphrased grouping rules were removed.
8. **No skill currently documents `.claude/specs/`** as a first-class
   convention except `kagent-implement`. If specs become more central
   (multiple skills read them), consider a tiny `kagent-specs` skill or a
   section in `kagent-dev`.
   **OPEN** — wait until a second skill needs to read `.claude/specs/`.

Total open recommendations: **8** (6 resolved 2026-05-20, 2 still open: #4 trim `kagent` description, #8 elevate `.claude/specs/`).

---

## Half-year refresh checklist

When this skill suite is next reviewed (target: 2026-11):

1. Re-run the inventory table — any new skills? any removed?
2. Check every `argument-hint` is still accurate (CLI flags drift).
3. Grep for stale skill names: `grep -rn "kagent-ci-kind\|kagent-deploy\|kagent-validate" .claude/skills/`
4. Verify each skill that mentions a script path (`.local/deploy.sh`,
   `scripts/build/*.sh`, kubeconfigs) — confirm paths still exist.
5. Verify CRD count in `kagent-docs` (currently "10 controllers, 8 CRDs") —
   compare with `ls go/api/v1alpha2/*_types.go` and controller dir.
6. Check `kagent-test` phase count vs actual phases in the file (currently 8).
7. Re-evaluate composition graph: is `kagent-feature` still the only top-level
   orchestrator? Did `goal-driven` prove redundant?
8. Confirm fork-customization map in `kagent-dev` still matches reality
   (run `kagent-spec` and `kagent-docs` first; they catch most of this).
9. Description-length sanity: any description >5 lines is a smell — trim.
10. Any skill still mentioning `MCPServer KMCP` or `v1alpha1` as primary?
    Should be removed (project moved to v1alpha2 long ago).
