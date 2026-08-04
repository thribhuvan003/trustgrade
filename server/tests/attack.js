// One command that fires every defence and prints what actually happened.
//   npm run attack
//
// Nothing here is mocked. The database attacks run as raw SQL that bypasses the
// approval service entirely, and the sandbox attacks run real programs.
import { prisma } from '../src/lib/prisma.js';
import { runInSandbox } from '../src/services/sandbox.js';
import { attackDatabase } from './attack-database.js';

const rows = [];

export function record(area, attack, expected, observed, held) {
  rows.push({ area, attack, expected, observed, held });
}

async function attackSandbox() {
  const cases = [
    ['infinite loop', 'stopped at 5s', 'while True: pass', 'TIME_LIMIT_EXCEEDED'],
    ['allocate 8 GB', 'killed at 256m', 'x = [0]*10**9', 'MEMORY_LIMIT_EXCEEDED'],
    ['connect to 1.1.1.1', 'network unreachable', "import socket\nsocket.create_connection(('1.1.1.1',80),timeout=3)", 'RUNTIME_ERROR'],
    ['fork forever', 'stopped at 64 pids', 'import os\nwhile True: os.fork()', 'RUNTIME_ERROR'],
    ['print 10 MB', 'output truncated', "print('x'*10**7)", 'OK'],
    ['ordinary program', 'runs normally', 'print(sum(int(n) for n in input().split()))', 'OK'],
  ];

  for (const [attack, expected, code, wantVerdict] of cases) {
    const result = await runInSandbox(code, '1 2 3');
    const detail = describe(result);
    record('sandbox', attack, expected, detail, result.verdict === wantVerdict);
  }
}

function describe(result) {
  const parts = [result.verdict.toLowerCase().replace(/_/g, ' '), `${result.runtimeMs}ms`];
  if (result.truncated) parts.push('output truncated at 64 KB');
  const lastError = result.stderr.trim().split('\n').pop();
  if (lastError) parts.push(lastError.length > 62 ? `${lastError.slice(0, 61)}...` : lastError);
  return parts.join(' | ');
}

async function noLeftoverContainers() {
  const { execSync } = await import('node:child_process');
  const names = execSync('docker ps -a --format "{{.Names}}"').toString();
  const leftovers = names.split('\n').filter((n) => n.startsWith('tg-run-'));
  record('cleanup', 'containers after the run', 'none left behind',
    leftovers.length === 0 ? 'none' : leftovers.join(', '), leftovers.length === 0);
}

function print() {
  const headers = ['', 'area', 'attack', 'expected', 'what happened'];
  const table = rows.map((r) => [r.held ? 'ok' : 'FAIL', r.area, r.attack, r.expected, r.observed]);
  const widths = headers.map((h, i) => Math.max(h.length, ...table.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();

  console.log('\nTrustGrade defences, fired live\n');
  console.log(line(headers));
  console.log('-'.repeat(widths.reduce((total, w) => total + w + 2, 0) - 2));
  table.forEach((row) => console.log(line(row)));

  const failed = rows.filter((r) => !r.held).length;
  console.log(`\n${rows.length - failed} of ${rows.length} defences held.`);
  return failed;
}

await attackDatabase(record);
await attackSandbox();
await noLeftoverContainers();
const failures = print();
await prisma.$disconnect();
process.exit(failures === 0 ? 0 : 1);
