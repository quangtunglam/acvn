import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default function handler(req, res) {
  const cleanUrl = (req.url || '/').split('?')[0];
  const publicDir = path.join(__dirname, 'dist');
  let targetPath = path.join(publicDir, cleanUrl === '/' ? 'index.html' : cleanUrl);

  if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
    targetPath = path.join(publicDir, 'index.html');
  }

  const ext = path.extname(targetPath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.json': 'application/json',
    '.txt': 'text/plain',
  };

  res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
  fs.createReadStream(targetPath).pipe(res);
}
