# Raw Code and Configuration Snapshot

采集日期：2026-08-09。以下内容逐字复制自当前仓库，用于固定开发前基线。

`app/page.tsx`

```tsx
import type { Metadata } from "next";
import { SkeletonPreview } from "./_sites-preview/SkeletonPreview";

export const metadata: Metadata = {
  title: "Your site is taking shape",
  description:
    "Your first version will appear here automatically when it’s ready.",
  other: {
    "codex-preview": "development",
  },
};

export default function Home() {
  return <SkeletonPreview />;
}
```

`db/schema.ts`

```ts
// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
export {};
```

`.openai/hosting.json`

```json
{
  "d1": null,
  "r2": null
}
```

`package.json` dependency baseline

```json
{
  "engines": { "node": ">=22.13.0" },
  "dependencies": {
    "drizzle-orm": "0.45.2",
    "react": "19.2.6",
    "react-dom": "19.2.6"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "vinext": "1.0.0-beta.2",
    "vite": "8.0.13",
    "wrangler": "4.92.0"
  }
}
```
