# Raw Browser Sandbox and Hosting Facts Snapshot

采集日期：2026-08-10。以下只记录公开标准/平台页面直接支持的事实，不混入项目 bridge、namespace、代码包大小或 watchdog 设计。

## HTML iframe sandbox

来源：WHATWG HTML Standard，`https://html.spec.whatwg.org/multipage/iframe-embed-object.html`，采集定位约 L372-L396。

- `sandbox` 属性会对 iframe 内容启用额外限制；只有显式 token 会重新开放对应能力。
- 标准列出的 token 包括 `allow-scripts`、`allow-same-origin`、`allow-forms`、`allow-popups`、`allow-downloads` 与多种 top-navigation token。
- 未启用 `allow-same-origin` 时，内容处于 unique opaque origin。
- 同时启用 `allow-scripts` 与 `allow-same-origin` 且内容同源，会形成移除 sandbox 属性后逃逸的风险。
- 标准建议潜在恶意内容不要由与宿主页相同的服务器直接提供；使用专用不同域可缩小绕过 iframe 直接访问时的影响。

## Content Security Policy

来源：MDN CSP `default-src` 文档，`https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/default-src`，采集日期 2026-08-10。

- `default-src` 是未单独声明的 fetch directives 的 fallback。
- 文档列出的 fallback 范围包括 `connect-src`、`img-src`、`script-src`、`style-src`、`font-src`、`media-src`、`object-src`、`frame-src` 与 `worker-src`；该事实本身不等于导航、form action 或消息授权策略。

## parent/guest message transport

来源：MDN `Window.postMessage()`，`https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage`，采集定位约 L207-L270。

- message 使用 structured clone 传输。
- `targetOrigin` 精确匹配 scheme、hostname 和 port；已知接收方 origin 时不应使用 `"*"`。
- `data:` 等 opaque-origin 目标必须用 `"*"` 发送。
- 接收消息时必须校验 sender identity 的 `origin` 和可能的 `source`，并继续校验消息语法。

## Cloudflare Workers outer limits

来源：Cloudflare Workers limits，`https://developers.cloudflare.com/workers/platform/limits/`，页面最近更新 2026-07-05，采集日期 2026-08-10。

- Workers Free 公开上限包括 10 ms CPU、128 MB memory、50 subrequests/request 和 3 MB Worker size。
