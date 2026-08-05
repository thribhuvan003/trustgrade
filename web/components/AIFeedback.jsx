'use client';

import { useState } from 'react';
import { getFeedback } from '../lib/api';

const SEVERITY = { high: 'text-danger', medium: 'text-warn', low: 'text-text2' };

export default function AIFeedback({ feedback, busy, canAsk, onAsk }) {
  return (
    <div>
      <div className="flex items-baseline justify-between border-b border-border pb-3">
        <div>
          <div className="text-[14px] font-medium">AI-generated advisory feedback</div>
          <div className="mt-0.5 text-[12px] text-muted">This does not affect your score.</div>
        </div>
        {canAsk && !busy && (
          <button
            type="button"
            onClick={onAsk}
            className="rounded border border-border-strong px-3 py-1.5 text-[13px] hover:bg-surface2"
          >
            {feedback ? 'Ask again' : 'Request feedback'}
          </button>
        )}
      </div>

      {!canAsk && (
        <p className="mt-3 text-[13px] text-muted">
          Submit a solution first. Feedback is written against what you submitted.
        </p>
      )}
      {busy && <p className="mt-3 text-[13px] text-text2">Reading your program.</p>}

      {feedback && !busy && (
        feedback.feedback ? (
          <Review review={feedback.feedback} model={feedback.model} promptVersion={feedback.promptVersion} />
        ) : (
          <p className="mt-3 text-[13px] text-text2">{feedback.note}</p>
        )
      )}
    </div>
  );
}

function Review({ review, model, promptVersion }) {
  return (
    <div className="mt-4">
      <Section heading="Strengths">{review.strengths}</Section>

      <h3 className="mt-5 font-mono text-[11px] uppercase tracking-wide text-muted">Issues</h3>
      <ul className="mt-1.5">
        {review.issues.map((issue) => (
          <li key={issue.detail} className="flex gap-3 border-b border-border py-2 last:border-0">
            <span className={`w-14 shrink-0 font-mono text-[11px] ${SEVERITY[issue.severity]}`}>
              {issue.severity}
            </span>
            <span className="text-[13px] leading-relaxed text-text2">{issue.detail}</span>
          </li>
        ))}
      </ul>

      <Section heading="Suggested next step">{review.suggestion}</Section>

      <div className="mt-5 border-t border-border pt-2 font-mono text-[11px] text-muted">
        model {model} · prompt {promptVersion} · confidence {review.confidence}
      </div>
    </div>
  );
}

function Section({ heading, children }) {
  return (
    <div className="mt-5">
      <h3 className="font-mono text-[11px] uppercase tracking-wide text-muted">{heading}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-text2">{children}</p>
    </div>
  );
}

// Feedback on work already submitted. This is the only way to reach it wherever
// code cannot be run, which is anywhere without a Docker daemon.
export function SubmissionAdvice({ submissionId }) {
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      setFeedback(await getFeedback(submissionId));
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-border pt-3">
      <AIFeedback feedback={feedback} busy={busy} canAsk onAsk={ask} />
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
    </div>
  );
}
