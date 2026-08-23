import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const authSource = readFileSync(resolve(projectRoot, 'auth.js'), 'utf8');
const passwordHashes = new Set(authSource.match(/[a-f0-9]{64}/g) || []);
const secretFile = resolve(projectRoot, '.media-server-secret');
const port = Number(process.env.MUSIC_CAFE_MEDIA_PORT || 8787);
const tokenLifetime = Number(process.env.MUSIC_CAFE_TOKEN_SECONDS || 15552000);
const allowedOrigins = new Set((process.env.MUSIC_CAFE_ALLOWED_ORIGINS ||
  'null,http://localhost:8000,http://127.0.0.1:8000,https://dusunim.github.io')
  .split(',').map((origin) => origin.trim()).filter(Boolean));

if (!passwordHashes.size) throw new Error('auth.js에서 SHA-256 암호 해시를 찾지 못했습니다.');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(48).toString('hex'), { mode: 0o600 });
const signingSecret = readFileSync(secretFile, 'utf8').trim();
const loginAttempts = new Map();

const mimeTypes = {
  '.mp4': 'video/mp4', '.m4v': 'video/x-m4v', '.webm': 'video/webm',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
  '.pdf': 'application/pdf', '.json': 'application/json; charset=utf-8',
};

function setCors(request, response) {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

function signToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + tokenLifetime * 1000, nonce: randomBytes(12).toString('hex') })).toString('base64url');
  const signature = createHmac('sha256', signingSecret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validToken(token) {
  if (typeof token !== 'string') return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = createHmac('sha256', signingSecret).update(payload).digest();
  let supplied;
  try { supplied = Buffer.from(signature, 'base64url'); } catch { return false; }
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return false;
  try { return JSON.parse(Buffer.from(payload, 'base64url')).exp > Date.now(); } catch { return false; }
}

function safeFile(root, relativePath) {
  const target = resolve(root, relativePath);
  return target.startsWith(`${resolve(root)}${sep}`) ? target : null;
}

function sendFile(request, response, file, download = false) {
  if (!file || !existsSync(file) || !statSync(file).isFile()) return json(response, 404, { error: '파일을 찾을 수 없습니다.' });
  const { size } = statSync(file);
  const type = mimeTypes[extname(file).toLowerCase()] || 'application/octet-stream';
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'private, no-store' };
  if (download) headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(file.split(sep).pop())}`;
  const match = request.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= size) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      return response.end();
    }
    const boundedEnd = Math.min(end, size - 1);
    response.writeHead(206, { ...headers, 'Content-Length': boundedEnd - start + 1, 'Content-Range': `bytes ${start}-${boundedEnd}/${size}` });
    if (request.method === 'HEAD') return response.end();
    return createReadStream(file, { start, end: boundedEnd }).pipe(response);
  }
  response.writeHead(200, { ...headers, 'Content-Length': size });
  if (request.method === 'HEAD') return response.end();
  createReadStream(file).pipe(response);
}

function clientIp(request) {
  return request.headers['cf-connecting-ip'] || request.socket.remoteAddress || 'unknown';
}

function loginAllowed(ip) {
  const now = Date.now();
  const attempts = (loginAttempts.get(ip) || []).filter((time) => now - time < 10 * 60 * 1000);
  loginAttempts.set(ip, attempts);
  return attempts.length < 10;
}

function recordFailedLogin(ip) {
  loginAttempts.set(ip, [...(loginAttempts.get(ip) || []), Date.now()]);
}

const server = createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === 'OPTIONS') return response.writeHead(204).end();
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/health') return json(response, 200, { ok: true });
  if (url.pathname === '/api/login' && request.method === 'POST') {
    const ip = clientIp(request);
    if (!loginAllowed(ip)) return json(response, 429, { error: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.' });
    let raw = '';
    for await (const chunk of request) {
      raw += chunk;
      if (raw.length > 4096) return json(response, 413, { error: '요청이 너무 큽니다.' });
    }
    let password = '';
    try { password = JSON.parse(raw).password || ''; } catch { return json(response, 400, { error: '잘못된 요청입니다.' }); }
    const hash = createHash('sha256').update(password).digest('hex');
    if (!passwordHashes.has(hash)) {
      recordFailedLogin(ip);
      return json(response, 401, { error: '암호가 올바르지 않습니다.' });
    }
    return json(response, 200, { token: signToken(), expiresIn: tokenLifetime });
  }

  if (!validToken(url.searchParams.get('token'))) return json(response, 401, { error: '인증이 필요합니다.' });

  if (url.pathname.startsWith('/media/videos/')) {
    const relative = decodeURIComponent(url.pathname.slice('/media/videos/'.length));
    return sendFile(request, response, safeFile(resolve(projectRoot, 'content/videos'), relative), url.searchParams.get('download') === '1');
  }
  if (url.pathname.startsWith('/media/assets/')) {
    const relative = decodeURIComponent(url.pathname.slice('/media/assets/'.length));
    return sendFile(request, response, safeFile(resolve(projectRoot, 'content/assets'), relative), url.searchParams.get('download') === '1');
  }
  if (url.pathname === '/api/transcript') {
    const relative = decodeURIComponent(url.searchParams.get('file') || '').replace(/\.[^.]+$/, '.json');
    const file = safeFile(resolve(projectRoot, 'content/transcripts'), relative);
    if (!file || !existsSync(file)) return json(response, 404, { error: '전사를 찾을 수 없습니다.' });
    try { return json(response, 200, { segments: JSON.parse(readFileSync(file, 'utf8')).segments || [] }); }
    catch { return json(response, 500, { error: '전사를 읽지 못했습니다.' }); }
  }
  json(response, 404, { error: '경로를 찾을 수 없습니다.' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Music Cafe media server: http://127.0.0.1:${port}`);
  console.log(`Allowed origins: ${[...allowedOrigins].join(', ')}`);
});
