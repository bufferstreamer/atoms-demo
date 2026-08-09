# CHG-006 Online Workers AI Evidence — 2026-08-09

## Deployment identity

- Application commit: `131e220` (schema implementation `f509f85`, frozen baseline `2600aea`)
- URL: `https://atomize-ai-builder-demo.atomize-demo.workers.dev`
- Worker version: `a1fae919-0b2d-477c-acec-a3787f577975`
- Bindings: `AI` / `DB`
- D1: `atomize-demo-db` / `c533fda1-de8a-41f8-ae97-a498631b728e` / APAC
- Rollback Worker version: `683d8674-a4cb-4986-8e42-b9a3c95130b7`

## VT-017 fixed-request evidence

- requestId: `vt017-chg006-final-1786275779`
- projectId: `d4d7d45e-1e40-45d1-9fd0-8835e645ad69`
- runId: `53b1dc4a-0fd6-4351-ac06-810bf035d942`
- versionId/currentVersionId: `dfc032e6-50d5-44bc-a6f4-a0b9a0d134a1`
- HTTP wall-clock: `6.667337s` (`<65s`: PASS)
- Model duration in API and D1: `6071ms` (`<55000ms`: PASS; values equal)
- D1 request/run status: `COMPLETED` / `COMPLETED`
- Generation event: `workers_ai` / `@cf/meta/llama-3.1-8b-instruct-fast` / `SUCCESS` / `failure_code=null`
- Refresh with the same Cookie restored the same project, version, model event and model-produced four role summaries.

## Browser evidence

- Public root loaded with title `Atomize — AI App Builder` and displayed `Workers AI + D1 已启用`.
- During generation the original 217-character prompt remained in the composer and the button changed to disabled `构建中`.
- The final workspace displayed `真实模型生成 · 4972ms` and `AI · LLAMA`.
- Clicking the model-generated `Reserve Orientation Slot` action displayed `✓ Orientation slot reserved successfully!`.
- Reload restored the same model-generated project, preview and `AI · LLAMA` source badge.
- A separate complex filter/form prompt returned `deterministic/FALLBACK/INVALID_APP_SPEC` in about 4 seconds, proving the strict validator and honest fallback path remain active.

## Local verification

- `pnpm lint`: PASS
- `pnpm exec tsc --noEmit`: PASS
- `pnpm test`: PASS, 10/10
- `pnpm build`: PASS
- Frozen design schema vs exported runtime schema JSON equality: `SCHEMA_MATCH=true`

## Conclusion

CHG-006 has a same-deployment, same-requestId/runId online proof for real Workers AI generation, D1 atomic persistence, refresh recovery and browser interaction. The 55/65-second budgets passed with substantial margin. Model outputs that fail semantic AppSpec validation continue to use the explicit deterministic fallback and are not recorded as model success.
