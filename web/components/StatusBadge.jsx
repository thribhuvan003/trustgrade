const TONES = {
  APPROVED: ['bg-success-soft', 'text-success', 'Answer approved'],
  PENDING_REVIEW: ['bg-warn-soft', 'text-warn', 'Pending teacher review'],
  REJECTED: ['bg-danger-soft', 'text-danger', 'Rejected for revision'],
  DRAFT: ['bg-surface2', 'text-text2', 'Awaiting AI draft'],
  COMPLETED: ['bg-success-soft', 'text-success', 'Completed'],
  FAILED: ['bg-danger-soft', 'text-danger', 'Not scored'],
  OK: ['bg-success-soft', 'text-success', 'Passed'],
  TIME_LIMIT_EXCEEDED: ['bg-warn-soft', 'text-warn', 'Time limit exceeded'],
  MEMORY_LIMIT_EXCEEDED: ['bg-warn-soft', 'text-warn', 'Memory limit exceeded'],
  RUNTIME_ERROR: ['bg-danger-soft', 'text-danger', 'Runtime error'],
  SOURCE_TOO_LARGE: ['bg-danger-soft', 'text-danger', 'Program too large'],
};

export default function StatusBadge({ status, label }) {
  const [background, colour, fallback] = TONES[status] ?? ['bg-surface2', 'text-text2', status];

  return (
    <span className={`inline-block rounded px-2 py-0.5 font-mono text-[11px] ${background} ${colour}`}>
      {label ?? fallback}
    </span>
  );
}
