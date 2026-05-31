/**
 * 零依赖本地静态服务器（仅用 Node 内置模块）。
 * 用法：在 prototype 目录下执行  node serve.js  （可选指定端口： node serve.js 8123）
 * 然后浏览器打开终端里打印的地址即可。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 8123;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8'
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // 防目录穿越
  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ''));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) { res.writeHead(404); res.end('Not Found'); return; }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log('InvMap 提货导航原型已启动：');
  console.log('  ' + url);
  console.log('按 Ctrl+C 结束。');
  // 尝试自动打开默认浏览器（失败也不影响）
  const platform = process.platform;
  const opener = platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try { require('child_process').spawn(opener[0], opener[1], { stdio: 'ignore', detached: true }).unref(); }
  catch (e) { /* 手动打开即可 */ }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error(`端口 ${PORT} 被占用，请换一个端口：node serve.js 8124`);
  } else {
    console.error(e.message);
  }
  process.exit(1);
});
