const API_URL = '/api/tasks';

const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const taskForm = document.getElementById('task-form');
const formMessage = document.getElementById('form-message');
const submitBtn = document.getElementById('submit-btn');

const editOverlay = document.getElementById('modal-overlay');
const editForm = document.getElementById('edit-form');
const editFormMessage = document.getElementById('edit-form-message');
const cancelEditBtn = document.getElementById('cancel-edit');

let tasks = [];
let currentFilter = 'all';

// ---------- Helpers ----------
function clearFieldErrors(prefix = '') {
  document.querySelectorAll(`[id^="${prefix}error-"]`).forEach((el) => (el.textContent = ''));
}

function showFieldErrors(errors, prefix = '') {
  // Map known error substrings to fields
  errors.forEach((msg) => {
    let target = `${prefix}error-title`;
    if (/description/i.test(msg)) target = `${prefix}error-description`;
    else if (/due date/i.test(msg)) target = `${prefix}error-dueDate`;
    else if (/priority/i.test(msg)) target = `${prefix}error-title`; // fallback
    const el = document.getElementById(target);
    if (el) el.textContent = msg;
  });
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isOverdue(dateStr, status) {
  if (!dateStr || status === 'completed') return false;
  const due = new Date(dateStr + 'T23:59:59');
  return due.getTime() < Date.now();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ---------- API calls ----------
async function fetchTasks() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error('Failed to load tasks');
  return res.json();
}

async function createTask(payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error('Validation failed');
    err.errors = data.errors || ['Something went wrong.'];
    throw err;
  }
  return data;
}

async function updateTask(id, payload) {
  const res = await fetch(`${API_URL}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error('Validation failed');
    err.errors = data.errors || ['Something went wrong.'];
    throw err;
  }
  return data;
}

async function deleteTask(id) {
  const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete task');
  return res.json();
}

// ---------- Rendering ----------
function render() {
  const filtered = tasks.filter((t) => {
    if (currentFilter === 'all') return true;
    return t.status === currentFilter;
  });

  taskListEl.innerHTML = '';

  if (filtered.length === 0) {
    emptyStateEl.hidden = false;
    if (tasks.length === 0) {
      emptyStateEl.querySelector('.empty-title').textContent = 'Nothing here yet.';
      emptyStateEl.querySelector('.empty-sub').textContent = 'Add a task above to get started.';
    } else {
      emptyStateEl.querySelector('.empty-title').textContent = 'No matching tasks.';
      emptyStateEl.querySelector('.empty-sub').textContent = 'Try a different filter.';
    }
    return;
  }
  emptyStateEl.hidden = true;

  // Sort: pending first, then by due date (soonest first, no-date last), then priority
  const priorityRank = { high: 0, medium: 1, low: 2 };
  const sorted = [...filtered].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'completed' ? 1 : -1;
    const aDate = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bDate = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    return priorityRank[a.priority] - priorityRank[b.priority];
  });

  sorted.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item priority-${task.priority} ${task.status === 'completed' ? 'completed' : ''}`;
    li.dataset.id = task.id;

    const overdue = isOverdue(task.dueDate, task.status);
    const dueLabel = task.dueDate
      ? `<span class="${overdue ? 'due-overdue' : ''}">${overdue ? 'Overdue · ' : 'Due '}${formatDate(task.dueDate)}</span>`
      : '';

    li.innerHTML = `
      <input type="checkbox" class="task-checkbox" ${task.status === 'completed' ? 'checked' : ''} aria-label="Mark task complete" />
      <div class="task-body">
        <p class="task-title">${escapeHtml(task.title)}</p>
        ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
        <div class="task-meta">
          ${dueLabel}
          <span>${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} priority</span>
        </div>
      </div>
      <div class="task-actions">
        <button class="icon-btn edit" title="Edit task" aria-label="Edit task">✎</button>
        <button class="icon-btn delete" title="Delete task" aria-label="Delete task">✕</button>
      </div>
    `;

    taskListEl.appendChild(li);
  });
}

// ---------- Event handlers ----------
async function loadAndRender() {
  try {
    tasks = await fetchTasks();
    render();
  } catch (e) {
    formMessage.textContent = 'Could not load tasks. Is the server running?';
  }
}

taskForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors();
  formMessage.textContent = '';
  formMessage.className = 'form-message';

  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const dueDate = document.getElementById('dueDate').value;
  const priority = document.getElementById('priority').value;

  // Client-side validation
  const errors = [];
  if (!title.trim()) errors.push('Title is required and cannot be empty.');
  if (errors.length) {
    showFieldErrors(errors);
    return;
  }

  submitBtn.disabled = true;
  try {
    await createTask({ title, description, dueDate: dueDate || null, priority, status: 'pending' });
    taskForm.reset();
    document.getElementById('priority').value = 'medium';
    formMessage.textContent = 'Task added.';
    formMessage.className = 'form-message success';
    await loadAndRender();
    setTimeout(() => {
      formMessage.textContent = '';
    }, 2000);
  } catch (err) {
    showFieldErrors(err.errors || ['Something went wrong.']);
  } finally {
    submitBtn.disabled = false;
  }
});

taskListEl.addEventListener('click', async (e) => {
  const li = e.target.closest('.task-item');
  if (!li) return;
  const id = li.dataset.id;
  const task = tasks.find((t) => t.id === id);
  if (!task) return;

  if (e.target.classList.contains('task-checkbox')) {
    const newStatus = e.target.checked ? 'completed' : 'pending';
    try {
      await updateTask(id, { status: newStatus });
      await loadAndRender();
    } catch (err) {
      e.target.checked = !e.target.checked;
    }
  } else if (e.target.classList.contains('edit')) {
    openEditModal(task);
  } else if (e.target.classList.contains('delete')) {
    if (confirm(`Delete "${task.title}"? This can't be undone.`)) {
      await deleteTask(id);
      await loadAndRender();
    }
  }
});

document.querySelectorAll('.filter-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

// ---------- Edit modal ----------
function openEditModal(task) {
  document.getElementById('edit-id').value = task.id;
  document.getElementById('edit-title').value = task.title;
  document.getElementById('edit-description').value = task.description || '';
  document.getElementById('edit-dueDate').value = task.dueDate || '';
  document.getElementById('edit-priority').value = task.priority;
  editFormMessage.textContent = '';
  clearFieldErrors('edit-');
  editOverlay.hidden = false;
  document.getElementById('edit-title').focus();
}

function closeEditModal() {
  editOverlay.hidden = true;
}

cancelEditBtn.addEventListener('click', closeEditModal);
editOverlay.addEventListener('click', (e) => {
  if (e.target === editOverlay) closeEditModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editOverlay.hidden) closeEditModal();
});

editForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFieldErrors('edit-');
  editFormMessage.textContent = '';

  const id = document.getElementById('edit-id').value;
  const title = document.getElementById('edit-title').value;
  const description = document.getElementById('edit-description').value;
  const dueDate = document.getElementById('edit-dueDate').value;
  const priority = document.getElementById('edit-priority').value;

  if (!title.trim()) {
    showFieldErrors(['Title is required and cannot be empty.'], 'edit-');
    return;
  }

  try {
    await updateTask(id, { title, description, dueDate: dueDate || null, priority });
    closeEditModal();
    await loadAndRender();
  } catch (err) {
    showFieldErrors(err.errors || ['Something went wrong.'], 'edit-');
  }
});

// ---------- Init ----------
loadAndRender();
