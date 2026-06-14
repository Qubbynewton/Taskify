const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 8080;
const DB_FILE = path.join(__dirname, 'db', 'tasks.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

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

// ---------- HTTP helpers ----------
function sendJSON(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

// ---------- Static file serving ----------
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
};

function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, decodeURIComponent(filePath.split('?')[0]));

  // Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(content);
  });
}

// ---------- Route handlers ----------
async function handleApi(req, res, pathname) {
  const parts = pathname.split('/').filter(Boolean); // ['api','tasks', maybe id]

  // GET /api/tasks
  if (req.method === 'GET' && parts.length === 2) {
    const tasks = loadTasks();
    return sendJSON(res, 200, tasks);
  }

  // POST /api/tasks
  if (req.method === 'POST' && parts.length === 2) {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJSON(res, 400, { errors: [e.message] });
    }

    const errors = validateTask(body, false);
    if (errors.length) {
      return sendJSON(res, 400, { errors });
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
    return sendJSON(res, 201, newTask);
  }

  // PUT /api/tasks/:id
  if (req.method === 'PUT' && parts.length === 3) {
    const id = parts[2];
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJSON(res, 400, { errors: [e.message] });
    }

    const errors = validateTask(body, true);
    if (errors.length) {
      return sendJSON(res, 400, { errors });
    }

    const tasks = loadTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      return sendJSON(res, 404, { errors: ['Task not found.'] });
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
    return sendJSON(res, 200, updated);
  }

  // DELETE /api/tasks/:id
  if (req.method === 'DELETE' && parts.length === 3) {
    const id = parts[2];
    const tasks = loadTasks();
    const idx = tasks.findIndex((t) => t.id === id);
    if (idx === -1) {
      return sendJSON(res, 404, { errors: ['Task not found.'] });
    }
    const [removed] = tasks.splice(idx, 1);
    saveTasks(tasks);
    return sendJSON(res, 200, removed);
  }

  return sendJSON(res, 404, { errors: ['Route not found.'] });
}

// ---------- Server ----------
const server = http.createServer(async (req, res) => {
  const pathname = req.url.split('?')[0];

  if (req.method === 'OPTIONS') {
    return sendJSON(res, 204, {});
  }

  if (pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, pathname);
    } catch (e) {
      console.error(e);
      sendJSON(res, 500, { errors: ['Internal server error.'] });
    }
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Taskify server running at http://localhost:${PORT}`);
});
