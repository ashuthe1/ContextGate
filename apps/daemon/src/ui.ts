export function renderUiHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ContextGate Console</title>
    <link rel="stylesheet" href="/ui/styles.css" />
  </head>
  <body>
    <div class="page">
      <header class="hero">
        <div>
          <p class="eyebrow">ContextGate</p>
          <h1>Operator Console</h1>
          <p class="lede">Inspect integrations, task runs, approval pressure, and selected tool manifests from one local page.</p>
        </div>
        <div class="hero-actions">
          <button id="refreshButton">Refresh</button>
        </div>
      </header>
      <section class="cards" id="summaryCards"></section>
      <section class="layout">
        <section class="panel">
          <div class="panel-header">
            <h2>Server Health</h2>
            <span id="healthCount" class="meta"></span>
          </div>
          <div id="serverHealth"></div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2>Pending Approvals</h2>
            <span class="meta">Derived from audit log</span>
          </div>
          <div id="approvals"></div>
        </section>
      </section>
      <section class="layout">
        <section class="panel">
          <div class="panel-header">
            <h2>Recent Tasks</h2>
            <span class="meta">Click a task to inspect selection and timeline</span>
          </div>
          <div id="tasks"></div>
        </section>
        <section class="panel detail">
          <div class="panel-header">
            <h2>Task Detail</h2>
            <span id="taskTitle" class="meta">No task selected</span>
          </div>
          <div id="taskDetail" class="detail-body empty">Select a task from the list.</div>
        </section>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Catalog Browser</h2>
          <span id="catalogCount" class="meta"></span>
        </div>
        <div id="catalog"></div>
      </section>
    </div>
    <script type="module" src="/ui/app.js"></script>
  </body>
</html>`;
}

export function renderUiStyles(): string {
  return `:root {
  color-scheme: light;
  --bg: #f4efe7;
  --panel: #fffaf4;
  --panel-strong: #f1e5d2;
  --text: #1c1a17;
  --muted: #6b6256;
  --accent: #ba5a31;
  --accent-soft: #efd3c4;
  --ok: #2d7a52;
  --warn: #af7a18;
  --error: #a83c32;
  --border: #dfd1bc;
  --shadow: 0 18px 50px rgba(78, 53, 27, 0.09);
  font-family: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", serif;
}
* { box-sizing: border-box; }
body { margin: 0; background: radial-gradient(circle at top left, #fff8ef, var(--bg) 40%); color: var(--text); }
.page { max-width: 1380px; margin: 0 auto; padding: 32px 20px 48px; }
.hero, .panel, .card { background: var(--panel); border: 1px solid var(--border); box-shadow: var(--shadow); }
.hero { display: flex; justify-content: space-between; gap: 20px; padding: 28px; border-radius: 24px; margin-bottom: 20px; }
.eyebrow { margin: 0 0 8px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.16em; font: 700 12px/1.2 ui-monospace, SFMono-Regular, monospace; }
h1, h2, h3, p { margin-top: 0; }
h1 { font-size: clamp(2rem, 5vw, 3.8rem); line-height: 0.95; margin-bottom: 12px; }
.lede, .meta, .muted { color: var(--muted); }
.hero-actions { display: flex; align-items: flex-start; }
button { border: 0; border-radius: 999px; background: var(--accent); color: white; font: 600 14px/1 ui-sans-serif, system-ui, sans-serif; padding: 12px 18px; cursor: pointer; }
.cards, .layout { display: grid; gap: 16px; margin-bottom: 16px; }
.cards { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.layout { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.card { padding: 18px; border-radius: 20px; }
.card .value { font: 700 2rem/1 ui-sans-serif, system-ui, sans-serif; margin-top: 8px; }
.panel { border-radius: 22px; padding: 18px; min-height: 220px; }
.panel.detail { min-height: 420px; }
.panel-header { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 14px; }
.table { display: grid; gap: 10px; }
.row { display: grid; gap: 8px; padding: 12px 14px; border-radius: 16px; background: white; border: 1px solid var(--border); }
.row.compact { grid-template-columns: 1.4fr auto auto; align-items: center; }
.row.task { cursor: pointer; }
.row.task:hover, .row.task.active { border-color: var(--accent); background: #fff4eb; }
.pill { display: inline-flex; align-items: center; padding: 5px 9px; border-radius: 999px; font: 700 11px/1 ui-monospace, monospace; text-transform: uppercase; letter-spacing: 0.04em; }
.pill.ok { color: var(--ok); background: #e7f6ee; }
.pill.error { color: var(--error); background: #fdeceb; }
.pill.warn { color: var(--warn); background: #fff2d7; }
.kv { display: flex; gap: 10px; flex-wrap: wrap; color: var(--muted); font: 500 13px/1.4 ui-sans-serif, system-ui, sans-serif; }
.detail-body { display: grid; gap: 16px; }
.detail-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
.list { display: grid; gap: 10px; }
.list-item { padding: 10px 12px; border-radius: 14px; background: white; border: 1px solid var(--border); }
.mono { font-family: ui-monospace, SFMono-Regular, monospace; }
.empty { color: var(--muted); display: grid; place-items: center; min-height: 180px; }
@media (max-width: 720px) {
  .hero { padding: 22px; }
  .page { padding: 16px 14px 32px; }
  .row.compact { grid-template-columns: 1fr; }
}`;
}

export function renderUiScript(): string {
  return `const state = { tasks: [], selectedTaskId: null };

document.getElementById("refreshButton").addEventListener("click", () => loadDashboard(true));
loadDashboard(false).catch(renderFatal);

async function loadDashboard(preserveSelection) {
  const [health, approvals, tasks, catalog] = await Promise.all([
    requestJson("/v1/server-health"),
    requestJson("/v1/approvals"),
    requestJson("/v1/tasks"),
    requestJson("/v1/catalog"),
  ]);

  state.tasks = tasks;
  if (!preserveSelection || !state.selectedTaskId) {
    state.selectedTaskId = tasks[0]?.taskId ?? null;
  }

  renderSummary(health, approvals, tasks, catalog);
  renderHealth(health);
  renderApprovals(approvals);
  renderTasks(tasks);
  renderCatalog(catalog);

  if (state.selectedTaskId) {
    await loadTaskDetail(state.selectedTaskId);
  } else {
    document.getElementById("taskDetail").innerHTML = '<div class="empty">No tasks yet.</div>';
  }
}

async function loadTaskDetail(taskId) {
  state.selectedTaskId = taskId;
  renderTasks(state.tasks);
  const [task, timeline] = await Promise.all([
    requestJson('/v1/tasks/' + encodeURIComponent(taskId) + '/explanation'),
    requestJson('/v1/tasks/' + encodeURIComponent(taskId) + '/timeline'),
  ]);
  document.getElementById("taskTitle").textContent = task.taskId;
  document.getElementById("taskDetail").innerHTML = taskDetailHtml(task, timeline);
}

function renderSummary(health, approvals, tasks, catalog) {
  const ok = health.filter((item) => item.status === "ok").length;
  const selected = tasks.reduce((sum, task) => sum + task.selectedCount, 0);
  const cards = [
    ['Healthy Servers', ok + '/' + health.length, 'Discovery-ready integrations'],
    ['Pending Approvals', approvals.length, 'Ask-mode pressure right now'],
    ['Tracked Tasks', tasks.length, 'Persisted task selections'],
    ['Catalog Tools', catalog?.tools?.length ?? 0, 'Current normalized global catalog'],
    ['Selected Tools', selected, 'Selected across all persisted tasks'],
  ];
  document.getElementById("summaryCards").innerHTML = cards.map(([label, value, note]) =>
    '<article class="card"><div class="muted">' + escapeHtml(label) + '</div><div class="value">' + escapeHtml(String(value)) + '</div><div class="muted">' + escapeHtml(note) + '</div></article>'
  ).join('');
}

function renderHealth(health) {
  document.getElementById("healthCount").textContent = health.length + ' configured';
  document.getElementById("serverHealth").innerHTML = wrapRows(
    health.map((item) => '<div class="row compact"><div><strong>' + escapeHtml(item.serverId) + '</strong><div class="muted mono">' + escapeHtml(item.transport) + '</div></div><span class="pill ' + (item.status === 'ok' ? 'ok' : 'error') + '">' + escapeHtml(item.status) + '</span><div class="muted">' + escapeHtml(item.status === 'ok' ? 'tools=' + item.discoveredTools : item.error ?? 'error') + '</div></div>'),
    'No servers configured.'
  );
}

function renderApprovals(approvals) {
  document.getElementById("approvals").innerHTML = wrapRows(
    approvals.map((item) => '<div class="row"><div><strong>' + escapeHtml(item.toolId) + '</strong></div><div class="kv"><span class="mono">' + escapeHtml(item.taskId) + '</span><span>' + escapeHtml(item.timestamp) + '</span></div><div class="muted">' + escapeHtml(item.reasons.join(', ') || 'approval required') + '</div></div>'),
    'No pending approvals.'
  );
}

function renderTasks(tasks) {
  document.getElementById("tasks").innerHTML = wrapRows(
    tasks.map((task) => '<div class="row task' + (task.taskId === state.selectedTaskId ? ' active' : '') + '" data-task-id="' + escapeHtml(task.taskId) + '"><div><strong>' + escapeHtml(task.promptText || task.taskId) + '</strong></div><div class="kv"><span class="mono">' + escapeHtml(task.taskId) + '</span><span>selected=' + task.selectedCount + '</span><span>hidden=' + task.hiddenCount + '</span><span>blocked=' + task.blockedCount + '</span></div></div>'),
    'No saved tasks.'
  );
  for (const element of document.querySelectorAll('[data-task-id]')) {
    element.addEventListener('click', () => loadTaskDetail(element.getAttribute('data-task-id')));
  }
}

function renderCatalog(catalog) {
  document.getElementById("catalogCount").textContent = (catalog?.tools?.length ?? 0) + ' tools';
  const tools = (catalog?.tools ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
  document.getElementById("catalog").innerHTML = wrapRows(
    tools.map((tool) => '<div class="row"><div><strong>' + escapeHtml(tool.id) + '</strong></div><div class="kv"><span>' + escapeHtml(tool.riskClass) + '</span><span>' + escapeHtml(tool.trustLevel) + '</span><span>' + escapeHtml(tool.serverId) + '</span></div><div class="muted">' + escapeHtml(tool.description || tool.title || 'No description') + '</div></div>'),
    'Catalog has not been indexed yet.'
  );
}

function taskDetailHtml(task, timeline) {
  const selected = task.selected.map((item) => '<div class="list-item"><strong>' + escapeHtml(item.tool.id) + '</strong><div class="muted">' + escapeHtml(item.reasons.join(', ')) + '</div></div>').join('');
  const rejected = task.rejected.slice(0, 12).map((item) => '<div class="list-item"><strong>' + escapeHtml(item.tool.id) + '</strong><div class="muted">' + escapeHtml(item.decision + ': ' + item.reasons.join(', ')) + '</div></div>').join('');
  const events = timeline.map((event) => '<div class="list-item"><strong>' + escapeHtml(event.type) + '</strong><div class="kv"><span>' + escapeHtml(event.timestamp) + '</span><span>' + escapeHtml(event.toolId || '') + '</span><span>' + escapeHtml(event.decision || '') + '</span></div><div class="muted">' + escapeHtml((event.reasons || []).join(', ')) + '</div></div>').join('');
  return '<div class="detail-grid">' +
    '<section><h3>Prompt</h3><div class="list-item">' + escapeHtml(task.promptText || task.promptHash) + '</div></section>' +
    '<section><h3>Summary</h3><div class="list-item">selected=' + task.selected.length + ', hidden=' + task.hiddenCount + ', blocked=' + task.blockedCount + ', not_relevant=' + task.notRelevantCount + '</div></section>' +
    '</div>' +
    '<div class="detail-grid">' +
    '<section><h3>Selected Tools</h3><div class="list">' + (selected || '<div class="empty">No selected tools.</div>') + '</div></section>' +
    '<section><h3>Rejected Highlights</h3><div class="list">' + (rejected || '<div class="empty">No rejected tools.</div>') + '</div></section>' +
    '</div>' +
    '<section><h3>Timeline</h3><div class="list">' + (events || '<div class="empty">No audit events for this task.</div>') + '</div></section>';
}

function wrapRows(rows, emptyText) {
  return rows.length > 0 ? '<div class="table">' + rows.join('') + '</div>' : '<div class="empty">' + escapeHtml(emptyText) + '</div>';
}

async function requestJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || ('Request failed for ' + url));
  }
  return response.json();
}

function renderFatal(error) {
  document.body.innerHTML = '<div class="page"><section class="panel"><h1>UI failed to load</h1><p class="muted">' + escapeHtml(error.message || String(error)) + '</p></section></div>';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}`;
}
