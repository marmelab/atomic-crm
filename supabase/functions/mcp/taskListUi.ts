// Task-list MCP App. Everything lives in this single file: template,
// styles, and glue. Plain vanilla JS — no external scripts, because host
// CSPs (e.g. Claude.ai) only allow 'self' + 'unsafe-inline' for scripts.
// Syntax highlighted if the IDE has the es6-string-html extension enabled.

export const TASK_LIST_UI_URI = "ui://atomic-crm/task-list";

export const TASK_LIST_HTML = /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'">
<title>Tasks</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; font-size:14px; background:transparent; color:#111; }
  body { padding:8px 4px; overflow:hidden; }
  .task { display:flex; align-items:flex-start; gap:10px; padding:10px 12px; border:1px solid rgba(128,128,128,0.25); border-radius:8px; margin-bottom:8px; background:rgba(0,0,0,0.02); transition:opacity 0.2s ease; }
  .task.done { opacity:0.45; }
  .task.updating .check { opacity:0.5; cursor:wait; }
  .check { width:20px; height:20px; min-width:20px; margin-top:1px; border:1.5px solid #888; border-radius:999px; background:transparent; cursor:pointer; padding:0; display:inline-flex; align-items:center; justify-content:center; color:transparent; font-size:12px; line-height:1; transition:background 0.15s, border-color 0.15s, color 0.15s; }
  .check:hover:not(:disabled) { border-color:#2563eb; background:rgba(37,99,235,0.12); }
  .check.checked { background:#10b981; border-color:#10b981; color:white; }
  .check.checked::after { content:"\\2713"; }
  .task-content { flex:1; min-width:0; }
  .task-text { font-weight:500; white-space:pre-wrap; word-break:break-word; }
  .task-meta { margin-top:3px; font-size:12px; color:#6b7280; display:flex; flex-wrap:wrap; gap:10px; }
  .pill { display:inline-block; padding:1px 6px; border-radius:4px; background:rgba(128,128,128,0.22); color:#374151; }
  .contact { color:#2563eb; font-weight:500; }
  a.contact { text-decoration:none; }
  a.contact:hover { text-decoration:underline; }
  .empty { text-align:center; color:#6b7280; padding:16px 8px; }
  .error { padding:8px 10px; border-radius:6px; border:1px solid rgba(220,38,38,0.4); background:rgba(220,38,38,0.08); color:#dc2626; font-size:12px; margin-bottom:8px; }
  html.dark body { color:#f5f5f5; }
  html.dark .task { background:rgba(255,255,255,0.04); }
  html.dark .task-meta { color:#b8b8b8; }
  html.dark .pill { color:#e5e5e5; }
  html.dark .contact { color:#93c5fd; }
  html.dark .empty { color:#b8b8b8; }
  html.dark .error { color:#f87171; }
  html.dark .check:hover:not(:disabled) { border-color:#60a5fa; background:rgba(96,165,250,0.18); }
  @media (prefers-color-scheme: dark) {
    html:not(.light) body { color:#f5f5f5; }
    html:not(.light) .task { background:rgba(255,255,255,0.04); }
    html:not(.light) .task-meta { color:#b8b8b8; }
    html:not(.light) .pill { color:#e5e5e5; }
    html:not(.light) .contact { color:#93c5fd; }
    html:not(.light) .empty { color:#b8b8b8; }
    html:not(.light) .error { color:#f87171; }
    html:not(.light) .check:hover:not(:disabled) { border-color:#60a5fa; background:rgba(96,165,250,0.18); }
  }
</style>
</head>
<body>
<div id="app"></div>
<script>
(() => {
  // Injected server-side; empty string when not configured, in which case
  // contact names render as plain text instead of links.
  const CRM_BASE_URL = '__CRM_BASE_URL__';

  // -------- JSON-RPC plumbing over postMessage --------
  const pending = new Map();
  const RPC_TIMEOUT_MS = 10000;
  let nextId = 1;

  const post = (msg) => window.parent.postMessage(msg, '*');

  const rpc = (method, params) => new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error("RPC timeout after " + RPC_TIMEOUT_MS + "ms: " + method));
    }, RPC_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    post({ jsonrpc: '2.0', id, method, params });
  });

  // -------- State --------
  let tasks = [];
  let errorMsg = '';
  let ready = false;
  const updating = Object.create(null);

  // -------- Rendering (vanilla DOM) --------
  const root = document.getElementById('app');

  const contactUrl = (id) =>
    CRM_BASE_URL ? CRM_BASE_URL + '/#/contacts/' + id + '/show' : '';

  const formatDate = (value) => {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const el = (tag, attrs, children) => {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    if (children) {
      for (const c of children) {
        if (c == null || c === false) continue;
        node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      }
    }
    return node;
  };

  const render = () => {
    root.replaceChildren();

    if (errorMsg) {
      root.appendChild(el('div', { class: 'error', text: errorMsg }));
    }

    if (!ready) {
      root.appendChild(el('div', { class: 'empty', text: 'Waiting for data\u2026' }));
      return;
    }

    if (!tasks.length) {
      root.appendChild(el('div', { class: 'empty', text: 'No pending tasks.' }));
      return;
    }

    for (const t of tasks) {
      const done = !!t.done_date;
      const upd = !!updating[t.id];

      const classes = ['task'];
      if (done) classes.push('done');
      if (upd) classes.push('updating');

      const meta = [];
      if (t.contact_name && t.contact_id && contactUrl(t.contact_id)) {
        meta.push(el('a', {
          class: 'contact',
          href: contactUrl(t.contact_id),
          target: '_blank',
          rel: 'noopener noreferrer',
          text: t.contact_name,
        }));
      } else if (t.contact_name) {
        meta.push(el('span', { class: 'contact', text: t.contact_name }));
      }
      if (t.type) meta.push(el('span', { class: 'pill', text: t.type }));
      if (t.due_date) meta.push(el('span', { text: 'Due ' + formatDate(t.due_date) }));

      const checkClasses = ['check'];
      if (done) checkClasses.push('checked');

      const card = el('div', { class: classes.join(' ') }, [
        el('button', {
          type: 'button',
          class: checkClasses.join(' '),
          'aria-label': done ? 'Already done' : 'Mark as done',
          disabled: done,
          onclick: () => complete(t),
        }),
        el('div', { class: 'task-content' }, [
          el('div', { class: 'task-text', text: t.text || '(no description)' }),
          meta.length ? el('div', { class: 'task-meta' }, meta) : null,
        ]),
      ]);

      root.appendChild(card);
    }
  };

  // -------- Actions --------
  const complete = (t) => {
    if (t.done_date || updating[t.id]) return;
    updating[t.id] = true;
    render();
    rpc('tools/call', { name: 'complete_task', arguments: { id: t.id } })
      .then((result) => {
        updating[t.id] = false;
        if (result && result.isError) {
          errorMsg = (result.content && result.content[0] && result.content[0].text) || 'Failed to mark task as done';
        } else {
          errorMsg = '';
          t.done_date = new Date().toISOString();
        }
        render();
      })
      .catch((e) => {
        updating[t.id] = false;
        errorMsg = 'Could not mark as done: ' + ((e && e.message) || String(e));
        render();
      });
  };

  // Extract an array of tasks from a tool result, handling the multiple
  // shapes hosts use. Claude sends the JSON-stringified array in
  // content[0].text. ChatGPT (OpenAI Apps SDK convention) instead populates
  // structuredContent with typed data — either the array directly or a
  // wrapper object like { tasks: [...] }.
  const extractTasks = (result) => {
    if (!result) return null;
    const sc = result.structuredContent;
    if (Array.isArray(sc)) return sc;
    if (sc && Array.isArray(sc.tasks)) return sc.tasks;
    const text = result.content && result.content[0] && result.content[0].text;
    if (typeof text === 'string' && text.length > 0) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && Array.isArray(parsed.tasks)) return parsed.tasks;
      } catch (_) {
        // fall through
      }
    }
    return null;
  };

  const applyToolResult = (result) => {
    const extracted = extractTasks(result);
    if (extracted) {
      tasks = extracted;
      errorMsg = '';
    } else {
      tasks = [];
      errorMsg = 'Could not extract task list from tool result';
    }
    ready = true;
    render();
  };

  const applyToolInput = (input) => {
    const args = input && input.arguments;
    if (args && Array.isArray(args.tasks)) {
      tasks = args.tasks;
      errorMsg = '';
      ready = true;
      render();
    }
  };

  // -------- Bootstrap --------
  window.addEventListener('message', (event) => {
    // Origin-agnostic (the host's origin is unknown at build time);
    // just assert the message came from the parent frame.
    if (event.source !== window.parent) return;
    const m = event.data;
    if (!m || m.jsonrpc !== '2.0') return;
    if (m.id !== undefined && m.method === undefined) {
      const w = pending.get(m.id);
      if (!w) return;
      pending.delete(m.id);
      clearTimeout(w.timer);
      if (m.error) w.reject(new Error(m.error.message || 'RPC error'));
      else w.resolve(m.result);
      return;
    }
    if (m.method === 'ui/notifications/tool-result') {
      applyToolResult(m.params);
    } else if (
      m.method === 'ui/notifications/tool-input-partial' ||
      m.method === 'ui/notifications/tool-input'
    ) {
      // Render progressively from streamed tool arguments so the user sees
      // tasks appear as the model generates them instead of a blank wait.
      // Claude uses tool-input-partial; ChatGPT streams via tool-input.
      applyToolInput(m.params);
    } else if (
      m.method === 'ui/notifications/host-context-changed' ||
      m.method === 'ui/notifications/theme'
    ) {
      const theme = m.params && m.params.theme;
      if (theme) {
        const cl = document.documentElement.classList;
        cl.toggle('dark', theme === 'dark');
        cl.toggle('light', theme === 'light');
      }
    }
  });

  // Iframe has no intrinsic height from the host's perspective; measure our
  // own content and ask the host to resize via ui/notifications/size-changed
  // (per MCP Apps spec; hosts like Claude Desktop ignore non-spec ui/size).
  let lastReportedHeight = 0;
  const reportSize = () => {
    const h = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight,
    );
    const height = h + 2;
    if (height === lastReportedHeight) return;
    lastReportedHeight = height;
    post({
      jsonrpc: '2.0',
      method: 'ui/notifications/size-changed',
      params: { width: document.documentElement.clientWidth, height },
    });
  };

  render();

  // -------- Spec-compliant MCP Apps handshake --------
  // Per the MCP Apps spec, the host MUST NOT send any notification (including
  // tool-result) before it receives ui/notifications/initialized from the
  // view. We therefore: (1) send ui/initialize, (2) await the response,
  // (3) send ui/notifications/initialized, and only then wire up the
  // ResizeObserver so the host is not spammed with size reports before handshake.
  rpc('ui/initialize', {
    protocolVersion: '2025-06-18',
    appInfo: { name: 'atomic-crm-task-list', version: '1.0.0' },
    appCapabilities: {
      tools: { listChanged: false },
      availableDisplayModes: ['inline'],
    },
  })
    .then((result) => {
      // Apply theme from host context if provided
      const theme = result && result.hostContext && result.hostContext.theme;
      if (theme) {
        const cl = document.documentElement.classList;
        cl.toggle('dark', theme === 'dark');
        cl.toggle('light', theme === 'light');
      }
      post({ jsonrpc: '2.0', method: 'ui/notifications/initialized', params: {} });
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(reportSize).observe(document.body);
      }
    })
    .catch((e) => {
      errorMsg = 'Failed to initialize MCP App: ' + ((e && e.message) || e);
      render();
    });
})();
</script>
</body>
</html>
`;
