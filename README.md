# Atomize — AI App Builder Demo

Atomize is a working agent-driven app generator inspired by the product flow of Atoms. Describe an app, watch four specialist agents turn the request into a structured AppSpec, then use the generated app in the live preview. Projects, runs, conversations, and immutable versions are persisted in D1.

## What you can test

- Start from a prompt or one of three example briefs.
- Watch the Emma → Bob → Iris → Alex generation workflow complete.
- Use the generated dashboard, tracker, or landing-page interactions.
- Refresh the page and recover the same workspace from D1.
- Continue modifying a generated app and switch between immutable versions.
- Open another browser session to verify anonymous workspace isolation.
- Trigger clear validation errors with unsupported or oversized requests.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000`.

## Verification

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
```

`pnpm test` runs a production build followed by the deterministic generator tests.

## Cloudflare deployment

The production Worker uses `wrangler.deploy.jsonc` and the `DB` D1 binding.

```bash
pnpm exec wrangler d1 execute atomize-demo-db --remote --file=drizzle/0000_ambitious_gargoyle.sql
pnpm deploy:cloudflare
```

## Architecture

- `app/workspace.tsx` contains the three-pane product experience and safe AppSpec renderer.
- `app/api/` exposes workspace, project, generation, and version activation routes.
- `lib/generator.ts` implements deterministic intent classification and AppSpec generation.
- `lib/store.ts` owns D1 schema initialization, persistence, isolation, limits, and version changes.
- `db/schema.ts` and `drizzle/` contain the deployable database contract.
- `tests/generator.test.ts` covers the generator and validation boundaries.

## Product boundaries

- This demo uses deterministic local generation rather than an external LLM, so it remains reliable and testable without API keys.
- Anonymous identity is cookie-based; it is suitable for the challenge demo, not a substitute for production authentication.
- Generated applications use a validated component/action schema rather than arbitrary code execution.
