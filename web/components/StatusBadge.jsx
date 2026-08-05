const TONES = {
  APPROVED: ['bg-success-soft', 'text-success', 'Answer approved'],
  PENDING_REVIEW: ['bg-warn-soft', 'text-warn', 'Pending teacher review'],
  // Not "rejected for revision": there is no revision path, and a badge should
  // not promise a route that does not exist.
  REJECTED: ['bg-danger-soft', 'text-danger', 'Not published'],
  DRAFT: ['bg-surface2', 'text-text2', 'Awaiting AI draft'],
  COMPLETED: ['bg-success-soft', 'text-success', 'Completed'],
  FAILED: ['bg-danger-soft', 'text-danger', 'Not scored'],
  OK: ['bg-success-soft', 'text-success', 'Passed'],
  // The program ran cleanly but printed the wrong thing. "OK" is the sandbox's
  // verdict on the process, not on the answer.
  WRONG_ANSWER: ['bg-danger-soft', 'text-danger', 'Wrong answer'],
  TIME_LIMIT_EXCEEDED: ['bg-warn-soft', 'text-warn', 'Time limit exceeded'],
  MEMORY_LIMIT_EXCEEDED: ['bg-warn-soft', 'text-warn', 'Memory limit exceeded'],
  RUNTIME_ERROR: ['bg-danger-soft', 'text-danger', 'Runtime error'],
  SOURCE_TOO_LARGE: ['bg-danger-soft', 'text-danger', 'Program too large'],
};

// The sandbox verdict describes the process, not the answer: a program that
// exits cleanly with the wrong output is OK to the sandbox and wrong to the
// student. Every caller must go through here, or the badge ends up claiming a
// failed test passed.
export function outcomeOf(result) {
  if (result.passed) return 'OK';
  return result.verdict === 'OK' ? 'WRONG_ANSWER' : result.verdict;
}

// A submission is only a pass if every test passed. Otherwise report the first
// thing that went wrong.
export function submissionOutcome(submission) {
  if (submission.status === 'FAILED') return 'FAILED';
  if (submission.passed === submission.total) return 'OK';
  return outcomeOf(submission.results.find((result) => !result.passed) ?? { passed: false, verdict: 'OK' });
}

export default function StatusBadge({ status, label }) {
  const [background, colour, fallback] = TONES[status] ?? ['bg-surface2', 'text-text2', status];

  return (
    <span className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] ${background} ${colour}`}>
      {label ?? fallback}
    </span>
  );
}
