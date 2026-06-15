---
title: A stacked PR auto-closes when its base branch is deleted on merge — and refuses to reopen
date: 2026-04-29
category: workflow-issues
module: apps.geoglows
problem_type: workflow_issue
component: development_workflow
severity: low
applies_when:
  - You stack PR B on top of PR A's branch (PR B targets `feature/A` instead of `main`)
  - PR A is merged with `gh pr merge A --delete-branch` (the GitHub default for merge UI)
  - You expected PR B to remain open and re-target `main` automatically
tags:
  - github
  - pull-request
  - stacked-pr
  - branch-deletion
  - gh-cli
  - workflow
---

# A stacked PR auto-closes when its base branch is deleted on merge — and refuses to reopen

## Context

When stacking pull requests — PR B branched off PR A's feature branch, with PR B's base set to `feature/A` instead of `main` — merging PR A with the "delete branch" option triggers GitHub to auto-close PR B. This is by design: GitHub closes any PR whose base branch no longer exists. The friction is on the recovery path: a closed PR with a deleted base cannot be reopened, and `gh pr edit --base main` refuses to operate on a closed PR.

## Guidance

When stacking PRs, choose one of these three workflows ahead of the merge:

**Option 1 — re-target before merging the base** *(cleanest, no PR loss):*
```bash
# Before merging PR A, re-target PR B onto main:
gh pr edit B --base main
# Now PR B's diff against main shows everything from both branches stacked.
# Then merge PR A (auto-deletes feature/A; PR B is unaffected).
gh pr merge A --merge --delete-branch
```

**Option 2 — keep the base branch around:**
```bash
gh pr merge A --merge   # do NOT pass --delete-branch
# PR B stays open, base branch still exists.
# Once PR B's diff is reviewed against main, re-target then merge:
gh pr edit B --base main
gh pr merge B --merge --delete-branch
# Then clean up the now-orphan base:
git push origin --delete feature/A
```

**Option 3 — recover after the auto-close** *(works, wastes a PR number):*
```bash
# PR B is already closed; gh refuses to reopen or change its base.
# The head branch usually still exists on the remote — verify:
git ls-remote origin <pr-B-head-branch>

# Open a fresh PR with the same head, targeting main:
gh pr create --base main --head <pr-B-head-branch> \
  --title "Same title (replaces #B)" \
  --body "Replaces #B (auto-closed when its stacked base feature/A was deleted on merge of #A). Same commit; new base."
```

## Why This Matters

Stacking PRs is a common workflow for landing related changes that depend on each other. The default `gh pr merge --delete-branch` is dangerous in the stacked context because:

- GitHub silently auto-closes the dependent PR — no warning, no prompt, no opt-out.
- The auto-closed PR's base cannot be edited (`gh pr edit B --base main` errors with `Cannot change the base branch of a closed pull request`).
- The auto-closed PR cannot be reopened (`gh pr reopen B` errors with `Could not open the pull request`) because GitHub validates that the base branch still exists at reopen time.
- The only recovery is creating a fresh PR, losing the original review thread and PR number.

For teams that lean on PR numbers for changelog/release notes or audit trails, Option 1 (re-target before merging the base) is the right default.

## When to Apply

- Whenever you have a PR that targets another PR's branch (PR B's base is something other than `main`).
- Before clicking "Merge" on the base PR — pause and either re-target the dependent PR first (Option 1) or skip `--delete-branch` (Option 2).
- After hitting the auto-close trap — Option 3 is the recovery path; don't waste time fighting `gh reopen`.

## Examples

The current repo hit this on 2026-04-29:

- PR `Aquaveo/apps.geoglows#5` was stacked on `fix/profile-review-fixes` (PR #4's branch).
- `gh pr merge 4 --merge --delete-branch` was run.
- PR #5 immediately flipped to `state: CLOSED`, `mergeable: CONFLICTING`.
- Both `gh pr edit 5 --base main` (`Cannot change the base branch of a closed pull request`) and `gh pr reopen 5` (`Could not open the pull request`) errored.
- Resolution: opened PR #6 with the same head branch (`chore/profile-tests-and-cleanup`) targeting `main`. Same commit, new PR number, fresh review thread.

The PR description on #6 clearly stated `Replaces #5 (auto-closed when its stacked base fix/profile-review-fixes was deleted on #4 merge). Same commit; new base.` — which is the right pattern for traceability when the original PR is irrecoverable.

## Related

- GitHub docs: deleting a branch closes any associated open pull requests (silent behavior).
- `gh pr` CLI reference for `--delete-branch`, `edit --base`, `reopen`.
