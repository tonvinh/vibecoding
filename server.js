// Server của game: phục vụ app/ tại "/", design/ tại "/design/", trang admin tại "/admin",
// API người chơi tại "/api/*" và API admin tại "/admin/api/*". Dữ liệu nằm trong PostgreSQL.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const db = require('./src/db');
const nguoiChoi = require('./src/nguoi-choi');
const admin = require('./src/admin');
const { guiJson } = require('./src/tien-ich');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const APP_DIR = path.join(__dirname, 'app');
const DESIGN_DIR = path.join(__dirname, 'design');
const ADMIN_DIR = path.join(__dirname, 'admin');

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
  } else if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    root = ADMIN_DIR;
    rel = pathname.slice('/admin'.length);
  }

  const file = path.join(root, path.normalize('/' + rel));
  if (file !== root && !file.startsWith(root + path.sep)) return null;
  return file;
}

const server = http.createServer((req, res) => {
  const started = Date.now();
  let url;
  try {
    url = new URL(req.url, 'http://localhost');
  } catch {
    return send(res, 400, 'Bad Request');
  }
  const { pathname } = url;

  // Nhật ký chỉ ghi đường dẫn, không ghi tham số (từ khoá tìm kiếm) hay thân yêu cầu.
  res.on('finish', () => {
    console.log(`${req.method} ${pathname} ${res.statusCode} ${Date.now() - started}ms`);
  });

  if (pathname === '/healthz') return send(res, 200, 'ok');

  // API: trả JSON; lỗi không lường trước thành 500 và máy chủ vẫn chạy tiếp.
  const laApiAdmin = pathname.startsWith('/admin/api/');
  if (laApiAdmin || pathname.startsWith('/api/')) {
    const xuLy = laApiAdmin ? admin.xuLy : nguoiChoi.xuLy;
    xuLy(req, res, pathname, url).catch((err) => {
      const status = err.status || 500;
      if (status === 500) console.error(`Lỗi ${req.method} ${pathname}: ${err.code || ''} ${err.message}`);
      if (res.headersSent) return res.destroy();
      guiJson(res, status, { loi: err.loi || 'LOI_MAY_CHU' });
    });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
  }

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
      'Cache-Control': pathname === '/admin' || pathname.startsWith('/admin/') ? 'no-store' : 'no-cache',
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

admin.canhBaoCauHinh();
db.khoiTao();

// Tắt gọn khi Docker gửi tín hiệu dừng.
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    console.log(`Nhận ${signal}, đang tắt server...`);
    server.close(() => db.dong().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}
