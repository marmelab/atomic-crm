// Task-list MCP App. Everything lives in this single file: template,
// styles, and glue.
// It uses Vue.js as it's easier for a single-file app with no bundler.
// Vue.js is loaded from unpkg at runtime; the bundler only sees this module.
// Syntax highlighted if the IDE has the es6-string-html extension enabled.

export const TASK_LIST_UI_URI = "ui://atomic-crm/task-list";

export const TASK_LIST_HTML = /*html*/ `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'">
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
<div id="app">
  <div v-if="error" class="error">{{ error }}</div>
  <div v-if="!ready" class="empty">Waiting for data\u2026</div>
  <div v-else-if="!tasks.length" class="empty">No pending tasks.</div>
  <div
    v-for="t in tasks"
    :key="t.id"
    class="task"
    :class="{ done: !!t.done_date, updating: updating[t.id] }"
  >
    <button
      type="button"
      class="check"
      :class="{ checked: !!t.done_date }"
      :aria-label="t.done_date ? 'Already done' : 'Mark as done'"
      :disabled="!!t.done_date"
      @click="complete(t)"
    ></button>
    <div class="task-content">
      <div class="task-text">{{ t.text || '(no description)' }}</div>
      <div v-if="t.contact_name || t.type || t.due_date" class="task-meta">
        <span v-if="t.contact_name" class="contact">{{ t.contact_name }}</span>
        <span v-if="t.type" class="pill">{{ t.type }}</span>
        <span v-if="t.due_date">Due {{ formatDate(t.due_date) }}</span>
      </div>
    </div>
  </div>
</div>
<script
  src="https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js"
  integrity="sha384-W/1Fp/LgAYO/oTn9Gs+PbeWuMuq1eQCnUMPCeg8POmMYchhzxctjEqtbiCIxDOON"
  crossorigin="anonymous"
></script>
<script>
(() => {
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

  const { createApp, ref, reactive, onMounted } = Vue;

  createApp({
    setup() {
      const tasks = ref([]);
      const error = ref('');
      const ready = ref(false);
      const updating = reactive({});

      const formatDate = (value) => {
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      };

      const complete = (t) => {
        if (t.done_date || updating[t.id]) return;
        updating[t.id] = true;
        rpc('tools/call', { name: 'complete_task', arguments: { id: t.id } })
          .then((result) => {
            updating[t.id] = false;
            if (result?.isError) {
              error.value = result.content?.[0]?.text || 'Failed to mark task as done';
              return;
            }
            error.value = '';
            t.done_date = new Date().toISOString();
          })
          .catch((e) => {
            updating[t.id] = false;
            error.value = 'Could not mark as done: ' + (e?.message || String(e));
          });
      };

      const applyToolResult = (result) => {
        const text = result?.content?.[0]?.text;
        try {
          const parsed = JSON.parse(text || '[]');
          tasks.value = Array.isArray(parsed) ? parsed : [];
          error.value = '';
        } catch (e) {
          tasks.value = [];
          error.value = 'Could not parse task list: ' + (e?.message || e);
        }
        ready.value = true;
      };

      onMounted(() => {
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
          if (m.method === 'ui/notifications/tool-result') applyToolResult(m.params);
          else if (m.method === 'ui/notifications/theme') {
            const theme = m.params?.theme;
            const cl = document.documentElement.classList;
            cl.toggle('dark', theme === 'dark');
            cl.toggle('light', theme === 'light');
          }
        });
        // Iframe has no intrinsic height from the host's perspective;
        // measure our own content and ask the host to resize via ui/size.
        const reportSize = () => {
          const h = Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight,
          );
          post({ jsonrpc: '2.0', method: 'ui/size', params: { height: h + 2 } });
        };
        if (typeof ResizeObserver !== 'undefined') new ResizeObserver(reportSize).observe(document.body);
        post({ jsonrpc: '2.0', method: 'ui/ready' });
      });

      return { tasks, error, ready, updating, formatDate, complete };
    },
  }).mount('#app');
})();
</script>
</body>
</html>
`;
