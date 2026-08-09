# Raw Sites Platform Capability Snapshot

采集日期：2026-08-09。以下为本地 Sites Building 官方参考文档的逐字摘录，原始文件分别为 `references/persistence-and-storage.md` 与 `references/authentication.md`。

```text
Use D1 for persistent structured state that needs to survive page reloads or sessions, especially when it represents product data rather than transient UI state.

Use browser storage only for device-local, non-authoritative UI preferences such as dismissed banners, theme choice, or temporary draft state. Do not use localStorage, sessionStorage, or in-memory state as the source of truth for user data that the product is expected to remember.

Set the needed logical bindings in .openai/hosting.json: use d1, usually DB, when D1 is required; use r2 when R2 is required; leave unused bindings null.

For D1-backed state: put schema definitions in db/schema.ts; keep D1 access behind a small helper; use prepared statements on the raw D1 binding for application queries and runtime initialization.
```

```text
Signed-in visitors receive both oai-authenticated-user-id and oai-authenticated-user-email. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites.

Keep authorization decisions in server-side code for every site.

Do not add SIWC just because a site is public or published. Add it only when the requested product has a concrete sign-in-gated surface.
```
