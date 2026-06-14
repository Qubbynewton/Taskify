const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Use Netlify Blobs or in-memory storage (Blobs not available on free tier by default)
// For now, we'll use environment-based storage
let tasksCache = [];

const DB_FILE = path.join(__dirname, '../../db/tasks.json');

// ---------- Data layer ----------
function loadTasks() {
  if (!fs.existsSync(DB_FILE)) return [];
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return raw.trim() ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to read DB file:', e);
    return [];
  }
}

function saveTasks(tasks) {
  // Ensure directory exists
  const dbDir = path.dirname(DB_FILE);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(tasks, null, 2));
}

// ---------- Validation ----------
const VALID_PRIORITIES = ['low', 'medium', 'high'];

function validateTask(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.title !== undefined) {
    if (!data.title || typeof data.title !== 'string' || !data.title.trim()) {
      errors.push('Title is required and cannot be empty.');
    } else if (data.title.length > 200) {
      errors.push('Title must be 200 characters or fewer.');
    }
  }

  if (data.description !== undefined && data.description !== null) {
    if (typeof data.description !== 'string') {
      errors.push('Description must be a string.');
    } else if (data.description.length > 2000) {
      errors.push('Description must be 2000 characters or fewer.');
    }
  }

  if (data.dueDate !== undefined && data.dueDate !== null && data.dueDate !== '') {
    const d = new Date(data.dueDate);
    if (isNaN(d.getTime())) {
      errors.push('Due date must be a valid date (YYYY-MM-DD).');
    }
  }

  if (data.priority !== undefined && data.priority !== null && data.priority !== '') {
    if (!VALID_PRIORITIES.includes(data.priority)) {
      errors.push(`Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    }
  }

  if (data.status !== undefined && data.status !== null && data.status !== '') {
    if (!['pending', 'completed'].includes(data.status)) {
      errors.push('Status must be either "pending" or "completed".');
    }
  }

  return errors;
}

// ---------- Netlify Function Handler ----------
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers,
      body: '',
    };
  }

  const path = event.path.split('?')[0];
  const parts = path.split('/').filter(Boolean); // ['api', maybe 'tasks', maybe id]

  try {
    // GET /api/tasks
    if (event.httpMethod === 'GET' && parts[1] === 'tasks' && parts.length === 2) {
      const tasks = loadTasks();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(tasks),
      };
    }

    // POST /api/tasks
    if (event.httpMethod === 'POST' && parts[1] === 'tasks' && parts.length === 2) {
      let body;
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ errors: ['Invalid JSON body'] }),
        };
      }

      const errors = validateTask(body, false);
      if (errors.length) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ errors }),
        };
      }

      const tasks = loadTasks();
      const newTask = {
        id: crypto.randomUUID(),
        title: body.title.trim(),
        description: (body.description || '').trim(),
        dueDate: body.dueDate || null,
        priority: body.priority || 'medium',
        status: body.status || 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      tasks.push(newTask);
      saveTasks(tasks);
      return {
        statusCode: 201,
        headers,
        body: JSON.stringify(newTask),
      };
    }

    // PUT /api/tasks/:id
    if (event.httpMethod === 'PUT' && parts[1] === 'tasks' && parts.length === 3) {
      const id = parts[2];
      let body;
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ errors: ['Invalid JSON body'] }),
        };
      }

      const errors = validateTask(body, true);
      if (errors.length) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ errors }),
        };
      }

      const tasks = loadTasks();
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ errors: ['Task not found.'] }),
        };
      }

      const existing = tasks[idx];
      const updated = {
        ...existing,
        title: body.title !== undefined ? body.title.trim() : existing.title,
        description: body.description !== undefined ? body.description.trim() : existing.description,
        dueDate: body.dueDate !== undefined ? body.dueDate : existing.dueDate,
        priority: body.priority !== undefined ? body.priority : existing.priority,
        status: body.status !== undefined ? body.status : existing.status,
        updatedAt: new Date().toISOString(),
      };
      tasks[idx] = updated;
      saveTasks(tasks);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(updated),
      };
    }

    // DELETE /api/tasks/:id
    if (event.httpMethod === 'DELETE' && parts[1] === 'tasks' && parts.length === 3) {
      const id = parts[2];
      const tasks = loadTasks();
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) {
        return {
          statusCode: 404,
          headers,
          body: JSON.stringify({ errors: ['Task not found.'] }),
        };
      }
      const [removed] = tasks.splice(idx, 1);
      saveTasks(tasks);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(removed),
      };
    }

    // Not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ errors: ['Route not found.'] }),
    };
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ errors: ['Internal server error.'] }),
    };
  }
};
