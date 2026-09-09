'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const PORT = Number(process.env.PORT) || 4300;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_BODY_BYTES = 32 * 1024;
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

const seedTasks = [
  {
    id: 'sig-1042',
    title: 'Review authentication flow',
    owner: 'Maya Chen',
    status: 'in-progress',
    priority: 'high',
    category: 'Security',
    createdAt: '2026-09-05T09:20:00.000Z'
  },
  {
    id: 'sig-1041',
    title: 'Document task endpoints',
    owner: 'Owen Reed',
    status: 'completed',
    priority: 'medium',
    category: 'Docs',
    createdAt: '2026-09-04T14:15:00.000Z'
  },
  {
    id: 'sig-1040',
    title: 'Validate incoming payloads',
    owner: 'Noah Silva',
    status: 'in-progress',
    priority: 'high',
    category: 'API',
    createdAt: '2026-09-04T10:40:00.000Z'
  },
  {
    id: 'sig-1039',
    title: 'Design empty-state response',
    owner: 'Aisha Khan',
    status: 'queued',
    priority: 'low',
    category: 'UX',
    createdAt: '2026-09-03T16:05:00.000Z'
  },
  {
    id: 'sig-1038',
    title: 'Add request correlation IDs',
    owner: 'Maya Chen',
    status: 'completed',
    priority: 'medium',
    category: 'Reliability',
    createdAt: '2026-09-03T08:35:00.000Z'
  }
];

let tasks = structuredClone(seedTasks);
const requestBuckets = new Map();

const json = (res, status, payload, requestId, extraHeaders = {}) => {
  const body = payload === null ? '' : JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Request-Id': requestId,
    ...extraHeaders
  });
  res.end(body);
};

const errorResponse = (res, status, code, message, requestId, details) => {
  json(res, status, {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId
    }
  }, requestId);
};

const applySecurityHeaders = (res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'");
};

const applyCors = (req, res) => {
  const origin = req.headers.origin;
  if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id');
};

const checkRateLimit = (req, res, requestId) => {
  const key = req.socket.remoteAddress || 'local';
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  const current = !bucket || now - bucket.startedAt >= RATE_WINDOW_MS
    ? { startedAt: now, count: 1 }
    : { ...bucket, count: bucket.count + 1 };
  requestBuckets.set(key, current);
  const remaining = Math.max(0, RATE_LIMIT - current.count);
  res.setHeader('X-RateLimit-Limit', String(RATE_LIMIT));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  if (current.count > RATE_LIMIT) {
    errorResponse(res, 429, 'RATE_LIMITED', 'Too many requests. Try again shortly.', requestId);
    return false;
  }
  return true;
};

const readBody = (req) => new Promise((resolve, reject) => {
  let body = '';
  let size = 0;
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    size += Buffer.byteLength(chunk);
    if (size > MAX_BODY_BYTES) {
      reject(Object.assign(new Error('Payload too large.'), { status: 413, code: 'PAYLOAD_TOO_LARGE' }));
      req.destroy();
      return;
    }
    body += chunk;
  });
  req.on('end', () => {
    if (!body) return resolve({});
    try {
      resolve(JSON.parse(body));
    } catch {
      reject(Object.assign(new Error('Request body must contain valid JSON.'), { status: 400, code: 'INVALID_JSON' }));
    }
  });
  req.on('error', reject);
});

const allowedStatuses = ['queued', 'in-progress', 'completed'];
const allowedPriorities = ['low', 'medium', 'high'];

const validateTask = (input, partial = false) => {
  const errors = [];
  if (!partial || Object.hasOwn(input, 'title')) {
    if (typeof input.title !== 'string' || input.title.trim().length < 3 || input.title.trim().length > 80) {
      errors.push({ field: 'title', message: 'Title must be between 3 and 80 characters.' });
    }
  }
  if (!partial || Object.hasOwn(input, 'owner')) {
    if (typeof input.owner !== 'string' || input.owner.trim().length < 2 || input.owner.trim().length > 50) {
      errors.push({ field: 'owner', message: 'Owner must be between 2 and 50 characters.' });
    }
  }
  if (Object.hasOwn(input, 'status') && !allowedStatuses.includes(input.status)) {
    errors.push({ field: 'status', message: `Status must be one of: ${allowedStatuses.join(', ')}.` });
  }
  if (Object.hasOwn(input, 'priority') && !allowedPriorities.includes(input.priority)) {
    errors.push({ field: 'priority', message: `Priority must be one of: ${allowedPriorities.join(', ')}.` });
  }
  if (Object.hasOwn(input, 'category') && (typeof input.category !== 'string' || input.category.trim().length < 2 || input.category.trim().length > 30)) {
    errors.push({ field: 'category', message: 'Category must be between 2 and 30 characters.' });
  }
  return errors;
};

const normalizeTask = (input, previous = {}) => ({
  ...previous,
  title: input.title !== undefined ? input.title.trim() : previous.title,
  owner: input.owner !== undefined ? input.owner.trim() : previous.owner,
  status: input.status || previous.status || 'queued',
  priority: input.priority || previous.priority || 'medium',
  category: input.category !== undefined ? input.category.trim() : previous.category || 'General'
});

const getStats = () => ({
  total: tasks.length,
  queued: tasks.filter((task) => task.status === 'queued').length,
  active: tasks.filter((task) => task.status === 'in-progress').length,
  completed: tasks.filter((task) => task.status === 'completed').length,
  completionRate: tasks.length ? Math.round((tasks.filter((task) => task.status === 'completed').length / tasks.length) * 100) : 0
});

const serveStatic = (pathname, res) => {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, requestedPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return false;
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
  try {
    const file = fs.readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': file.length,
      'Cache-Control': path.extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(file);
    return true;
  } catch {
    return false;
  }
};

const createServer = () => http.createServer(async (req, res) => {
  const requestId = req.headers['x-request-id'] || randomUUID();
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  applySecurityHeaders(res);
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'X-Request-Id': requestId });
    return res.end();
  }

  if (!checkRateLimit(req, res, requestId)) return;

  try {
    if (pathname === '/api' && req.method === 'GET') {
      return json(res, 200, {
        name: 'Synapse API',
        version: '1.0.0',
        resources: {
          health: 'GET /api/health',
          stats: 'GET /api/stats',
          listTasks: 'GET /api/tasks?status=&priority=&search=',
          task: 'GET /api/tasks/:id',
          createTask: 'POST /api/tasks',
          replaceTask: 'PUT /api/tasks/:id',
          updateTask: 'PATCH /api/tasks/:id',
          deleteTask: 'DELETE /api/tasks/:id'
        }
      }, requestId);
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      return json(res, 200, { status: 'healthy', service: 'synapse-api', version: '1.0.0', uptimeSeconds: Math.floor(process.uptime()), timestamp: new Date().toISOString() }, requestId);
    }

    if (pathname === '/api/stats' && req.method === 'GET') {
      return json(res, 200, { data: getStats() }, requestId);
    }

    if (pathname === '/api/tasks' && req.method === 'GET') {
      const status = url.searchParams.get('status');
      const priority = url.searchParams.get('priority');
      const search = (url.searchParams.get('search') || '').trim().toLowerCase();
      if (status && !allowedStatuses.includes(status)) return errorResponse(res, 400, 'INVALID_QUERY', 'Unknown status filter.', requestId);
      if (priority && !allowedPriorities.includes(priority)) return errorResponse(res, 400, 'INVALID_QUERY', 'Unknown priority filter.', requestId);
      const filtered = tasks.filter((task) => {
        const matchesStatus = !status || task.status === status;
        const matchesPriority = !priority || task.priority === priority;
        const haystack = `${task.title} ${task.owner} ${task.category}`.toLowerCase();
        return matchesStatus && matchesPriority && (!search || haystack.includes(search));
      });
      return json(res, 200, { data: filtered, meta: { count: filtered.length, total: tasks.length } }, requestId);
    }

    if (pathname === '/api/tasks' && req.method === 'POST') {
      const input = await readBody(req);
      const errors = validateTask(input);
      if (errors.length) return errorResponse(res, 400, 'VALIDATION_FAILED', 'The task could not be created.', requestId, errors);
      const task = {
        id: `sig-${randomUUID().slice(0, 8)}`,
        ...normalizeTask(input),
        createdAt: new Date().toISOString()
      };
      tasks.unshift(task);
      return json(res, 201, { data: task }, requestId, { Location: `/api/tasks/${task.id}` });
    }

    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
    if (taskMatch) {
      const id = taskMatch[1];
      const index = tasks.findIndex((task) => task.id === id);
      if (index === -1) return errorResponse(res, 404, 'TASK_NOT_FOUND', `No task exists with id ${id}.`, requestId);

      if (req.method === 'GET') return json(res, 200, { data: tasks[index] }, requestId);

      if (req.method === 'PUT' || req.method === 'PATCH') {
        const input = await readBody(req);
        const errors = validateTask(input, req.method === 'PATCH');
        if (errors.length) return errorResponse(res, 400, 'VALIDATION_FAILED', 'The task could not be updated.', requestId, errors);
        tasks[index] = { ...normalizeTask(input, req.method === 'PATCH' ? tasks[index] : {}), id, createdAt: tasks[index].createdAt, updatedAt: new Date().toISOString() };
        return json(res, 200, { data: tasks[index] }, requestId);
      }

      if (req.method === 'DELETE') {
        tasks.splice(index, 1);
        res.writeHead(204, { 'X-Request-Id': requestId, 'Cache-Control': 'no-store' });
        return res.end();
      }
    }

    if (pathname.startsWith('/api/')) return errorResponse(res, 404, 'ROUTE_NOT_FOUND', 'The requested API route does not exist.', requestId);
    if (req.method === 'GET' && serveStatic(pathname, res)) return;
    return errorResponse(res, 404, 'NOT_FOUND', 'The requested resource was not found.', requestId);
  } catch (error) {
    if (!res.headersSent) errorResponse(res, error.status || 500, error.code || 'INTERNAL_ERROR', error.status ? error.message : 'An unexpected error occurred.', requestId);
  }
});

const resetStore = () => { tasks = structuredClone(seedTasks); requestBuckets.clear(); };

if (require.main === module) {
  createServer().listen(PORT, () => {
    console.log(`Synapse API listening on http://127.0.0.1:${PORT}`);
  });
}

module.exports = { createServer, resetStore };
