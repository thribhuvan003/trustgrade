'use client';

import AuditTrail from './AuditTrail';

// The teacher's half of the review page. Approving needs text, rejecting needs
// a reason, and the version travels with the request so a second reviewer
// cannot be overwritten.
export default function DecisionPanel({
  answer, published, note, busy, error, done, onPublishedChange, onNoteChange, onDecide,
}) {
  return (
    <div className="h-full overflow-y-auto border-l border-border px-6 py-5">
      <h2 className="section-title" id="final-answer-label">Final answer</h2>
      <p className="mt-0.5 text-[12px] text-muted">
        {answer.model === 'none'
          ? 'No draft was generated, so this starts empty. Write the answer yourself.'
          : 'Starts from the draft. Edit it before publishing.'}
      </p>
      <textarea
        value={published}
        aria-labelledby="final-answer-label"
        onChange={(event) => onPublishedChange(event.target.value)}
        placeholder="What the student will read."
        className="mt-2 h-56 w-full resize-none rounded border border-border-strong bg-surface p-3 text-[13px] leading-relaxed outline-none transition-colors focus:border-accent"
      />

      <h2 className="section-title mt-5" id="review-note-label">Review note</h2>
      <textarea
        value={note}
        aria-labelledby="review-note-label"
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Required when rejecting."
        className="mt-2 h-20 w-full resize-none rounded border border-border-strong bg-surface p-3 text-[13px] outline-none transition-colors focus:border-accent"
      />

      <p className="mt-4 text-[13px] leading-relaxed text-text2">
        Only your approval makes an answer visible to students
      </p>

      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      {done && <p className="mt-2 text-[13px] text-success">{done}</p>}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy || !published.trim()}
          onClick={() => onDecide('approve')}
          className="rounded bg-accent px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          Approve and publish
        </button>
        <button
          type="button"
          disabled={busy || !note.trim()}
          onClick={() => onDecide('reject')}
          className="rounded border border-border-strong px-3 py-1.5 text-[13px] transition-colors hover:bg-surface2 disabled:opacity-50"
        >
          Reject
        </button>
      </div>
      <div className="tnum mt-2 font-mono text-[11px] text-muted">version {answer.version}</div>

      <h2 className="section-title mt-6">Audit trail</h2>
      <AuditTrail transitions={answer.transitions} />
    </div>
  );
}
