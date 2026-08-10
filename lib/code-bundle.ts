import type { CodeBundleV1 } from "./types";

const encoder = new TextEncoder();
const RAW_LIMIT = 48 * 1024;
const TOTAL_LIMIT = 32 * 1024;
const FILE_LIMITS = { "index.html": 12 * 1024, "styles.css": 12 * 1024, "app.js": 16 * 1024 } as const;
const META_MARKER = "<<<ATOM_META>>>";
const HTML_MARKER = "<<<ATOM_FILE:index.html>>>";
const CSS_MARKER = "<<<ATOM_FILE:styles.css>>>";
const JS_MARKER = "<<<ATOM_FILE:app.js>>>";
const END_MARKER = "<<<ATOM_END>>>";
const MARKERS = [META_MARKER, HTML_MARKER, CSS_MARKER, JS_MARKER, END_MARKER] as const;

export type CodeBundleErrorCode =
  | "INVALID_CODE_BUNDLE"
  | "BUNDLE_TOO_LARGE"
  | "DISALLOWED_HTML"
  | "DISALLOWED_CSS"
  | "DISALLOWED_JAVASCRIPT";

export class CodeBundleError extends Error {
  constructor(readonly code: CodeBundleErrorCode, readonly path = "") {
    super(path ? `${code}:${path}` : code);
    this.name = "CodeBundleError";
  }
}

function bytes(value: string) {
  return encoder.encode(value).byteLength;
}

function codePoints(value: string) {
  return Array.from(value).length;
}

function exactObject(value: unknown, keys: string[], path: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new CodeBundleError("INVALID_CODE_BUNDLE", path);
  const record = value as Record<string, unknown>;
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", path);
  }
  return record;
}

function boundedText(value: unknown, min: number, max: number, path: string) {
  if (typeof value !== "string" || codePoints(value) < min || codePoints(value) > max || value.includes("\u0000") || value.includes("\u2028") || value.includes("\u2029")) {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", path);
  }
  return value;
}

function assertFileText(value: unknown, name: keyof typeof FILE_LIMITS) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\u0000") || value.includes("\u2028") || value.includes("\u2029") || value.includes("\r")) {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", `files.${name}`);
  }
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if ((point < 32 && point !== 9 && point !== 10) || point === 127) {
      throw new CodeBundleError("INVALID_CODE_BUNDLE", `files.${name}`);
    }
  }
  if (bytes(value) > FILE_LIMITS[name]) throw new CodeBundleError("BUNDLE_TOO_LARGE", `files.${name}`);
  return value;
}

function validateHtml(html: string) {
  if (/<\s*\/?\s*(?:html|head|script|style|link|meta|base|iframe|object|embed|svg|math)\b/iu.test(html)) {
    throw new CodeBundleError("DISALLOWED_HTML", "files.index.html.tag");
  }
  if (/\son[a-z][\w:-]*\s*=/iu.test(html)) throw new CodeBundleError("DISALLOWED_HTML", "files.index.html.inline-handler");
  const attribute = /\s(href|src|action)\s*=\s*(?:(["'])(.*?)\2|([^\s>]+))/giu;
  for (const match of html.matchAll(attribute)) {
    const value = (match[3] ?? match[4] ?? "").trim();
    if (!value.startsWith("#")) throw new CodeBundleError("DISALLOWED_HTML", `files.index.html.${match[1].toLowerCase()}`);
  }
  if (/\b(?:srcdoc|formaction|xlink:href)\s*=/iu.test(html)) throw new CodeBundleError("DISALLOWED_HTML", "files.index.html.attribute");
}

function validateCss(css: string) {
  const rules: Array<[RegExp, string]> = [
    [/@import\b/iu, "import"],
    [/url\s*\(/iu, "url"],
    [/expression\s*\(/iu, "expression"],
    [/behavior\s*:/iu, "behavior"],
    [/-moz-binding/iu, "moz-binding"],
    [/<\/style/iu, "raw-text"],
  ];
  for (const [pattern, path] of rules) if (pattern.test(css)) throw new CodeBundleError("DISALLOWED_CSS", `files.styles.css.${path}`);
}

function validateJavaScript(javascript: string) {
  const rules: Array<[RegExp, string]> = [
    [/(?:^|[^\w$])import\s*(?:\(|[\s{"'*])/mu, "import"],
    [/(?:^|[^\w$])export\s+(?:default|const|let|var|function|class|\{)/mu, "export"],
    [/\beval\s*\(/u, "eval"],
    [/\bnew\s+Function\b/u, "function-constructor"],
    [/\bfetch\s*\(/u, "fetch"],
    [/\bXMLHttpRequest\b/u, "xhr"],
    [/\bWebSocket\b/u, "websocket"],
    [/\bEventSource\b/u, "event-source"],
    [/\bsendBeacon\b/u, "beacon"],
    [/\b(?:Shared|Service)?Worker\b/u, "worker"],
    [/\bdocument\s*\.\s*cookie\b/u, "cookie"],
    [/\b(?:window\s*\.\s*)?(?:parent|top|opener)\s*(?:\.|\[)/u, "parent"],
    [/\bpostMessage\s*\(/u, "post-message"],
    [/\b(?:window\s*\.\s*)?location\s*(?:\.|\[|=(?!=))/u, "navigation"],
    [/\b(?:window\s*\.\s*)?open\s*\(/u, "navigation"],
    [/\bwhile\s*\(/u, "while"],
    [/\bdo\s*\{/u, "do-while"],
    [/\bfor\s*\(\s*;/u, "unbounded-for"],
    [/\brequestAnimationFrame\s*\(/u, "animation-frame"],
    [/<\/script/iu, "raw-text"],
  ];
  for (const [pattern, path] of rules) if (pattern.test(javascript)) throw new CodeBundleError("DISALLOWED_JAVASCRIPT", `files.app.js.${path}`);
  const storageCalls = /(?:window\s*\.\s*)?Atoms\s*\.\s*storage\s*\.\s*(?:get|set|delete|list|clear)\s*\(/gu;
  for (const match of javascript.matchAll(storageCalls)) {
    const prefix = javascript.slice(Math.max(0, (match.index ?? 0) - 16), match.index);
    if (!/await\s*$/u.test(prefix)) throw new CodeBundleError("INVALID_CODE_BUNDLE", "capabilities.storage.await");
  }
}

export function validateCodeBundle(value: unknown): CodeBundleV1 {
  const root = exactObject(value, ["schemaVersion", "kind", "title", "summary", "entry", "files", "capabilities"], "$");
  if (root.schemaVersion !== 1 || root.kind !== "code_bundle" || root.entry !== "index.html") {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", "schemaVersion/kind/entry");
  }
  const title = boundedText(root.title, 1, 60, "title");
  const summary = boundedText(root.summary, 1, 180, "summary");
  const fileRecord = exactObject(root.files, ["index.html", "styles.css", "app.js"], "files");
  const html = assertFileText(fileRecord["index.html"], "index.html");
  const css = assertFileText(fileRecord["styles.css"], "styles.css");
  const javascript = assertFileText(fileRecord["app.js"], "app.js");
  if (bytes(html) + bytes(css) + bytes(javascript) > TOTAL_LIMIT) throw new CodeBundleError("BUNDLE_TOO_LARGE", "files");
  const capabilities = exactObject(root.capabilities, ["storage"], "capabilities");
  if (typeof capabilities.storage !== "boolean") throw new CodeBundleError("INVALID_CODE_BUNDLE", "capabilities.storage");
  if (/\bAtoms(?:\.storage)?\b/u.test(html) || /\bAtoms(?:\.storage)?\b/u.test(css)) {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", "capabilities.storage.location");
  }
  const storageCall = /(?:window\s*\.\s*)?Atoms\s*\.\s*storage\s*\.\s*(?:get|set|delete|list|clear)\s*\(/u.test(javascript);
  const anyAtoms = /\bAtoms\b/u.test(javascript);
  if (capabilities.storage !== storageCall || (!capabilities.storage && anyAtoms)) {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", "capabilities.storage.consistency");
  }
  validateHtml(html);
  validateCss(css);
  validateJavaScript(javascript);
  return {
    schemaVersion: 1,
    kind: "code_bundle",
    title,
    summary,
    entry: "index.html",
    files: { "index.html": html, "styles.css": css, "app.js": javascript },
    capabilities: { storage: capabilities.storage },
  };
}

export function parseCodeBundle(rawValue: unknown): CodeBundleV1 {
  let raw = rawValue;
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "response" in raw) raw = (raw as { response?: unknown }).response;
  if (typeof raw !== "string") throw new CodeBundleError("INVALID_CODE_BUNDLE", "raw");
  if (bytes(raw) > RAW_LIMIT) throw new CodeBundleError("BUNDLE_TOO_LARGE", "raw");
  if (raw.includes("\u0000") || raw.includes("\u2028") || raw.includes("\u2029")) throw new CodeBundleError("INVALID_CODE_BUNDLE", "raw.control");
  const normalized = raw.replace(/\r\n/g, "\n");
  if (/\r/u.test(normalized)) throw new CodeBundleError("INVALID_CODE_BUNDLE", "raw.cr");
  const lines = normalized.split("\n");
  const positions = MARKERS.map((marker) => lines.reduce<number[]>((found, line, index) => line === marker ? [...found, index] : found, []));
  if (positions.some((items) => items.length !== 1)) throw new CodeBundleError("INVALID_CODE_BUNDLE", "markers.unique");
  const indexes = positions.map((items) => items[0]);
  if (indexes.some((value, index) => index > 0 && value <= indexes[index - 1])) throw new CodeBundleError("INVALID_CODE_BUNDLE", "markers.order");
  if (lines.slice(0, indexes[0]).some((line) => line.trim()) || lines.slice(indexes[4] + 1).some((line) => line.trim())) {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", "markers.extraneous");
  }
  const section = (start: number, end: number) => lines.slice(start + 1, end).join("\n");
  const metaText = section(indexes[0], indexes[1]).trim();
  const html = section(indexes[1], indexes[2]);
  const css = section(indexes[2], indexes[3]);
  const javascript = section(indexes[3], indexes[4]);
  if ([metaText, html, css, javascript].some((part) => part.includes("<<<ATOM_"))) {
    throw new CodeBundleError("INVALID_CODE_BUNDLE", "markers.body");
  }
  let meta: unknown;
  try { meta = JSON.parse(metaText); } catch { throw new CodeBundleError("INVALID_CODE_BUNDLE", "meta.json"); }
  const metaRecord = exactObject(meta, ["schemaVersion", "kind", "title", "summary", "entry", "capabilities"], "meta");
  return validateCodeBundle({ ...metaRecord, files: { "index.html": html, "styles.css": css, "app.js": javascript } });
}

export function serializeCodeBundle(bundle: CodeBundleV1) {
  const validated = validateCodeBundle(bundle);
  const { files, ...meta } = validated;
  return [
    META_MARKER,
    JSON.stringify(meta),
    HTML_MARKER,
    files["index.html"],
    CSS_MARKER,
    files["styles.css"],
    JS_MARKER,
    files["app.js"],
    END_MARKER,
  ].join("\n");
}

const INITIAL_VALUE_PATTERNS = [
  /初始(?:值)?\s*[:：=]?\s*(-?\d+)/giu,
  /(?:start|starting)\s+at\s+(-?\d+)/giu,
] as const;
const NEGATION = /不要|无需|禁止|不需要|without|\bno\b|exclude/iu;

function positiveMatch(text: string, pattern: RegExp) {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const prefix = Array.from(text.slice(0, match.index ?? 0)).slice(-12).join("");
    if (!NEGATION.test(prefix)) return true;
  }
  return false;
}

export function parseCounterIntent(prompt: string) {
  if (Array.from(prompt).length > 2000) return null;
  const normalized = prompt.toLowerCase().replace(/\s+/gu, " ").trim();
  const initialValues: number[] = [];
  let actionText = normalized;
  for (const pattern of INITIAL_VALUE_PATTERNS) {
    pattern.lastIndex = 0;
    for (const match of normalized.matchAll(pattern)) initialValues.push(Number(match[1]));
    actionText = actionText.replace(pattern, " ");
  }
  if (initialValues.some((value) => !Number.isInteger(value) || value < -9999 || value > 9999)) return null;
  if (new Set(initialValues).size > 1) return null;
  if (/todo|待办|任务|看板|landing|落地页|计算器/iu.test(normalized)) return null;
  const subject = positiveMatch(normalized, /计数器|数字计数|counter|step counter|stepper/giu);
  const increment = positiveMatch(actionText, /增加|递增|\+1|increment|increase|加/giu);
  const decrement = positiveMatch(actionText, /减少|递减|-1|decrement|decrease|减/giu);
  const reset = positiveMatch(actionText, /重置|清零|归零|reset/giu);
  if (!subject || !increment || !decrement || !reset) return null;
  const titleMatch = prompt.match(/标题\s*[:：]\s*([^\n，。;；]{1,40})/u);
  const title = titleMatch?.[1]?.trim() || "交互计数器";
  return {
    title,
    initialValue: initialValues[0] ?? 0,
    persistence: /刷新|保存|持久|记住|restore|persist|save/iu.test(normalized),
  };
}

export function compileCounterBundle(prompt: string): CodeBundleV1 | null {
  const intent = parseCounterIntent(prompt);
  if (!intent) return null;
  const title = intent.title.replace(/[<>]/gu, "");
  const html = `<main class="counter-card" aria-labelledby="counter-title"><span class="eyebrow">INTERACTIVE APP</span><h1 id="counter-title">${title}</h1><output id="counter-value" aria-live="polite">${intent.initialValue}</output><div class="counter-actions"><button id="decrement" type="button" aria-label="减少 1">−1</button><button id="reset" type="button">重置</button><button id="increment" type="button" aria-label="增加 1">+1</button></div><p id="save-status">${intent.persistence ? "更改会自动保存" : "当前会话状态"}</p></main>`;
  const css = `:root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f4f2ff;color:#18152b}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at top,#ded8ff,transparent 48%),#f7f7fb}.counter-card{width:min(100%,440px);padding:38px;border:1px solid #ded9f6;border-radius:28px;background:rgba(255,255,255,.94);box-shadow:0 24px 70px rgba(67,52,140,.18);text-align:center}.eyebrow{font-size:12px;letter-spacing:.18em;color:#6e63a8;font-weight:800}h1{margin:12px 0 24px;font-size:28px}output{display:block;font-size:84px;line-height:1;font-weight:800;color:#635bff;font-variant-numeric:tabular-nums}.counter-actions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:30px}button{min-height:48px;border:0;border-radius:14px;background:#ece9ff;color:#393064;font:inherit;font-weight:750;cursor:pointer}button:last-child{background:#635bff;color:white}button:focus-visible{outline:3px solid #9d95ff;outline-offset:2px}#save-status{margin:18px 0 0;color:#77718d;font-size:13px}@media(max-width:420px){.counter-card{padding:28px 20px;border-radius:22px}output{font-size:68px}}`;
  const storageLines = intent.persistence
    ? [`const saved=await window.Atoms.storage.get("counter.value");`, `if(Number.isInteger(saved)){value=saved;render();}`, `const persist=async()=>{await window.Atoms.storage.set("counter.value",value);};`]
    : [`const persist=async()=>{};`];
  const javascript = `(async()=>{let value=${intent.initialValue};const initial=${intent.initialValue};const output=document.getElementById("counter-value");const render=()=>{output.textContent=String(value);};${storageLines.join("")}document.getElementById("increment").addEventListener("click",async()=>{value+=1;render();await persist();});document.getElementById("decrement").addEventListener("click",async()=>{value-=1;render();await persist();});document.getElementById("reset").addEventListener("click",async()=>{value=initial;render();await persist();});render();})()`;
  return validateCodeBundle({
    schemaVersion: 1,
    kind: "code_bundle",
    title,
    summary: "可增加、减少和重置的交互计数器。",
    entry: "index.html",
    files: { "index.html": html, "styles.css": css, "app.js": javascript },
    capabilities: { storage: intent.persistence },
  });
}

function encodeBase64(value: string) {
  const data = encoder.encode(value);
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function createSandboxDocument(bundleValue: CodeBundleV1, channelToken: string) {
  const bundle = validateCodeBundle(bundleValue);
  if (!/^[A-Za-z0-9_-]{20,128}$/u.test(channelToken)) throw new CodeBundleError("INVALID_CODE_BUNDLE", "channelToken");
  const html = encodeBase64(bundle.files["index.html"]);
  const css = encodeBase64(bundle.files["styles.css"]);
  const javascript = encodeBase64(bundle.files["app.js"]);
  const token = JSON.stringify(channelToken);
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; font-src 'none'; media-src 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'"></head><body><script>(()=>{const channelToken=${token};const pending=new Map();const decode=(value)=>{const binary=atob(value);const bytes=Uint8Array.from(binary,(character)=>character.charCodeAt(0));return new TextDecoder().decode(bytes)};const request=(op,key,value)=>new Promise((resolve,reject)=>{const requestId=crypto.randomUUID();const message={type:"atoms:storage:request",channelToken,requestId,op};if(key!==undefined)message.key=key;if(value!==undefined)message.value=value;const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error("BRIDGE_TIMEOUT"))},5000);pending.set(requestId,{resolve,reject,timer,op});parent.postMessage(message,"*")});addEventListener("message",(event)=>{const data=event.data;if(event.source!==parent||!data||data.type!=="atoms:storage:response"||data.channelToken!==channelToken||typeof data.requestId!=="string")return;const item=pending.get(data.requestId);if(!item)return;clearTimeout(item.timer);pending.delete(data.requestId);if(!data.ok){item.reject(new Error(data.error&&data.error.code||"PERSISTENCE_ERROR"));return}if(item.op==="get")item.resolve(data.data.found?data.data.value:undefined);else if(item.op==="list")item.resolve(data.data.items);else item.resolve(data.data)});window.Atoms=Object.freeze({storage:Object.freeze({get:(key)=>request("get",key),set:(key,value)=>request("set",key,value),delete:(key)=>request("delete",key),list:()=>request("list"),clear:()=>request("clear")})});let timerCount=0;const nativeTimeout=setTimeout;const nativeInterval=setInterval;window.setTimeout=(fn,delay,...args)=>{if(timerCount>=25)throw new Error("TIMER_LIMIT");timerCount+=1;return nativeTimeout(()=>{timerCount-=1;fn(...args)},Math.max(16,Number(delay)||16))};window.setInterval=(fn,delay,...args)=>{if(timerCount>=25)throw new Error("TIMER_LIMIT");timerCount+=1;return nativeInterval(fn,Math.max(16,Number(delay)||16),...args)};const report=(code,message)=>parent.postMessage({type:"atoms:runtime:error",channelToken,code,message:String(message||"").slice(0,180)},"*");addEventListener("error",(event)=>report("RUNTIME_ERROR",event.message));addEventListener("unhandledrejection",()=>report("UNHANDLED_REJECTION","应用运行失败"));const style=document.createElement("style");style.textContent=decode(${JSON.stringify(css)});document.head.appendChild(style);document.body.innerHTML=decode(${JSON.stringify(html)});const script=document.createElement("script");script.textContent=decode(${JSON.stringify(javascript)});document.body.appendChild(script)})()</script></body></html>`;
}
