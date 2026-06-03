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
            <span class="meta">Approve or deny ask-mode requests</span>
          </div>
          <input id="approvalFilter" class="filter-input" placeholder="Filter approvals by tool or task" />
          <div id="approvals"></div>
        </section>
      </section>
      <section class="panel">
        <div class="panel-header">
          <h2>Policy Editor</h2>
          <span id="policyMeta" class="meta"></span>
        </div>
        <div class="editor-actions">
          <button id="savePolicyButton">Save Policy</button>
          <span id="policyStatus" class="meta"></span>
        </div>
        <textarea id="policyEditor" class="editor" spellcheck="false"></textarea>
      </section>
      <section class="layout">
        <section class="panel">
          <div class="panel-header">
            <h2>Recent Tasks</h2>
            <span class="meta">Click a task to inspect selection and timeline</span>
          </div>
          <input id="taskFilter" class="filter-input" placeholder="Filter tasks by prompt or task id" />
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
        <div class="filter-row">
          <input id="catalogFilter" class="filter-input" placeholder="Search catalog by id, server, risk, or description" />
          <select id="catalogRiskFilter" class="filter-select">
            <option value="">All risks</option>
            <option value="read">read</option>
            <option value="write_safe">write_safe</option>
            <option value="write_external">write_external</option>
            <option value="destructive">destructive</option>
            <option value="privileged_infra">privileged_infra</option>
            <option value="monetary">monetary</option>
            <option value="credential_access">credential_access</option>
            <option value="unknown">unknown</option>
          </select>
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
.editor-actions { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.filter-row { display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap; }
.filter-input, .filter-select { width: 100%; border-radius: 14px; border: 1px solid var(--border); background: #fffdf9; padding: 11px 13px; color: var(--text); font: 14px/1.3 ui-sans-serif, system-ui, sans-serif; }
.filter-row .filter-input { flex: 1 1 320px; }
.filter-row .filter-select { flex: 0 0 180px; }
.editor { width: 100%; min-height: 280px; border-radius: 18px; border: 1px solid var(--border); background: #fffdf9; padding: 14px; color: var(--text); font: 13px/1.5 ui-monospace, monospace; resize: vertical; }
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
.actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.actions button.secondary { background: #e7ddd0; color: var(--text); }
.detail-body { display: grid; gap: 16px; }
.detail-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
.list { display: grid; gap: 10px; }
.list-item { padding: 10px 12px; border-radius: 14px; background: white; border: 1px solid var(--border); }
.subtle { font: 600 12px/1.3 ui-monospace, monospace; color: var(--muted); text-transform: uppercase; letter-spacing: 0.04em; }
.mono { font-family: ui-monospace, SFMono-Regular, monospace; }
.empty { color: var(--muted); display: grid; place-items: center; min-height: 180px; }
@media (max-width: 720px) {
  .hero { padding: 22px; }
  .page { padding: 16px 14px 32px; }
  .row.compact { grid-template-columns: 1fr; }
}`;
}

export function renderUiScript(): string {
  return `const state = {
  tasks: [],
  selectedTaskId: null,
  policyEditable: false,
  catalog: null,
  approvals: [],
};

document.getElementById("refreshButton").addEventListener("click", () => loadDashboard(true));
document.getElementById("savePolicyButton").addEventListener("click", () => savePolicy());
document.getElementById("taskFilter").addEventListener("input", () => renderTasks(state.tasks));
document.getElementById("approvalFilter").addEventListener("input", () => renderApprovals(state.approvals));
document.getElementById("catalogFilter").addEventListener("input", () => renderCatalog(state.catalog));
document.getElementById("catalogRiskFilter").addEventListener("change", () => renderCatalog(state.catalog));
loadDashboard(false).catch(renderFatal);

async function loadDashboard(preserveSelection) {
  const [health, approvals, tasks, catalog, policy] = await Promise.all([
    requestJson("/v1/server-health"),
    requestJson("/v1/approvals"),
    requestJson("/v1/tasks"),
    requestJson("/v1/catalog"),
    requestJson("/v1/policy"),
  ]);

  state.tasks = tasks;
  state.approvals = approvals;
  state.catalog = catalog;
  state.policyEditable = policy.editable === true;
  if (!preserveSelection || !state.selectedTaskId) {
    state.selectedTaskId = tasks[0]?.taskId ?? null;
  }

  renderSummary(health, approvals, tasks, catalog);
  renderHealth(health);
  renderApprovals(approvals);
  renderPolicy(policy);
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
  const query = document.getElementById('approvalFilter').value.trim().toLowerCase();
  const filtered = approvals.filter((item) => {
    const haystack = [item.toolId, item.taskId, item.reasons.join(' ')].join(' ').toLowerCase();
    return query.length === 0 || haystack.includes(query);
  });

  document.getElementById("approvals").innerHTML = wrapRows(
    filtered.map((item) => '<div class="row"><div><strong>' + escapeHtml(item.toolId) + '</strong></div><div class="kv"><span class="mono">' + escapeHtml(item.taskId) + '</span><span>' + escapeHtml(item.timestamp) + '</span><span>' + escapeHtml(formatArguments(item.arguments)) + '</span></div><div class="muted">' + escapeHtml(item.reasons.join(', ') || 'approval required') + '</div><div class="actions"><button data-approve="' + escapeHtml(item.approvalId || '') + '">Approve</button><button class="secondary" data-deny="' + escapeHtml(item.approvalId || '') + '">Deny</button></div></div>'),
    filtered.length === approvals.length ? 'No pending approvals.' : 'No approvals match the current filter.'
  );
  for (const element of document.querySelectorAll('[data-approve]')) {
    element.addEventListener('click', () => resolveApproval(element.getAttribute('data-approve'), true));
  }
  for (const element of document.querySelectorAll('[data-deny]')) {
    element.addEventListener('click', () => resolveApproval(element.getAttribute('data-deny'), false));
  }
}

function renderPolicy(policy) {
  const editor = document.getElementById('policyEditor');
  editor.value = policy.text || '';
  editor.disabled = policy.editable !== true;
  document.getElementById('savePolicyButton').disabled = policy.editable !== true;
  document.getElementById('policyMeta').textContent = policy.path ? policy.path : 'Generated default policy view';
  document.getElementById('policyStatus').textContent = policy.editable ? 'Editable' : 'Read-only until policy.file is configured';
}

function renderTasks(tasks) {
  const query = document.getElementById('taskFilter').value.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    const haystack = [task.taskId, task.promptText || '', task.promptHash].join(' ').toLowerCase();
    return query.length === 0 || haystack.includes(query);
  });

  document.getElementById("tasks").innerHTML = wrapRows(
    filtered.map((task) => '<div class="row task' + (task.taskId === state.selectedTaskId ? ' active' : '') + '" data-task-id="' + escapeHtml(task.taskId) + '"><div><strong>' + escapeHtml(task.promptText || task.taskId) + '</strong></div><div class="kv"><span class="mono">' + escapeHtml(task.taskId) + '</span><span>selected=' + task.selectedCount + '</span><span>hidden=' + task.hiddenCount + '</span><span>blocked=' + task.blockedCount + '</span></div></div>'),
    filtered.length === tasks.length ? 'No saved tasks.' : 'No tasks match the current filter.'
  );
  for (const element of document.querySelectorAll('[data-task-id]')) {
    element.addEventListener('click', () => loadTaskDetail(element.getAttribute('data-task-id')));
  }
}

function renderCatalog(catalog) {
  const textQuery = document.getElementById("catalogFilter").value.trim().toLowerCase();
  const riskQuery = document.getElementById("catalogRiskFilter").value;
  const tools = (catalog?.tools ?? []).slice().sort((a, b) => a.id.localeCompare(b.id));
  const filtered = tools.filter((tool) => {
    const matchesRisk = riskQuery.length === 0 || tool.riskClass === riskQuery;
    const haystack = [tool.id, tool.serverId, tool.riskClass, tool.trustLevel, tool.description || '', tool.title || ''].join(' ').toLowerCase();
    const matchesText = textQuery.length === 0 || haystack.includes(textQuery);
    return matchesRisk && matchesText;
  });

  document.getElementById("catalogCount").textContent = filtered.length + ' / ' + tools.length + ' tools';
  document.getElementById("catalog").innerHTML = wrapRows(
    filtered.map((tool) => '<div class="row"><div><strong>' + escapeHtml(tool.id) + '</strong></div><div class="kv"><span>' + escapeHtml(tool.riskClass) + '</span><span>' + escapeHtml(tool.trustLevel) + '</span><span>' + escapeHtml(tool.serverId) + '</span><span>trust=' + escapeHtml(String(tool.trustScore ?? "n/a")) + '</span></div><div class="muted">' + escapeHtml(tool.description || tool.title || 'No description') + '</div><div class="muted">' + escapeHtml((tool.trustWarnings || []).join(', ') || 'no trust warnings') + '</div></div>'),
    tools.length === 0 ? 'Catalog has not been indexed yet.' : 'No catalog tools match the current filters.'
  );
}

function taskDetailHtml(task, timeline) {
  const selected = task.selected.map((item) => toolExplanationHtml(item.tool.id, item.score, item.mode, item.riskClass, item.reasons, item.policyRuleId)).join('');
  const rejected = task.rejected.slice(0, 16).map((item) => toolExplanationHtml(item.tool.id, item.score, item.decision, item.tool.riskClass, item.reasons, item.policyRuleId)).join('');
  const candidateTop = (task.candidates || []).slice(0, 10).map((item) => '<div class="list-item"><strong>' + escapeHtml(item.tool.id) + '</strong><div class="kv"><span>score=' + escapeHtml(item.score?.toFixed ? item.score.toFixed(2) : String(item.score ?? '')) + '</span></div><div class="muted">' + escapeHtml((item.reasons || []).join(', ')) + '</div></div>').join('');
  const events = timeline.map((event) => '<div class="list-item"><strong>' + escapeHtml(event.type) + '</strong><div class="kv"><span>' + escapeHtml(event.timestamp) + '</span><span>' + escapeHtml(event.toolId || '') + '</span><span>' + escapeHtml(event.decision || '') + '</span><span>' + escapeHtml(formatAuditData(event.data)) + '</span></div><div class="muted">' + escapeHtml((event.reasons || []).join(', ')) + '</div></div>').join('');
  return '<div class="detail-grid">' +
    '<section><h3>Prompt</h3><div class="list-item">' + escapeHtml(task.promptText || task.promptHash) + '</div></section>' +
    '<section><h3>Summary</h3><div class="list-item">catalog=' + task.totalTools + ', candidates=' + task.candidates.length + ', selected=' + task.selected.length + ', hidden=' + task.hiddenCount + ', blocked=' + task.blockedCount + ', not_relevant=' + task.notRelevantCount + ', tokens_saved=' + task.estimatedSchemaTokensSaved + '</div></section>' +
    '</div>' +
    '<div class="detail-grid">' +
    '<section><h3>Selected Tools</h3><div class="list">' + (selected || '<div class="empty">No selected tools.</div>') + '</div></section>' +
    '<section><h3>Rejected Highlights</h3><div class="list">' + (rejected || '<div class="empty">No rejected tools.</div>') + '</div></section>' +
    '</div>' +
    '<div class="detail-grid">' +
    '<section><h3>Top Candidates</h3><div class="list">' + (candidateTop || '<div class="empty">No candidates recorded.</div>') + '</div></section>' +
    '<section><h3>Timeline</h3><div class="list">' + (events || '<div class="empty">No audit events for this task.</div>') + '</div></section>' +
    '</div>';
}

function toolExplanationHtml(toolId, score, decision, riskClass, reasons, policyRuleId) {
  const scoreText = typeof score === 'number' ? score.toFixed(2) : 'n/a';
  return '<div class="list-item"><div class="subtle">' + escapeHtml(policyRuleId || 'policy: inferred') + '</div><strong>' + escapeHtml(toolId) + '</strong><div class="kv"><span>decision=' + escapeHtml(decision) + '</span><span>risk=' + escapeHtml(riskClass) + '</span><span>score=' + escapeHtml(scoreText) + '</span></div><div class="muted">' + escapeHtml((reasons || []).join(', ')) + '</div></div>';
}

function wrapRows(rows, emptyText) {
  return rows.length > 0 ? '<div class="table">' + rows.join('') + '</div>' : '<div class="empty">' + escapeHtml(emptyText) + '</div>';
}

async function savePolicy() {
  const editor = document.getElementById('policyEditor');
  const status = document.getElementById('policyStatus');
  if (!state.policyEditable) {
    status.textContent = 'Policy is read-only.';
    return;
  }

  status.textContent = 'Saving...';
  try {
    const policy = await requestJson('/v1/policy', {
      method: 'PUT',
      body: JSON.stringify({ text: editor.value }),
    });
    renderPolicy(policy);
    status.textContent = 'Saved.';
  } catch (error) {
    status.textContent = error.message || String(error);
  }
}

async function resolveApproval(approvalId, approve) {
  if (!approvalId) {
    return;
  }
  try {
    await requestJson('/v1/approvals/' + encodeURIComponent(approvalId) + '/' + (approve ? 'approve' : 'deny'), {
      method: 'POST',
      body: JSON.stringify({
        approver: 'ui-user',
        reason: approve ? 'approved in UI' : 'denied in UI',
      }),
    });
    await loadDashboard(true);
  } catch (error) {
    renderFatal(error);
  }
}

async function requestJson(url, init) {
  const response = await fetch(url, {
    headers: {
      'content-type': 'application/json',
    },
    ...init,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    throw new Error(data?.error || ('Request failed for ' + url));
  }
  return data;
}

function formatArguments(value) {
  if (!value || typeof value !== 'object') {
    return 'args: none';
  }
  const entries = Object.entries(value).slice(0, 2).map(([key, nested]) => key + '=' + String(nested));
  return entries.length > 0 ? 'args: ' + entries.join(', ') : 'args: empty';
}

function formatAuditData(value) {
  if (!value || typeof value !== 'object') {
    return 'data: none';
  }
  const outputWarnings = Array.isArray(value.outputWarnings) ? value.outputWarnings.join('|') : '';
  const trustScore = typeof value.outputTrustScore === 'number' ? 'trust=' + value.outputTrustScore : '';
  const compact = [trustScore, outputWarnings ? 'warnings=' + outputWarnings : ''].filter(Boolean).join(' ');
  return compact || 'data: present';
}

function renderFatal(error) {
  document.body.innerHTML = '<div class="page"><section class="panel"><h1>UI failed to load</h1><p class="muted">' + escapeHtml(error.message || String(error)) + '</p></section></div>';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]));
}`;
}
