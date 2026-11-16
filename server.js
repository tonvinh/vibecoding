// Server tĩnh nhỏ cho game: phục vụ app/ tại "/" và design/ tại "/design/".
// Chỉ dùng module có sẵn của Node.js, không cần cài thêm gì.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const APP_DIR = path.join(__dirname, 'app');
const DESIGN_DIR = path.join(__dirname, 'design');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...headers });
  res.end(body);
}

// Trả về đường dẫn file trên đĩa, hoặc null nếu URL không hợp lệ / vượt ra ngoài thư mục gốc.
function resolveFile(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;

  let root = APP_DIR;
  let rel = pathname;
  if (pathname === '/design' || pathname.startsWith('/design/')) {
    root = DESIGN_DIR;
    rel = pathname.slice('/design'.length);
  }

  const file = path.join(root, path.normalize('/' + rel));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`);
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/healthz') return send(res, 200, 'ok');

  let file = resolveFile(pathname);
  if (!file) return send(res, 400, 'Bad Request');

  fs.stat(file, (err, stat) => {
    if (!err && stat.isDirectory()) {
      file = path.join(file, 'index.html');
      return fs.stat(file, (err2, stat2) => serve(err2, stat2));
    }
    serve(err, stat);
  });

  function serve(err, stat) {
    if (err || !stat.isFile()) return send(res, 404, 'Not Found');
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file)
      .on('error', () => res.destroy())
      .pipe(res);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});

// Tắt gọn khi Docker gửi tín hiệu dừng.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`Nhận ${signal}, đang tắt server...`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
