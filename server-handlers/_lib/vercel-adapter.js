const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function normalizeHeaderValue(value) {
  return Array.isArray(value) ? value.join(', ') : value;
}

function createHeaders(headers = {}) {
  const normalized = new Map();
  for (const [key, value] of Object.entries(headers)) normalized.set(key.toLowerCase(), normalizeHeaderValue(value));
  return { get(name) { return normalized.get(String(name).toLowerCase()) || null; } };
}

function createRequest(req) {
  return { ...req, method: req.method, headers: createHeaders(req.headers), json: async () => (req.body ?? {}) };
}

async function sendResponse(res, response) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) res.setHeader(key, value);
  if (response instanceof Response) {
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const contentType = response.headers.get('content-type') || '';
    const body = await response.text();
    res.status(response.status);
    if (contentType.includes('application/json')) {
      try { return res.json(body ? JSON.parse(body) : null); } catch { return res.send(body); }
    }
    return res.send(body);
  }
  if (response === undefined) return res.status(204).end();
  return res.status(200).json(response);
}

export async function runVercelHandler(req, res, handler) {
  for (const [key, value] of Object.entries(CORS_HEADERS)) res.setHeader(key, value);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const response = await handler(createRequest(req), {});
  return sendResponse(res, response);
}
