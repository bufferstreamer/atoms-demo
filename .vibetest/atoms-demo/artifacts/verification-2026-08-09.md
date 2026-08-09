# Atomize Demo Verification — 2026-08-09

## Version and environments

- Source commit: `c45afbcdeb6f844650de66936d84df277b47ef4f`
- Local: `http://localhost:3000`
- Production: `https://atomize-ai-builder.qwert012342026.chatgpt.site`
- Sites project/version/deployment: `appgprj_6a7840f921308191b84ce59a6a77d176` / version 1 / `appgdep_6a7842c73bc88191a2bce106c7044842`

## Automated verification

| Check | Result | Evidence |
| --- | --- | --- |
| ESLint | PASS | `pnpm lint`, exit 0 |
| TypeScript | PASS | `pnpm exec tsc --noEmit`, exit 0 |
| Production build | PASS | Vinext 5/5 build stages completed; all five routes discovered |
| Generator/validator tests | PASS | 5 passed, 0 failed |
| Package integrity | PASS | archive contains `dist/server/index.js`, hosting config, and D1 migration |
| Sites deployment | PASS | deployment status `succeeded`, version 1, exact commit above |
| Public access | PASS | Sites access policy revision 2 is `public` |

## Real browser verification on localhost

- Created a travel dashboard from a template; four agent stages completed and Version 1 rendered.
- Clicked “只看筹备中”; visible cards changed from 3 to 2.
- Continued with “换成暖色并增加统计卡”; Version 2 used coral and added a fourth statistic while retaining Version 1.
- Reloaded the page; the same project and Version 2 recovered from D1.
- Switched back to Version 1; the fourth statistic disappeared.
- Switched to the mobile preview; core input, agent flow, and preview remained accessible.
- Created a separate release tracker; added “准备演示视频” through the form and toggled an item complete.
- API verification used two independent cookie jars: the second session received 404 for the first session's project. Unsupported modification returned `422 UNSUPPORTED_CHANGE` without moving the successful version.

## Production verification boundary

- Sites reports the live URL, generated a production screenshot, and confirms deployment `succeeded` with public access.
- The local enterprise browsing gateway redirected automated navigation to `office-sec.alibaba-inc.com`; browser security policy correctly blocked continuing through that page. No bypass was attempted.
- Therefore production infrastructure and public policy are verified, while the complete interactive user journey is evidenced in the same committed build on localhost. A human outside this corporate gateway should run VT-009 once from the public URL.

## Residual gaps

- The challenge-critical workflow is implemented and verified. Artificial fault injection, concurrent duplicate requests, minute-limit exhaustion, and stale-run recovery remain hardening tests rather than demonstrated online cases.
- Anonymous cookie deletion can reset owner-level quotas; global D1 rate and project caps remain the demo-level fallback.
