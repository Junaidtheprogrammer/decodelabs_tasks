'use strict';

const taskList = document.querySelector('[data-task-list]');
const resultCount = document.querySelector('[data-result-count]');
const emptyState = document.querySelector('[data-empty]');
const searchInput = document.querySelector('[data-search]');
const statusFilter = document.querySelector('[data-status-filter]');
const taskForm = document.querySelector('[data-task-form]');
const composer = document.querySelector('[data-composer]');
const formFeedback = document.querySelector('[data-form-feedback]');
const toast = document.querySelector('[data-toast]');
const refreshButton = document.querySelector('[data-refresh]');
let toastTimer;
let editingId = null;
let taskCache = [];

const escapeHtml = (value) => String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

const apiRequest = async (url, options = {}) => {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  document.querySelector('[data-latency]').textContent = Math.max(1, Math.round(performance.now() - startedAt));
  if (response.status === 204) return null;
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error?.details?.[0]?.message || payload.error?.message || 'Request failed.');
  return payload;
};

const showToast = (message) => {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
};

const renderTasks = (tasks) => {
  taskCache = tasks;
  taskList.innerHTML = tasks.map((task) => `
    <tr>
      <td><span class="signal-name"><strong>${escapeHtml(task.title)}</strong><span title="${escapeHtml(task.id)}">${escapeHtml(task.id.slice(0,12))} / ${escapeHtml(task.category)}</span></span></td>
      <td>${escapeHtml(task.owner)}</td>
      <td><span class="priority ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span></td>
      <td><span class="state ${escapeHtml(task.status)}">${escapeHtml(task.status.replace('-', ' '))}</span></td>
      <td><button class="complete-button" type="button" data-edit="${escapeHtml(task.id)}" aria-label="Edit ${escapeHtml(task.title)}">Edit</button> <button class="complete-button" type="button" data-delete="${escapeHtml(task.id)}" aria-label="Delete ${escapeHtml(task.title)}">Delete</button></td>
    </tr>`).join('');
  resultCount.textContent = `${tasks.length} ${tasks.length === 1 ? 'signal' : 'signals'} returned`;
  emptyState.hidden = tasks.length !== 0;
};

const loadTasks = async () => {
  const query = new URLSearchParams();
  if (statusFilter.value) query.set('status', statusFilter.value);
  if (searchInput.value.trim()) query.set('search', searchInput.value.trim());
  try {
    const payload = await apiRequest(`/api/tasks?${query}`);
    renderTasks(payload.data);
  } catch (error) {
    taskList.innerHTML = '';
    resultCount.textContent = 'Unable to load signals';
    showToast(error.message);
  }
};

const loadStats = async () => {
  try {
    const payload = await apiRequest('/api/stats');
    const score = payload.data.completionRate;
    document.querySelector('[data-completion]').textContent = `${score}%`;
    document.querySelector('[data-completion-ring]').style.setProperty('--score', `${score * 3.6}deg`);
    document.querySelector('[data-total]').textContent = payload.data.total;
    document.querySelector('[data-writes]').textContent = payload.data.writes;
  } catch (error) {
    showToast(error.message);
  }
};

const openComposer = () => {
  composer.classList.add('open');
  composer.querySelector('input').focus();
};
const closeComposer = () => composer.classList.remove('open');
const resetEditor = () => {
  editingId = null; taskForm.reset(); formFeedback.textContent = '';
  document.querySelector('#composer-title').textContent = 'Create signal';
  document.querySelector('[data-save-label]').textContent = 'Save signal';
  document.querySelector('[data-cancel-edit]').hidden = true;
};
document.querySelector('[data-cancel-edit]').addEventListener('click', resetEditor);
document.querySelector('[data-open-form]').addEventListener('click', () => { resetEditor(); openComposer(); });
document.querySelector('[data-close-form]').addEventListener('click', closeComposer);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && composer.classList.contains('open')) closeComposer();
});

let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadTasks, 220);
});
statusFilter.addEventListener('change', loadTasks);

taskList.addEventListener('click', async (event) => {
  const edit = event.target.closest('[data-edit]');
  if(edit) {
    const task = taskCache.find(t => t.id === edit.dataset.edit);
    editingId = task.id;
    for(const key of ['title','owner','priority','category','status']) taskForm.elements[key].value = task[key];
    document.querySelector('#composer-title').textContent = 'Edit signal';
    document.querySelector('[data-save-label]').textContent = 'Save changes';
    document.querySelector('[data-cancel-edit]').hidden = false;
    formFeedback.textContent = ''; openComposer(); return;
  }
  const button = event.target.closest('[data-delete]');
  if (!button) return;
  if (!confirm('Delete this saved signal? Its activity history will be retained.')) return;
  button.disabled = true;
  try {
    await apiRequest(`/api/tasks/${button.dataset.delete}`, { method: 'DELETE' });
    if(editingId === button.dataset.delete) resetEditor();
    showToast('Signal deleted from the database.');
    await refreshAll();
  } catch (error) {
    button.disabled = false;
    showToast(error.message);
  }
});

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!taskForm.checkValidity()) {
    taskForm.reportValidity();
    return;
  }
  const data = Object.fromEntries(new FormData(taskForm));
  const submit = taskForm.querySelector('[type="submit"]');
  submit.disabled = true;
  formFeedback.textContent = 'Saving...';
  try {
    await apiRequest(editingId ? `/api/tasks/${editingId}` : '/api/tasks', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(data) });
    resetEditor();
    formFeedback.textContent = 'Saved to the database.';
    showToast('Changes saved successfully.');
    await refreshAll();
    if (window.innerWidth < 1100) setTimeout(closeComposer, 700);
  } catch (error) {
    formFeedback.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

refreshButton.addEventListener('click', async () => {
  refreshButton.disabled = true;
  await refreshAll();
  refreshButton.disabled = false;
  showToast('Dashboard synchronized.');
});

document.querySelector('[data-date]').textContent = new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date());
async function loadActivity() {
  try {
    const {data} = await apiRequest('/api/activity');
    document.querySelector('[data-activity-list]').innerHTML = data.length ? data.map(a => `<li><span class="activity-icon get">${escapeHtml(a.action[0].toUpperCase())}</span><div><strong>${escapeHtml(a.title)}</strong><span>Signal ${escapeHtml(a.action)}</span></div><time datetime="${escapeHtml(a.createdAt)}">${escapeHtml(new Date(a.createdAt).toLocaleString())}</time></li>`).join('') : '<li>No changes yet. Create your first signal to get started.</li>';
  } catch(error) { showToast(error.message); }
}
async function loadHealth() {
  try {
    await apiRequest('/api/health');
    document.querySelector('[data-connection]').textContent = 'Database online';
    document.querySelector('[data-db-state]').textContent = 'Connected';
  } catch {
    document.querySelector('[data-connection]').textContent = 'Database offline';
    document.querySelector('[data-db-state]').textContent = 'Offline';
  }
}
function refreshAll() { return Promise.all([loadTasks(),loadStats(),loadActivity(),loadHealth()]); }
refreshAll();
