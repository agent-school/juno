---
phase: 01-browser-core
reviewed: 2026-08-25T23:28:49Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .gitignore
  - package.json
  - packages/browser/package.json
  - packages/browser/playwright.config.ts
  - packages/browser/src/actor.ts
  - packages/browser/src/errors.ts
  - packages/browser/src/index.ts
  - packages/browser/src/parse-yaml.ts
  - packages/browser/src/profile.ts
  - packages/browser/src/reader.ts
  - packages/browser/src/refs.ts
  - packages/browser/src/session.ts
  - packages/browser/src/snapshot-schema.ts
  - packages/browser/tests/e2e/acting.spec.ts
  - packages/browser/tests/e2e/failsafe.spec.ts
  - packages/browser/tests/e2e/navigation.spec.ts
  - packages/browser/tests/e2e/persistence.spec.ts
  - packages/browser/tests/e2e/profile-lock.spec.ts
  - packages/browser/tests/e2e/reading.spec.ts
  - packages/browser/tests/fixtures/server.ts
  - packages/browser/tests/unit/no-stealth-deps.test.ts
  - packages/browser/tests/unit/parse-yaml.test.ts
  - packages/browser/tests/unit/refs.test.ts
  - packages/browser/tsconfig.json
  - packages/browser/vitest.config.ts
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - vitest.config.ts
findings:
  critical: 3
  warning: 1
  info: 0
  total: 4
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-08-25T23:28:49Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Reviewed the browser-core package, its config, and its test coverage surface. The main problems are in the session/profile boundary: sensitive browser state is stored with weak filesystem protections, sensitive URLs are logged verbatim, and the code does not enforce its own “dedicated Juno profile only” safety contract.

## Narrative Findings (AI reviewer)

## Critical Issues

### BLOCKER CR-01: Persistent browser profile is created with default permissions

**File:** `packages/browser/src/profile.ts:20-27`
**Issue:** `resolveProfileDir()` creates the profile directory with `fs.mkdirSync(dir, { recursive: true })`, which uses the process umask. On common multi-user setups that yields a `0755` directory, exposing cookies, localStorage, and other authenticated browser state to other local users. That contradicts the package’s own “sensitive data at rest” requirement.
**Fix:** create and enforce owner-only permissions when the profile directory is created.

```ts
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
fs.chmodSync(dir, 0o700);
```

### BLOCKER CR-02: Full URLs, including embedded credentials and tokens, are written to logs

**Files:** `packages/browser/src/session.ts:147-152`, `packages/browser/src/reader.ts:36-38`
**Issue:** `goto()` logs `url.toString()` and `SemanticPageReader.read()` logs `page.url()`. For authenticated targets, those values can contain `user:pass@host`, OAuth codes, session-bearing query parameters, or other sensitive identifiers. This turns normal operation into credential/token leakage through logs.
**Fix:** log only a redacted form (for example origin + pathname, or pathname without search/userinfo) before emitting telemetry.

```ts
function redactUrl(raw: string): string {
  const url = new URL(raw);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = '';
  return `${url.origin}${url.pathname}`;
}

logger.info({ event: 'session.goto', url: redactUrl(url.toString()) }, 'navigated');
```

### BLOCKER CR-03: The “dedicated Juno profile only” rule is documented but never enforced

**Files:** `packages/browser/src/session.ts:57-64`, `packages/browser/src/session.ts:82-117`, `packages/browser/src/profile.ts:21-26`
**Issue:** The public API accepts arbitrary `profileDir` values and arbitrary `JUNO_PROFILE_DIR` overrides, then passes them straight to `launchPersistentContext()`. That means callers can accidentally point Juno at the user’s daily-driver Chrome profile or another application profile even though the code comments explicitly forbid it. This creates a real data-loss/corruption risk and undermines the package’s safety guarantees.
**Fix:** validate profile paths before launch. At minimum, reject known Chrome default-profile locations and require explicit opt-in for any directory outside Juno’s managed profile root.

```ts
function assertManagedProfileDir(profileDir: string): void {
  const resolved = path.resolve(profileDir);
  const managedRoot = path.join(os.homedir(), '.juno');
  if (!resolved.startsWith(`${managedRoot}${path.sep}`)) {
    throw new Error('profileDir must be a Juno-managed dedicated profile');
  }
}
```

## Warnings

### WARNING WR-01: `close()` clears internal state before the browser context is actually closed

**File:** `packages/browser/src/session.ts:156-164`
**Issue:** `close()` nulls `this.context` and `this._page` before awaiting `context.close()`. If `context.close()` throws, the object reports itself as closed even though Chromium may still be alive and still holding the profile lock. That makes retries and recovery logic incorrect.
**Fix:** only clear the fields after a successful close, or restore them in a `catch` path.

```ts
const context = this.context;
const page = this._page;
await context.close();
this.context = null;
this._page = null;
```

---

_Reviewed: 2026-08-25T23:28:49Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

## Resolution (2026-08-25, orchestrator)

All four findings fixed and verified (35/35 unit incl. 4 new security tests, 15/15 e2e, typecheck clean):

- **CR-01** ✓ `profile.ts`: `mkdirSync(..., { mode: 0o700 })` + `chmodSync(dir, 0o700)` — owner-only profile directory
- **CR-02** ✓ `session.ts` + `reader.ts`: `redactUrlForLog()` strips userinfo/query/hash before any log emission
- **CR-03** ✓ `profile.ts`: `assertDedicatedProfileDir()` rejects paths inside Chrome's "User Data" tree, enforced at both `resolveProfileDir()` and `BrowserSession.launch()` (explicit `profileDir` included); escape hatch `JUNO_ALLOW_UNMANAGED_PROFILE=1`. Scoped to daily-driver markers rather than managed-root-only because the test suite (and the API contract) legitimately uses temp/profile dirs outside ~/.juno.
- **WR-01** ✓ `session.ts close()`: state cleared only after `context.close()` succeeds

Fix commit: see `fix(review): enforce profile security...` on main.
