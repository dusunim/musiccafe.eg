import { spawn, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const configFile = resolve(projectRoot, 'deploy-config.js');
const cloudflared = process.env.CLOUDFLARED_PATH || '/opt/homebrew/bin/cloudflared';
const branch = process.env.MUSIC_CAFE_DEPLOY_BRANCH || 'deploy/cloudflare';
let publishedUrl = '';

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin` },
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} 실패: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim();
}

function updateDeployment(tunnelUrl) {
  if (publishedUrl === tunnelUrl) return;
  const current = readFileSync(configFile, 'utf8');
  const next = current.replace(/mediaBaseUrl:\s*'[^']*'/, `mediaBaseUrl: '${tunnelUrl}'`);
  if (next === current && current.includes(tunnelUrl)) {
    publishedUrl = tunnelUrl;
    return;
  }
  if (next === current) throw new Error('deploy-config.js의 mediaBaseUrl 항목을 찾지 못했습니다.');

  writeFileSync(configFile, next);
  run('/usr/bin/git', ['add', '--', 'deploy-config.js']);
  run('/usr/bin/git', [
    '-c', 'user.name=Music Cafe Deploy',
    '-c', 'user.email=music-cafe-deploy@users.noreply.github.com',
    'commit', '-m', 'Update Cloudflare Quick Tunnel URL',
  ]);
  run('/usr/bin/git', ['push', 'origin', `HEAD:${branch}`]);
  publishedUrl = tunnelUrl;
  console.log(`GitHub Pages media URL updated: ${tunnelUrl}`);
}

const child = spawn(cloudflared, [
  'tunnel', '--url', 'http://127.0.0.1:8787', '--no-autoupdate',
], {
  cwd: projectRoot,
  env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin` },
  stdio: ['ignore', 'pipe', 'pipe'],
});

for (const stream of [child.stdout, child.stderr]) {
  const lines = createInterface({ input: stream });
  lines.on('line', (line) => {
    console.log(line);
    const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (!match) return;
    try { updateDeployment(match[0]); }
    catch (error) { console.error(`Tunnel URL 배포 실패: ${error.message}`); }
  });
}

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};
process.on('SIGTERM', () => stop('SIGTERM'));
process.on('SIGINT', () => stop('SIGINT'));
child.on('exit', (code, signal) => process.exitCode = code ?? (signal ? 1 : 0));
child.on('error', (error) => {
  console.error(`cloudflared 실행 실패: ${error.message}`);
  process.exitCode = 1;
});
