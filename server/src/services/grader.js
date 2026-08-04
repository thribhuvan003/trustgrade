// Test cases decide the score. Nothing else does, and no model is consulted.
import { runInSandbox } from './sandbox.js';

// One container at a time. Running them together would let a heavy test steal
// CPU from its neighbours, and a borderline program's verdict would start
// depending on what else happened to be running.
// If docker itself is unreachable the sandbox reports exit code -1 with its own
// marker on stderr. Scoring that would write our outage into a student's record
// as their failure, so it stops the grade instead.
const sandboxUnavailable = (run) => run.exitCode === -1 && run.stderr.startsWith('[sandbox]');

export async function grade(code, testCases) {
  const results = [];
  for (const test of testCases) {
    const run = await runInSandbox(code, test.input);
    if (sandboxUnavailable(run)) {
      const error = new Error('The grading sandbox is unavailable, so this was not scored. Try again shortly.');
      error.status = 503;
      error.clientMessage = error.message;
      throw error;
    }
    results.push(judge(test, run));
  }

  const passed = results.filter((result) => result.passed).length;
  const total = results.length;
  return { results, passed, total, score: total ? Math.round((passed / total) * 100) : 0 };
}

// A hidden test reports only that it ran and how long it took. Returning its
// input or expected output would hand the answer to the student.
function judge(test, run) {
  const summary = {
    id: test.id,
    hidden: test.hidden,
    passed: run.verdict === 'OK' && run.stdout.trim() === test.expected.trim(),
    verdict: run.verdict,
    runtimeMs: run.runtimeMs,
  };

  if (test.hidden) return summary;
  return { ...summary, input: test.input, expected: test.expected, received: run.stdout.trim() };
}
