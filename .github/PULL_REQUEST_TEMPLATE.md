<!--
Thanks for the PR! Please keep it focused and fill in as much as you can.
The summary, evidence, and checklist matter most for review.
-->

## Summary

<!-- What does this PR do, in a sentence or two? -->

<!-- For non-obvious changes, show the smallest useful view of what changed:
     a diff sketch, component tree, or call flow. For example:

     <SessionPage>
       useSessionEvents()
       <SessionToolbar>
   +     <RunSkillButton />
       <SessionTimeline>
   +     <SkillResultCard />

     -- or a terse list: -->

- Change 1
- Change 2

## Why

<!-- What problem does this solve? Link the issue, e.g. "Closes #123". -->

## Evidence

<!-- How did you verify this works? Paste the passing test output or describe
     what you ran. For UI changes, always include screenshots (before/after). -->

**Screenshots** (UI changes only):

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test` (unit + component)
- [ ] `npm run test:integration` (needs Docker)
- [ ] `npm run test:e2e` (needs Docker and `npm run build`)
- [ ] Manual check against a real Transmission daemon

## Merge Danger

**Door:** one-way / two-way
<!-- One-way = hard to roll back (destructive, data loss, breaking API).
     Two-way = cheap to revert. -->

**Blast Radius:**
<!-- Who and what this can affect, e.g. all torrent operations, the torrents
     table, basic-auth flow, arbitrary installs. -->

## Checklist

- [ ] PR title uses conventional commits (`feat:`, `fix:`, `chore(scope):`, ...)
- [ ] New env vars are documented in `README.md` and `.env.example`
- [ ] New behavior has a test (unit, component, integration, or e2e)
- [ ] No secrets or credentials committed
- [ ] Branch is up to date with `master`