// Fast contract checks on what runInSandbox returns. The exhaustive attacks
// (time limit, memory, network, pids, truncation) live in `npm run attack`,
// which fires them live and prints what happened.
import { describe, expect, it } from 'vitest';
import { execSync } from 'node:child_process';
import { runInSandbox } from '../src/services/sandbox.js';

function runningContainers() {
  return execSync('docker ps -a --format "{{.Names}}"')
    .toString()
    .split('\n')
    .filter((name) => name.startsWith('tg-run-'));
}

describe('sandbox', () => {
  it('returns the documented shape and reads stdin', async () => {
    const result = await runInSandbox('print(sum(int(n) for n in input().split()))', '4 5 6');

    expect(result.stdout.trim()).toBe('15');
    expect(result).toMatchObject({ exitCode: 0, timedOut: false, truncated: false, verdict: 'OK' });
    expect(result.runtimeMs).toBeGreaterThan(0);
  });

  it('reports a crashing program as a runtime error without throwing', async () => {
    const result = await runInSandbox('raise ValueError("boom")');

    expect(result.verdict).toBe('RUNTIME_ERROR');
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain('ValueError: boom');
  });

  it('refuses an oversized program before starting a container', async () => {
    const result = await runInSandbox(`x = "${'a'.repeat(20 * 1024)}"`);

    expect(result.verdict).toBe('SOURCE_TOO_LARGE');
    expect(result.runtimeMs).toBe(0);
    expect(runningContainers()).toEqual([]);
  });

  it('leaves no container behind', async () => {
    await runInSandbox('print("done")');
    expect(runningContainers()).toEqual([]);
  });
});
