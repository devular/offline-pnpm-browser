import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const clientDir = join(__dirname, 'dist', 'client');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const app = await import('./dist/server/server.js');
const handler = app.default;

const server = createServer(async (req, res) => {
  // Try serving static files from dist/client first
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  const filePath = join(clientDir, urlPath);

  if (urlPath !== '/' && existsSync(filePath)) {
    const ext = extname(filePath);
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(readFileSync(filePath));
    return;
  }

  // SSR via TanStack Start
  const request = new Request(`http://localhost:${port}${req.url}`, {
    method: req.method,
    headers: Object.fromEntries(
      Object.entries(req.headers)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => [k, String(v)]),
    ),
  });

  const response = await handler.fetch(request);
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  const body = await response.text();
  res.end(body);
});

const port = process.env.PORT || 54321;
server.listen(port, () => {
  console.log(`Offline PNPM Browser running at http://localhost:${port}`);
});
