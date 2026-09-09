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
  taskList.innerHTML = tasks.map((task) => `
    <tr>
      <td><span class="signal-name"><strong>${escapeHtml(task.title)}</strong><span>${escapeHtml(task.id)} / ${escapeHtml(task.category)}</span></span></td>
      <td>${escapeHtml(task.owner)}</td>
      <td><span class="priority ${escapeHtml(task.priority)}">${escapeHtml(task.priority)}</span></td>
      <td><span class="state ${escapeHtml(task.status)}">${escapeHtml(task.status.replace('-', ' '))}</span></td>
      <td><button class="complete-button" type="button" data-complete="${escapeHtml(task.id)}" ${task.status === 'completed' ? 'disabled' : ''}>${task.status === 'completed' ? 'Done' : 'Resolve'}</button></td>
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
  } catch (error) {
    showToast(error.message);
  }
};

const openComposer = () => {
  composer.classList.add('open');
  composer.querySelector('input').focus();
};
const closeComposer = () => composer.classList.remove('open');
document.querySelector('[data-open-form]').addEventListener('click', openComposer);
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
  const button = event.target.closest('[data-complete]');
  if (!button) return;
  button.disabled = true;
  try {
    await apiRequest(`/api/tasks/${button.dataset.complete}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
    showToast('Signal resolved with HTTP 200.');
    await Promise.all([loadTasks(), loadStats()]);
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
  formFeedback.textContent = 'Transmitting...';
  try {
    const payload = await apiRequest('/api/tasks', { method: 'POST', body: JSON.stringify({ ...data, status: 'queued' }) });
    formFeedback.textContent = `Created ${payload.data.id} with HTTP 201.`;
    showToast('Signal created successfully.');
    taskForm.reset();
    await Promise.all([loadTasks(), loadStats()]);
    if (window.innerWidth < 1100) setTimeout(closeComposer, 700);
  } catch (error) {
    formFeedback.textContent = error.message;
  }
});

refreshButton.addEventListener('click', async () => {
  refreshButton.disabled = true;
  await Promise.all([loadTasks(), loadStats()]);
  refreshButton.disabled = false;
  showToast('Dashboard synchronized.');
});

document.querySelector('[data-date]').textContent = new Intl.DateTimeFormat('en', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date());
Promise.all([loadTasks(), loadStats()]);
