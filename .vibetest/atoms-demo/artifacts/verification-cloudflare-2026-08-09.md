# Atomize Cloudflare Production Verification — 2026-08-09

## Deployment identity

- Application commit: `83c2997`
- URL: `https://atomize-ai-builder-demo.atomize-demo.workers.dev`
- Worker: `atomize-ai-builder-demo`
- Cloudflare version: `2802d500-e9f5-467b-a1fc-a9d118693243`
- D1: `atomize-demo-db` / `c533fda1-de8a-41f8-ae97-a498631b728e` / APAC
- Account: `517631523@qq.com's Account`

## Build and data evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Lint | PASS | `pnpm lint`, exit 0 |
| TypeScript | PASS | `pnpm exec tsc --noEmit`, exit 0 |
| Production build | PASS | Vinext 5/5 build stages completed |
| Generator tests | PASS | 5 passed, 0 failed |
| Wrangler dry run | PASS | 39 modules, 512.04 KiB; total upload 693.03 KiB / gzip 205.54 KiB |
| D1 migration | PASS | 15 queries; 23 rows read, 27 written; 7 application tables; 0.09 MB |
| D1 schema readback | PASS | projects/messages/runs/run_steps/versions/workspace_requests/rate_limits and expected indexes present |
| Worker publish | PASS | Worker uploaded, D1 `DB` binding present, public trigger created |

## Online browser evidence

- Production root rendered the three-pane Atomize workspace through the public URL.
- Generated “个人旅行计划看板”; Emma/Bob/Iris/Alex all completed and Version 1 rendered.
- “只看筹备中” changed visible cards from 3 to 2.
- “换成暖色并增加统计卡” produced Version 2 with coral theme and “本周增长”.
- Reload restored Version 2 and its fourth statistic from production D1.
- Selecting Version 1 removed the new statistic, proving immutable version switching.
- Production screenshot was visually inspected and matched the accepted desktop layout.

## Online API evidence

- `GET /` returned HTTP 200 from Cloudflare SIN.
- A fresh cookie session created a tracker project and refresh returned the same project ID.
- A second independent cookie session received HTTP 404 for the first session's project ID.
- No application credentials or external LLM keys are required.

## Residual risk

- Cloudflare Workers Free daily and CPU limits apply. The demo has application-level owner/global rate and capacity limits; exceeding Cloudflare's free quota will fail closed until reset.
- Artificial fault injection, duplicate concurrent completion, and stale-run recovery remain hardening coverage rather than production evidence.
