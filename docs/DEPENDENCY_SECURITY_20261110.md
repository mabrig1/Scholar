# Scholar dependency security maintenance — November 10, 2026

This branch is a minimal dependency-security remediation for the existing Scholar application and its Evidence Atlas module.

## Changes
- Next.js 15.5.26 -> 15.5.29 (patched 15.x line recommended by npm audit).
- Sharp override 0.35.4 -> 0.35.5 (GHSA-wq5f-xc86-pv6w).
- source-map-js override -> 1.2.2 (GHSA-68fv-2mgg-jv7q).
- Regenerated package-lock.json with npm; includes corresponding Next SWC and Sharp platform binaries.

The patch was generated in a branch-only workflow. The temporary write-enabled workflow deleted itself before committing, so no automation with repository-write credentials is added to main.

## Validation in isolated GitHub Actions
- npm ci — passed.
- npm audit --audit-level=high — passed during the isolated patch build.
- npm run typecheck — passed.
- npm test — passed.
- npm run build — passed.

## Release gates
- Check all standard Scholar Quality Gate and DevShield jobs on the latest branch head after this documentation commit.
- Revalidate preview behavior and key scholarly workflows manually.
- Do not skip the dependency audit or force-merge failing checks.
- Do not assert that a passing npm audit proves the platform is free from vulnerabilities.
- Keep production deployment and secrets unchanged until reviewed.

Prior failure was recorded in issue #24 and on the Evidence Atlas Phase 2 PR #25.
