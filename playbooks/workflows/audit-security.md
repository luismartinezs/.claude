# Workflow: Security Audit

## Starting State
A codebase with features deployed or about to deploy, where security posture has not been formally assessed.

## End State
Full adversarial security review completed, critical vulnerabilities fixed, remaining issues tracked, and security-relevant architectural decisions captured in memory.

## Tools Discovered
- Tasks: `engineering/audit-security`, `engineering/review-code`, `meta/update-memory`
- Scripts: `bun run typecheck` (validation after fixes)
- Gaps: None. All steps covered.

## Steps

1. **Audit**
   - Input: Target scope (usually full repo for first audit, specific app/feature for follow-ups)
   - Task: `playbooks/tasks/engineering/audit-security.md`
   - Output: Scored security report with findings by severity, attack paths, and concrete fixes
   - Gate: User reviews findings. Agrees on which Critical and Warning findings to fix now vs. track for later.

2. **Fix Critical Findings**
   - Input: Critical findings from Step 1 with their suggested fixes
   - Task: ad-hoc (apply the specific fixes identified in the audit)
   - Output: Patched code, minimal diff per finding
   - Constraint: One finding, one fix, one commit. Run `bun run typecheck` after each fix. Do not bundle unrelated fixes.

3. **Fix Warning Findings**
   - Input: Warning findings approved for immediate fix
   - Task: ad-hoc (apply the specific fixes)
   - Output: Patched code
   - Constraint: Same as Step 2. If a warning fix is complex (requires architectural change), defer it and note in memory.
   - Skip condition: If user decides to defer all warnings, skip to Step 4.

4. **Review Fixes**
   - Input: Full diff from Steps 2-3
   - Task: `playbooks/tasks/engineering/review-code.md`
   - Output: Scored review focused on: fix correctness, no regressions, no new vulnerabilities introduced by the fix
   - Gate: If score < 70 or new Critical findings, address and re-review.

5. **Update Memory**
   - Input: Security audit results and decisions
   - Task: `playbooks/tasks/meta/update-memory.md`
   - Output: Updated memory with:
     - Security architecture decisions (e.g., "sessions stored in httpOnly cookies, not localStorage")
     - Deferred findings that need future attention
     - Any patterns established (e.g., "all webhook handlers must verify signatures")
   - Constraint: Record decisions and deferred items. Do not record the full audit report in memory.

## Gaps & Recommendations
- Nit findings are not addressed in this workflow. They can be fixed opportunistically during normal development.
- For apps handling payments or sensitive data, consider running this workflow before every major release.
- If the audit score is below 50, consider pausing feature development until Critical findings are resolved.
- No automated security scanning (SAST/DAST) is integrated. If the project grows, consider adding `npm audit` or similar to CI/CD.
