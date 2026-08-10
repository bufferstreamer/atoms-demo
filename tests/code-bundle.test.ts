import test from "node:test";
import assert from "node:assert/strict";
import {
  CodeBundleError,
  compileCounterBundle,
  createSandboxDocument,
  parseCodeBundle,
  serializeCodeBundle,
  validateCodeBundle,
} from "../lib/code-bundle";
import type { CodeBundleV1 } from "../lib/types";

const safeBundle: CodeBundleV1 = {
  schemaVersion: 1,
  kind: "code_bundle",
  title: "交互卡片",
  summary: "点击按钮更新页面状态。",
  entry: "index.html",
  files: {
    "index.html": '<main><h1>欢迎</h1><button id="go">开始</button><p id="status"></p></main>',
    "styles.css": "body{font-family:system-ui}button{min-height:44px}",
    "app.js": 'document.getElementById("go").addEventListener("click",()=>{document.getElementById("status").textContent="完成";});',
  },
  capabilities: { storage: false },
};

test("round-trips the exact CodeBundle sentinel protocol", () => {
  const raw = serializeCodeBundle(safeBundle);
  assert.deepEqual(parseCodeBundle({ response: raw }), safeBundle);
  assert.throws(() => parseCodeBundle(`${raw}\nextra`), CodeBundleError);
  assert.throws(() => parseCodeBundle(raw.replace("<<<ATOM_END>>>", "<<<ATOM_FILE:app.js>>>\n<<<ATOM_END>>>")), CodeBundleError);
});

test("rejects network, navigation, parent access and raw-text escapes", () => {
  const scripts = [
    'fetch("/api")',
    'parent.postMessage({},"*")',
    'window.location="https://example.com"',
    'new WebSocket("wss://example.com")',
    '</script>',
  ];
  for (const javascript of scripts) {
    assert.throws(() => validateCodeBundle({ ...safeBundle, files: { ...safeBundle.files, "app.js": javascript } }), CodeBundleError);
  }
  assert.throws(() => validateCodeBundle({ ...safeBundle, files: { ...safeBundle.files, "index.html": "<script>alert(1)</script>" } }), CodeBundleError);
  assert.throws(() => validateCodeBundle({ ...safeBundle, files: { ...safeBundle.files, "styles.css": "@import 'evil.css';" } }), CodeBundleError);
  assert.doesNotThrow(() => validateCodeBundle({ ...safeBundle, files: { ...safeBundle.files, "app.js": 'let open=false;const parentLabel="parent";document.getElementById("go").addEventListener("click",()=>{open=!open;document.body.dataset.state=open?parentLabel:"closed";});' } }));
});

test("requires storage capability to match Atoms.storage usage", () => {
  const storageScript = 'window.Atoms.storage.set("value",1);';
  assert.throws(() => validateCodeBundle({ ...safeBundle, files: { ...safeBundle.files, "app.js": storageScript } }), CodeBundleError);
  assert.doesNotThrow(() => validateCodeBundle({ ...safeBundle, files: { ...safeBundle.files, "app.js": storageScript }, capabilities: { storage: true } }));
});

test("builds srcdoc without interpolating generated raw-text", () => {
  const document = createSandboxDocument(safeBundle, "abcdefghijklmnopqrstuvwxyz012345");
  assert.match(document, /Content-Security-Policy/);
  assert.match(document, /connect-src 'none'/);
  assert.doesNotMatch(document, /<main><h1>欢迎/);
  assert.doesNotMatch(document, /document\.getElementById\("go"\)/);
});

test("counter fallback ignores negative initial values as decrement intent", () => {
  assert.equal(compileCounterBundle("计数器，初始值 -1，支持增加和重置"), null);
  const bundle = compileCounterBundle("计数器，初始值 -1，支持增加、减少、重置");
  assert.ok(bundle);
  assert.match(bundle.files["app.js"], /let value=-1/);
});
