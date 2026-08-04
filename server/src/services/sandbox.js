// Runs one untrusted program in one disposable container.
// This reduces the listed risks. It is not a claim that the container is secure.
import { spawn, execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const IMAGE = 'trustgrade-runner';
const TIME_LIMIT_MS = 5000;
// One budget shared by stdout and stderr, so a program cannot double it by
// writing to both.
const OUTPUT_CAP = 64 * 1024;
// Base64 on the command line: measured, spawn fails with ENAMETOOLONG past
// roughly 24 KB of source, so stay well clear of it.
const MAX_CODE_BYTES = 16 * 1024;

const FLAGS = [
  '--network', 'none', '--memory', '256m', '--memory-swap', '256m',
  '--cpus', '0.5', '--pids-limit', '64', '--read-only',
  '--tmpfs', '/tmp:rw,size=16m,noexec,nosuid',
  '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges',
  '--user', '65534:65534',
];

// Stopping the docker CLI does not stop the container it started.
const inFlight = new Set();

function sweep() {
  for (const name of inFlight) {
    try {
      execSync(`docker rm -f ${name}`, { stdio: 'ignore' });
    } catch { /* already gone */ }
  }
  inFlight.clear();
}

// Best effort only: Node cannot catch SIGTERM on Windows, and nothing catches
// SIGKILL anywhere. Verified by killing the server mid-run.
process.once('SIGINT', () => { sweep(); process.exit(130); });
process.once('SIGTERM', () => { sweep(); process.exit(143); });

// So the real guarantee lives at startup: remove what a previous process left.
function removeOrphans() {
  try {
    const ids = execSync('docker ps -aq --filter name=tg-run-', {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    if (ids) execSync(`docker rm -f ${ids.split('\n').join(' ')}`, { stdio: 'ignore' });
  } catch { /* docker unavailable, nothing to clean */ }
}

removeOrphans();

function docker(args, input) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let remaining = OUTPUT_CAP;
    let truncated = false;

    const take = (chunk) => {
      const text = chunk.toString();
      if (text.length <= remaining) {
        remaining -= text.length;
        return text;
      }
      truncated = true;
      const kept = text.slice(0, remaining);
      remaining = 0;
      return kept;
    };

    const failed = (e) => resolve({ stdout, stderr: `[sandbox] docker failed: ${e.code}`, exitCode: -1, truncated });

    let child;
    try {
      child = spawn('docker', args);
    } catch (error) {
      failed(error);
      return;
    }

    child.stdout.on('data', (chunk) => { stdout += take(chunk); });
    child.stderr.on('data', (chunk) => { stderr += take(chunk); });
    child.on('error', failed);
    child.on('close', (code) => resolve({ stdout, stderr, exitCode: code, truncated }));

    if (input !== undefined) child.stdin.end(input);
  });
}

async function remove(name) {
  await docker(['rm', '-f', name]);
}

async function wasOomKilled(name) {
  const { stdout } = await docker(['inspect', '--format', '{{.State.OOMKilled}}', name]);
  return stdout.trim() === 'true';
}

function verdictFor(exitCode, timedOut, oomKilled) {
  if (timedOut) return 'TIME_LIMIT_EXCEEDED';
  if (oomKilled) return 'MEMORY_LIMIT_EXCEEDED';
  if (exitCode !== 0) return 'RUNTIME_ERROR';
  return 'OK';
}

const tooLarge = () => ({
  stdout: '', stderr: 'That program is longer than the 16 KB limit. Nothing was run.',
  exitCode: -1, timedOut: false, truncated: false, runtimeMs: 0,
  verdict: 'SOURCE_TOO_LARGE',
});

export async function runInSandbox(code, stdin = '') {
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) return tooLarge();

  const name = `tg-run-${randomUUID().slice(0, 12)}`;
  const encoded = Buffer.from(code, 'utf8').toString('base64');
  const startedAt = Date.now();
  let timedOut = false;
  let timer;

  inFlight.add(name);
  try {
    const run = docker(
      ['run', '-i', '--name', name, ...FLAGS, '-e', `TRUSTGRADE_CODE_B64=${encoded}`, IMAGE],
      stdin,
    );
    // Killing the docker CLI would leave the container running, so the timer
    // removes the container itself. That is what ends the attached run.
    timer = setTimeout(() => { timedOut = true; remove(name); }, TIME_LIMIT_MS);
    const result = await run;

    // A timeout hides a memory kill: the timer already removed the container,
    // so nothing is left to inspect. Reporting the limit seen to fire is honest.
    const oomKilled = timedOut ? false : await wasOomKilled(name);

    // result carries stdout, stderr, exitCode and truncated.
    return {
      ...result,
      timedOut,
      runtimeMs: Date.now() - startedAt,
      verdict: verdictFor(result.exitCode, timedOut, oomKilled),
    };
  } finally {
    clearTimeout(timer);
    await remove(name);
    inFlight.delete(name);
  }
}
