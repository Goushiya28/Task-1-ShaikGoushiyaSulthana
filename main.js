const taskStore = {
  getAll()   { try { return JSON.parse(localStorage.getItem('dt_tasks') || '[]'); } catch { return []; } },
  save(tasks){ localStorage.setItem('dt_tasks', JSON.stringify(tasks)); },
  add(task)  { const t = this.getAll(); t.push(task); this.save(t); },
  update(id, updates) {
    const t = this.getAll();
    const i = t.findIndex(x => x.id === id);
    if (i > -1) { t[i] = { ...t[i], ...updates, updatedAt: new Date().toISOString() }; this.save(t); }
  },
  delete(id) { const t = this.getAll().filter(x => x.id !== id); this.save(t); },
};
let editingId    = null;
let deleteTargetId = null;
let tablePage    = 1;
const perPage    = 8;
let tableSearch  = '';
let tableStatus  = 'all';
let tableCategory = 'all';
let tablePriority = 'all';
function escapeHTML(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
function today() { return new Date().toISOString().slice(0, 10); }
function formatDueDate(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}
function getDaysUntil(str) {
  if (!str) return null;
  const now  = new Date(); now.setHours(0,0,0,0);
  const due  = new Date(str + 'T00:00:00');
  return Math.round((due - now) / 86400000);
}
function isOverdue(task) {
  if (task.status === 'Completed') return false;
  if (!task.dueDate) return false;
  return getDaysUntil(task.dueDate) < 0;
}
function getEffectiveStatus(task) {
  if (isOverdue(task)) return 'Overdue';
  return task.status;
}
const CAT_COLORS = ['green','cyan','amber','rose','purple','orange'];
let catColorMap = {};
function getCatColor(cat) {
  if (!catColorMap[cat]) {
    const used = Object.keys(catColorMap).length;
    catColorMap[cat] = CAT_COLORS[used % CAT_COLORS.length];
  }
  return catColorMap[cat];
}
const COLOR_HEX = { green:'#00e676', cyan:'#00e5ff', amber:'#ffb300', rose:'#ff4f80', purple:'#b388ff', orange:'#ff7043' };
function showToast(msg, type='success') {
  const icon = type === 'success' ? '✓' : '✕';
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHTML(msg)}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
const hamburger  = document.getElementById('hamburger');
const sidebar    = document.getElementById('sidebar');
const navOverlay = document.getElementById('navOverlay');
const openNav  = () => { sidebar.classList.add('open'); navOverlay.classList.add('visible'); hamburger.classList.add('open'); document.body.style.overflow='hidden'; };
const closeNav = () => { sidebar.classList.remove('open'); navOverlay.classList.remove('visible'); hamburger.classList.remove('open'); document.body.style.overflow=''; };
hamburger.addEventListener('click', () => sidebar.classList.contains('open') ? closeNav() : openNav());
navOverlay.addEventListener('click', closeNav);
document.querySelectorAll('.nav-item').forEach(l => l.addEventListener('click', () => { if (window.innerWidth < 768) closeNav(); }));
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const a = document.querySelector(`.nav-item[data-section="${id}"]`);
  if (a) a.classList.add('active');
}
const sectionRatios = new Map();
const navObserver = new IntersectionObserver(entries => {
  entries.forEach(e => sectionRatios.set(e.target.id, e.isIntersecting ? e.intersectionRatio : 0));
  let bestId = null, bestRatio = 0;
  sectionRatios.forEach((ratio, id) => {
    if (ratio > bestRatio) { bestRatio = ratio; bestId = id; }
  });
  if (bestId) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const a = document.querySelector(`.nav-item[data-section="${bestId}"]`);
    if (a) a.classList.add('active');
  }
}, { threshold: [0, 0.1, 0.25, 0.35, 0.5, 0.75, 1] });
document.querySelectorAll('section[id]').forEach(s => navObserver.observe(s));
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      triggerAnimations(e.target);
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));
setTimeout(() => { const h = document.getElementById('hero'); if (h) { h.classList.add('visible'); triggerAnimations(h); } }, 80);
function triggerAnimations(section) {
  if (section.id === 'analytics') buildChart();
  section.querySelectorAll('.cat-fill[data-target]').forEach(bar => {
    bar.style.width = '0%';
    setTimeout(() => { bar.style.width = bar.dataset.target + '%'; }, 100);
  });
  if (section.id === 'productivity') animateProductivityCircle();
  section.querySelectorAll('.badge-prog-fill[data-target]').forEach(bar => {
    bar.style.width = '0%';
    setTimeout(() => { bar.style.width = bar.dataset.target + '%'; }, 100);
  });
}
function animateCounter(el, target, duration=800) {
  if (!el) return;
  const start = performance.now();
  (function step(ts) {
    const p = Math.min((ts - start) / duration, 1);
    el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target);
    if (p < 1) requestAnimationFrame(step);
    else el.textContent = target;
  })(performance.now());
}
function openTaskModal(id) {
  editingId = id || null;
  document.getElementById('modalTitle').textContent = id ? 'Edit Task' : 'Create Task';
  if (id) {
    const task = taskStore.getAll().find(t => t.id === id);
    if (!task) return;
    document.getElementById('taskTitle').value    = task.title;
    document.getElementById('taskDesc').value     = task.description || '';
    document.getElementById('taskCategory').value = task.category;
    document.getElementById('taskPriority').value = task.priority;
    document.getElementById('taskDueDate').value  = task.dueDate || '';
    document.getElementById('taskStatus').value   = task.status;
  } else {
    document.getElementById('taskTitle').value    = '';
    document.getElementById('taskDesc').value     = '';
    document.getElementById('taskCategory').value = '';
    document.getElementById('taskPriority').value = '';
    document.getElementById('taskDueDate').value  = '';
    document.getElementById('taskStatus').value   = '';
  }
  refreshCategoryDatalist();
  document.getElementById('taskModal').classList.add('open');
  document.getElementById('taskTitle').focus();
}
function closeTaskModal() {
  document.getElementById('taskModal').classList.remove('open');
  editingId = null;
}
function saveTask() {
  const title    = document.getElementById('taskTitle').value.trim();
  const desc     = document.getElementById('taskDesc').value.trim();
  const category = document.getElementById('taskCategory').value.trim();
  const priority = document.getElementById('taskPriority').value;
  const dueDate  = document.getElementById('taskDueDate').value;
  const status   = document.getElementById('taskStatus').value;
  if (!title)    { showToast('Task title is required.', 'error'); return; }
  if (!category) { showToast('Category is required.', 'error'); return; }
  if (!priority) { showToast('Select a priority.', 'error'); return; }
  if (!status)   { showToast('Select a status.', 'error'); return; }
  if (editingId) {
    taskStore.update(editingId, { title, description: desc, category, priority, dueDate, status });
    showToast('Task updated.');
  } else {
    taskStore.add({ id: uid(), title, description: desc, category, priority, dueDate, status, createdAt: new Date().toISOString() });
    showToast('Task created!');
  }
  closeTaskModal();
  refreshAll();
}
function confirmDelete(id) {
  deleteTargetId = id;
  document.getElementById('confirmOverlay').classList.add('open');
}
function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  deleteTargetId = null;
}
document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
  if (deleteTargetId) {
    taskStore.delete(deleteTargetId);
    showToast('Task deleted.');
    refreshAll();
    closeConfirm();
  }
});
function markComplete(id) {
  taskStore.update(id, { status: 'Completed' });
  showToast('Marked as completed!');
  refreshAll();
}
function refreshCategoryDatalist() {
  const cats = [...new Set(taskStore.getAll().map(t => t.category))];
  const dl = document.getElementById('categoryList');
  dl.innerHTML = cats.map(c => `<option value="${escapeHTML(c)}">`).join('');
}
function refreshAll() {
  const tasks = taskStore.getAll();
  updateStats(tasks);
  updateCategories(tasks);
  updateProductivity(tasks);
  updateTaskTable(tasks);
  updateDeadlines(tasks);
  updateBadges(tasks);
  updateAnalyticsSidebar(tasks);
  updateCategoryFilter(tasks);
  updateHeroMeta(tasks);
  buildChart(); // rebuild chart with real data
}
function updateHeroMeta(tasks) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const overdue   = tasks.filter(t => isOverdue(t)).length;
  document.getElementById('metaTotal').textContent     = `${total} task${total!==1?'s':''} total`;
  document.getElementById('metaCompleted').textContent = `${completed} completed`;
  document.getElementById('metaOverdue').textContent   = `${overdue} overdue`;
}
function updateStats(tasks) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const inProg    = tasks.filter(t => t.status === 'In Progress').length;
  const pending   = tasks.filter(t => t.status === 'Pending').length;
  const overdue   = tasks.filter(t => isOverdue(t)).length;
  document.getElementById('statTotal').textContent     = total;
  document.getElementById('statCompleted').textContent = completed;
  document.getElementById('statPending').textContent   = pending + inProg;
  document.getElementById('statOverdue').textContent   = overdue;
  document.getElementById('statTotalChange').textContent     = total   ? `${completed} completed, ${overdue} overdue` : 'No tasks yet';
  document.getElementById('statCompletedChange').textContent = total   ? `↑ ${total ? Math.round(completed/total*100) : 0}% completion rate` : '—';
  document.getElementById('statPendingChange').textContent   = inProg  ? `${inProg} in progress` : '—';
  document.getElementById('statOverdueChange').textContent   = overdue ? `⚠ ${overdue} past due date` : overdue === 0 && total > 0 ? '✓ All on track' : '—';
  const pct = total ? 100 : 0;
  document.getElementById('statTotalBar').style.width     = `${pct}%`;
  document.getElementById('statCompletedBar').style.width = `${total ? completed/total*100 : 0}%`;
  document.getElementById('statPendingBar').style.width   = `${total ? (pending+inProg)/total*100 : 0}%`;
  document.getElementById('statOverdueBar').style.width   = `${total ? overdue/total*100 : 0}%`;
  document.getElementById('statsTag').textContent = total ? `${total} task${total!==1?'s':''}` : 'All time';
}
function updateCategories(tasks) {
  const grid = document.getElementById('catGrid');
  if (tasks.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">◧</div><div class="empty-title">No categories yet</div><div class="empty-desc">Create tasks with categories to see progress here.</div></div>`;
    document.getElementById('catSectionTag').textContent = '0 categories';
    return;
  }
  const catMap = {};
  tasks.forEach(t => {
    if (!catMap[t.category]) catMap[t.category] = { total: 0, completed: 0 };
    catMap[t.category].total++;
    if (t.status === 'Completed') catMap[t.category].completed++;
  });
  const cats = Object.keys(catMap).sort();
  document.getElementById('catSectionTag').textContent = `${cats.length} categor${cats.length===1?'y':'ies'}`;
  grid.innerHTML = cats.map(cat => {
    const { total, completed } = catMap[cat];
    const pct = total ? Math.round(completed / total * 100) : 0;
    const color = getCatColor(cat);
    const label = pct >= 80 ? 'Strong' : pct >= 50 ? 'Progress' : pct >= 20 ? 'Started' : 'New';
    return `
      <article class="cat-card">
        <div class="cat-header">
          <span class="cat-name"><span class="cat-dot" style="background:${COLOR_HEX[color]}"></span>${escapeHTML(cat)}</span>
          <span class="cat-pct" style="color:${COLOR_HEX[color]}">${pct}%</span>
        </div>
        <div class="cat-bar-wrap">
          <div class="cat-bar"><div class="cat-fill ${color}" data-target="${pct}" style="width:${pct}%"></div></div>
        </div>
        <div class="cat-meta">
          <span>${completed} / ${total} completed</span>
          <span class="priority-badge priority-${label==='Strong'?'Low':label==='Progress'?'Medium':'High'}" style="font-size:0.62rem">${label}</span>
        </div>
      </article>`;
  }).join('');
}
let prodCircleAnimated = false;
function updateProductivity(tasks) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const score     = total ? Math.round(completed / total * 100) : 0;
  document.getElementById('productivityCircle').dataset.score = score;
  const statusEl = document.getElementById('productivityStatus');
  statusEl.textContent = total === 0 ? 'No tasks yet' : score >= 80 ? 'High Performer' : score >= 50 ? 'In Progress' : 'Getting Started';
  document.getElementById('lvlBeginner').className     = `level-badge ${score >= 0 && total > 0 ? 'active' : 'inactive'}`;
  document.getElementById('lvlIntermediate').className = `level-badge ${score >= 40 ? 'active' : 'inactive'}`;
  document.getElementById('lvlMaster').className       = `level-badge ${score >= 80 ? 'active' : 'upcoming'}`;
  if (total === 0) {
    document.getElementById('productivityBreakdown').innerHTML = `
      <div class="empty-state" style="padding:24px 0; text-align:left;">
        <div class="empty-title">Add tasks to see a breakdown</div>
        <div class="empty-desc">Your productivity score is calculated from task completion percentage. Breakdowns will appear here once you have tasks.</div>
      </div>
      <div class="productivity-levels">
        <div class="level-badge inactive" id="lvlBeginner">Getting Started</div>
        <div class="level-badge inactive" id="lvlIntermediate">In Progress</div>
        <div class="level-badge upcoming" id="lvlMaster">High Performer</div>
      </div>`;
    return;
  }
  const inProg    = tasks.filter(t => t.status === 'In Progress').length;
  const pending   = tasks.filter(t => t.status === 'Pending').length;
  const overdue   = tasks.filter(t => isOverdue(t)).length;
  const highPri   = tasks.filter(t => t.priority === 'High').length;
  const highDone  = tasks.filter(t => t.priority === 'High' && t.status === 'Completed').length;
  const bars = [
    { label: 'Task Completion', pct: score,                                          cls: 'cyan' },
    { label: 'High Priority',   pct: highPri ? Math.round(highDone/highPri*100) : 0, cls: 'amber' },
    { label: 'In Progress',     pct: total   ? Math.round(inProg/total*100) : 0,     cls: 'purple' },
    { label: 'On Track (no overdue)', pct: total ? Math.round((total-overdue)/total*100) : 100, cls: 'green' },
    { label: 'Pending',         pct: total   ? Math.round(pending/total*100) : 0,    cls: 'rose' },
  ];
  const levelsHTML = `<div class="productivity-levels">
    <div class="level-badge ${score>=0&&total>0?'active':'inactive'}" id="lvlBeginner">Getting Started</div>
    <div class="level-badge ${score>=40?'active':'inactive'}" id="lvlIntermediate">In Progress</div>
    <div class="level-badge ${score>=80?'active':'upcoming'}" id="lvlMaster">High Performer</div>
  </div>`;
  document.getElementById('productivityBreakdown').innerHTML =
    bars.map(b => `
      <div class="productivity-item">
        <span class="pi-label">${b.label}</span>
        <div class="pi-bar"><div class="pi-fill ${b.cls}" style="width:${b.pct}%"></div></div>
        <span class="pi-val">${b.pct}%</span>
      </div>`).join('') + levelsHTML;
  animateProductivityCircle();
}
function animateProductivityCircle() {
  const circle  = document.getElementById('productivityCircle');
  const scoreEl = document.getElementById('productivityScore');
  if (!circle) return;
  const score       = parseInt(circle.dataset.score || '0', 10);
  const circumference = 2 * Math.PI * 84;
  const offset      = circumference * (1 - score / 100);
  circle.style.stroke = 'url(#circleGrad)';
  setTimeout(() => { circle.style.strokeDashoffset = offset; }, 100);
  animateCounter(scoreEl, score, 900);
}
function getFiltered() {
  return taskStore.getAll().filter(t => {
    const effStatus = getEffectiveStatus(t);
    const matchStatus   = tableStatus === 'all' || effStatus === tableStatus;
    const matchCat      = tableCategory === 'all' || t.category === tableCategory;
    const matchPriority = tablePriority === 'all' || t.priority === tablePriority;
    const matchSearch   = !tableSearch || t.title.toLowerCase().includes(tableSearch) || (t.description||'').toLowerCase().includes(tableSearch) || t.category.toLowerCase().includes(tableSearch);
    return matchStatus && matchCat && matchPriority && matchSearch;
  }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
function updateTaskTable() {
  const filtered   = getFiltered();
  const total      = taskStore.getAll().length;
  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  tablePage        = Math.min(tablePage, totalPages);
  const slice      = filtered.slice((tablePage - 1) * perPage, tablePage * perPage);
  const tbody      = document.getElementById('taskTableBody');
  document.getElementById('taskSectionTag').textContent = `${total} task${total!==1?'s':''}`;
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">${total===0?'No tasks yet':'No tasks match your filters'}</div><div class="empty-desc">${total===0?'Create your first task to get started.':'Try adjusting the search or filters.'}</div>${total===0?'<button class="btn-primary-sm" onclick="openTaskModal()">Create First Task</button>':''}</div></td></tr>`;
    document.getElementById('pageInfo').textContent = 'Page 0 of 0';
    document.getElementById('prevPage').disabled = true;
    document.getElementById('nextPage').disabled = true;
    return;
  }
  tbody.innerHTML = slice.map((t, i) => {
    const effStatus  = getEffectiveStatus(t);
    const statusCls  = effStatus.replace(' ', '-');
    const daysUntil  = t.dueDate ? getDaysUntil(t.dueDate) : null;
    const dueFmt     = t.dueDate ? formatDueDate(t.dueDate) : '—';
    const rowNum     = (tablePage - 1) * perPage + i + 1;
    return `
      <tr>
        <td>${rowNum}</td>
        <td><div class="task-name-cell"><span>${escapeHTML(t.title)}</span>${t.description?`<span class="task-desc-preview">${escapeHTML(t.description)}</span>`:''}</div></td>
        <td><span class="cat-tag" style="background:${COLOR_HEX[getCatColor(t.category)]}18;color:${COLOR_HEX[getCatColor(t.category)]};border:1px solid ${COLOR_HEX[getCatColor(t.category)]}33">${escapeHTML(t.category)}</span></td>
        <td><span class="priority-badge priority-${t.priority}">${t.priority}</span></td>
        <td style="font-family:var(--font-mono);font-size:0.78rem;${daysUntil!==null&&daysUntil<0&&effStatus!=='Completed'?'color:var(--rose)':''}">${dueFmt}</td>
        <td><span class="status-badge status-${statusCls}">${effStatus}</span></td>
        <td><div class="table-actions">
          ${effStatus!=='Completed'?`<button class="btn-edit-sm" onclick="markComplete('${t.id}')" title="Mark complete">✓</button>`:''}
          <button class="btn-edit-sm" onclick="openTaskModal('${t.id}')" title="Edit">✎</button>
          <button class="btn-danger-sm" onclick="confirmDelete('${t.id}')" title="Delete">✕</button>
        </div></td>
      </tr>`;
  }).join('');
  document.getElementById('pageInfo').textContent     = `Page ${tablePage} of ${totalPages}`;
  document.getElementById('prevPage').disabled        = tablePage <= 1;
  document.getElementById('nextPage').disabled        = tablePage >= totalPages;
}
document.getElementById('taskSearch').addEventListener('input', e => { tableSearch = e.target.value.toLowerCase(); tablePage = 1; updateTaskTable(); });
document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tableStatus = btn.dataset.filter;
    tablePage = 1; updateTaskTable();
  });
});
document.getElementById('categoryFilter').addEventListener('change', e => { tableCategory = e.target.value; tablePage = 1; updateTaskTable(); });
document.getElementById('priorityFilter').addEventListener('change', e => { tablePriority = e.target.value; tablePage = 1; updateTaskTable(); });
document.getElementById('prevPage').addEventListener('click', () => { tablePage--; updateTaskTable(); });
document.getElementById('nextPage').addEventListener('click', () => { tablePage++; updateTaskTable(); });
function updateCategoryFilter(tasks) {
  const cats = [...new Set(tasks.map(t => t.category))].sort();
  const sel  = document.getElementById('categoryFilter');
  const cur  = sel.value;
  sel.innerHTML = `<option value="all">All Categories</option>` + cats.map(c => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('');
  if (cats.includes(cur)) sel.value = cur;
}
function updateDeadlines(tasks) {
  const grid = document.getElementById('deadlinesGrid');
  const withDue = tasks
    .filter(t => t.dueDate && t.status !== 'Completed')
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 8);
  document.getElementById('deadlineTag').textContent = withDue.length ? `${withDue.length} upcoming` : 'From task due dates';
  if (withDue.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">◷</div><div class="empty-title">No upcoming deadlines</div><div class="empty-desc">Tasks with due dates will appear here.</div><button class="btn-primary-sm" onclick="openTaskModal()">Create Task</button></div>`;
    return;
  }
  grid.innerHTML = withDue.map(t => {
    const days  = getDaysUntil(t.dueDate);
    const urgency = days < 0 ? 'urgent' : days <= 3 ? 'urgent' : days <= 7 ? 'soon' : '';
    const timerCls = days < 0 ? 'overdue' : days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'ok';
    const timerText = days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today!' : `${days}d left`;
    const color = getCatColor(t.category);
    return `
      <article class="deadline-card ${urgency}">
        <div class="deadline-info">
          <div class="deadline-title">${escapeHTML(t.title)}</div>
          <div class="deadline-meta">
            <span>${formatDueDate(t.dueDate)}</span>
            <span class="cat-tag" style="background:${COLOR_HEX[color]}18;color:${COLOR_HEX[color]}">${escapeHTML(t.category)}</span>
          </div>
        </div>
        <span class="priority-badge priority-${t.priority}">${t.priority}</span>
        <span class="deadline-timer ${timerCls}">${timerText}</span>
      </article>`;
  }).join('');
}
const BADGE_DEFS = [
  { id:'first_task',    icon:'🚀', color:'',       name:'First Step',        desc:'Created your first task.',                 req: t => t.length >= 1,           prog: t => ({ cur: t.length, max: 1 }) },
  { id:'5_completed',   icon:'⭐', color:'amber',  name:'5 Done',            desc:'Completed 5 tasks.',                       req: t => t.filter(x=>x.status==='Completed').length >= 5,  prog: t => ({ cur: t.filter(x=>x.status==='Completed').length, max: 5 }) },
  { id:'10_completed',  icon:'🔥', color:'',       name:'10 Done',           desc:'Completed 10 tasks.',                      req: t => t.filter(x=>x.status==='Completed').length >= 10, prog: t => ({ cur: t.filter(x=>x.status==='Completed').length, max: 10 }) },
  { id:'25_completed',  icon:'💎', color:'purple', name:'25 Done',           desc:'Completed 25 tasks — you\'re on a roll!',  req: t => t.filter(x=>x.status==='Completed').length >= 25, prog: t => ({ cur: t.filter(x=>x.status==='Completed').length, max: 25 }) },
  { id:'50_completed',  icon:'🏆', color:'green',  name:'50 Done',           desc:'Completed 50 tasks. True productivity!',   req: t => t.filter(x=>x.status==='Completed').length >= 50, prog: t => ({ cur: t.filter(x=>x.status==='Completed').length, max: 50 }) },
];
const earnedBadgesSeen = new Set(JSON.parse(localStorage.getItem('dt_badges_seen') || '[]'));
function updateBadges(tasks) {
  const grid = document.getElementById('badgesGrid');
  let earned = 0;
  grid.innerHTML = BADGE_DEFS.map(b => {
    const isEarned = b.req(tasks);
    const { cur, max } = b.prog(tasks);
    const pct = Math.min(100, Math.round(cur / max * 100));
    if (isEarned) earned++;
    if (isEarned && !earnedBadgesSeen.has(b.id)) {
      earnedBadgesSeen.add(b.id);
      localStorage.setItem('dt_badges_seen', JSON.stringify([...earnedBadgesSeen]));
      setTimeout(() => showToast(`🏅 Badge unlocked: ${b.name}!`), 300);
    }
    if (isEarned) {
      return `<article class="badge-card earned">
        <div class="badge-glow ${b.color}"></div>
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
        <div class="badge-earned-label">✓ Earned</div>
      </article>`;
    } else {
      return `<article class="badge-card locked">
        <div class="badge-icon muted">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
        <div class="badge-progress-wrap">
          <div class="badge-prog"><div class="badge-prog-fill" data-target="${pct}" style="width:${pct}%"></div></div>
          <span class="badge-prog-label">${cur} / ${max}</span>
        </div>
      </article>`;
    }
  }).join('');
  document.getElementById('badgeSectionTag').textContent = `${earned} / ${BADGE_DEFS.length} earned`;
}
function updateAnalyticsSidebar(tasks) {
  const total     = tasks.length;
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const rate      = total ? Math.round(completed / total * 100) : 0;
  const catCount = {};
  tasks.forEach(t => { catCount[t.category] = (catCount[t.category]||0)+1; });
  const mostActive = Object.entries(catCount).sort((a,b)=>b[1]-a[1])[0];
  const highPending = tasks.filter(t => t.priority === 'High' && t.status !== 'Completed').length;
  const now = new Date(); now.setHours(0,0,0,0);
  const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
  const dueThisWeek = tasks.filter(t => {
    if (!t.dueDate || t.status === 'Completed') return false;
    const d = new Date(t.dueDate + 'T00:00:00');
    return d >= now && d <= weekEnd;
  }).length;
  document.getElementById('asCompletionRate').textContent = `${rate}%`;
  document.getElementById('asMostActive').textContent     = mostActive ? mostActive[0] : '—';
  document.getElementById('asHighPriority').textContent   = highPending;
  document.getElementById('asDueThisWeek').textContent    = dueThisWeek;
}
function buildChart() {
  const chartArea   = document.getElementById('chartArea');
  const chartLabels = document.getElementById('chartLabels');
  if (!chartArea || !chartLabels) return;
  chartArea.dataset.built = '';
  const tasks = taskStore.getAll();
  const days  = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
    days.push(d);
  }
  const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const data = days.map(d => {
    const ds = d.toISOString().slice(0,10);
    const created   = tasks.filter(t => t.createdAt && t.createdAt.slice(0,10) === ds).length;
    const completed = tasks.filter(t => t.status === 'Completed' && (t.updatedAt||t.createdAt||'').slice(0,10) === ds).length;
    return { label: DAY_NAMES[d.getDay()], created, completed };
  });
  const maxVal = Math.max(1, ...data.map(d => Math.max(d.created, d.completed)));
  chartArea.innerHTML   = '';
  chartLabels.innerHTML = '';
  data.forEach(d => {
    const pctC = (d.created   / maxVal) * 100;
    const pctD = (d.completed / maxVal) * 100;
    const grp  = document.createElement('div');
    grp.className = 'chart-bar-group';
    grp.innerHTML = `
      <div class="chart-bar created"   style="height:0%" data-final="${pctC}%" data-val="${d.created} created"></div>
      <div class="chart-bar completed" style="height:0%" data-final="${pctD}%" data-val="${d.completed} done"></div>`;
    chartArea.appendChild(grp);
    const lbl = document.createElement('div');
    lbl.className = 'chart-label'; lbl.textContent = d.label;
    chartLabels.appendChild(lbl);
  });
  setTimeout(() => {
    chartArea.querySelectorAll('.chart-bar').forEach((bar, i) => {
      setTimeout(() => { bar.style.height = bar.dataset.final; }, i * 50);
    });
  }, 100);
}
document.getElementById('taskModal').addEventListener('click', function(e) {
  if (e.target === this) closeTaskModal();
});
document.getElementById('confirmOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeConfirm();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeTaskModal(); closeConfirm(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openTaskModal(); }
});
refreshAll();