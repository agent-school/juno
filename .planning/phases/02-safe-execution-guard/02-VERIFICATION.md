# Phase 2 verification

SAFE-01: every guarded action is classified before execution; unrecognized mutations default destructive.

SAFE-02: confirmation is a trusted-control capability, one-shot, expiring, and bound by an in-memory HMAC to method/reference/input/page. Reuse, changed input/site and expired grants are blocked before action. Demonstration-based authority is deferred to Phase 5; confirmation is supported now.

SAFE-03: read-only mode rejects even host-reviewed benign mutations. Real fixture exploration/read plus injected instruction text produces no mutation.

SAFE-04: durable audit intent precedes each mutation; unavailable persistence blocks action. The real lab receipt contains five started/completed benign actions and no input values in its audit.

SAFE-05: page content is semantic data. Risk labels are not accepted on action references; host policies are copied and scoped to exact origin/path/method/reference. Unknown observed buttons never create executable operations.

SAFE-06: abort invalidates all grants/pending requests, closes the controlled page, and prevents subsequent work. Abort during awaited audit persistence prevents the mutation. Already committed effects remain subject to receipt inspection before retry.

Automated evidence: browser/lab typechecks; guard unit contracts; tests/e2e/guard.spec.ts; packages/lab/tests/e2e/lab.spec.ts. Full suite: 91 unit tests, 20 standard browser/API tests, plus two explicit CDP tracer tests. Hosted UI follow-up remains pending until deployment.
