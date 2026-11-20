---
status: hosted_verified_requested_dns_pending
date: 2026-11-12
---

# Coolify deployment

The workbench is deployed at https://juno.54.157.57.51.sslip.io with valid HTTPS. Jack supplied a replacement Coolify credential; it authenticates successfully and is saved for future sessions. No credential is in the repository or evidence export.

A dedicated Juno project contains the Dockerfile application, pinned to the verified implementation from the existing PR branch. A named `/data` volume, consistent container name, 2 GB memory limit, 1.5 CPU limit and Chromium shared-memory/init options preserve the single-writer deployment boundary. The existing image health check uses Node and `/healthz`; no extra curl dependency was added.

Live GitHub research returned five checked TypeScript projects and recalled saved preferences/context. Explicit project/recipe memory, refresh, protected workspace recovery, source-backed receipts and owned-fixture semantic Chromium execution passed HTTP checks. A second Coolify deployment retained all task/memory, browser bindings, receipts, verified effects and account recovery. Replaying original research/browser IDs did not repeat their operations. See [verification](261112-p1y-VERIFICATION.md).

The requested hostname is configured in Coolify but still resolves to Porkbun parking. No DNS provider is connected and no Porkbun credential is available. Jack has the precise A-record change; DNS and the requested hostname's HTTPS remain pending. The temporary hosted URL is usable now.

Coolify's cached application status remains `exited:unhealthy`, which disagrees with successful HTTPS/API checks and completed deployments. The named volume and detected image health check are confirmed, but host Docker health has not been independently inspected. This monitoring discrepancy is recorded rather than silently treated as a passing health assertion.

The earlier 52 unit tests and 19 browser/API integration tests remain the implementation evidence; this follow-up changes deployment documentation only. UI testing, Jack's trial, the pending feedback-confirmation fix, and all unfinished roadmap phases retain their prior status. The PR is not merged; no other Coolify application was changed.
