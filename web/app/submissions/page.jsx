'use client';

import { useEffect, useState } from 'react';
import { getSubmissions } from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    getSubmissions().then(setSubmissions).catch((error) => setLoadError(error.message));
  }, []);

  if (loadError) {
    return <p className="p-8 text-[14px] text-danger">{loadError}</p>;
  }
  if (!submissions) {
    return <p className="p-8 text-[14px] text-muted">Loading submissions.</p>;
  }

  return (
    <div className="px-7 py-6">
      <h1 className="page-title">Submissions</h1>

      {submissions.length === 0 ? (
        <p className="mt-4 text-[14px] text-text2">You have not submitted a solution yet.</p>
      ) : (
        <div className="mt-5 border-t border-border">
          <TableHeader />
          {submissions.map((submission) => (
            <SubmissionRow
              key={submission.id}
              submission={submission}
              open={openId === submission.id}
              onToggle={() => setOpenId(openId === submission.id ? null : submission.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TableHeader() {
  return (
    <div className="flex items-center gap-4 border-b border-border px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-muted">
      <span className="w-32">Submitted</span>
      <span className="min-w-0 flex-1">Problem</span>
      <span className="w-16 text-right">Score</span>
      <span className="w-16 text-right">Passed</span>
      <span className="w-40">Verdict</span>
      <span className="w-20 text-right">Runtime</span>
    </div>
  );
}

function overallVerdict(submission) {
  if (submission.status === 'FAILED') return 'FAILED';
  if (submission.passed === submission.total) return 'OK';
  return submission.results.find((result) => !result.passed)?.verdict ?? 'OK';
}

function formatTime(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function SubmissionRow({ submission, open, onToggle }) {
  const scored = submission.status !== 'FAILED';

  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-3 py-2.5 text-left text-[13px] hover:bg-surface2"
      >
        <span className="tnum w-32 font-mono text-[12px] text-muted">{formatTime(submission.createdAt)}</span>
        <span className="min-w-0 flex-1 truncate text-text">{submission.problem.title}</span>
        <span className="tnum w-16 text-right font-mono text-[12px]">{scored ? `${submission.score}/100` : '—'}</span>
        <span className="tnum w-16 text-right font-mono text-[12px]">
          {scored ? `${submission.passed}/${submission.total}` : '—'}
        </span>
        <span className="w-40"><StatusBadge status={overallVerdict(submission)} /></span>
        <span className="tnum w-20 text-right font-mono text-[12px] text-text2">
          {scored ? `${submission.runtimeMs} ms` : '—'}
        </span>
      </button>

      {open && <SubmissionDetail submission={submission} />}
    </div>
  );
}

function SubmissionDetail({ submission }) {
  return (
    <div className="border-t border-border bg-surface px-3 py-4">
      <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded bg-code-bg p-3 font-mono text-[12px] text-code-fg">
        {submission.code}
      </pre>

      {submission.status === 'FAILED' ? (
        <p className="mt-3 text-[13px] text-muted">
          The sandbox was unavailable when this ran, so it was never scored.
        </p>
      ) : (
        <ul className="mt-3">
          {submission.results.map((result, index) => (
            <li key={result.id} className="border-b border-border py-2 last:border-0">
              <div className="flex items-center gap-3">
                <span className="tnum w-14 font-mono text-[12px] text-muted">Test {index + 1}</span>
                <StatusBadge status={result.passed ? 'OK' : result.verdict} />
                <span className="tnum ml-auto font-mono text-[12px] text-muted">{result.runtimeMs} ms</span>
              </div>
              {result.hidden ? (
                <p className="mt-1 pl-14 text-[12px] text-muted">
                  Hidden test. Input and expected output stay hidden.
                </p>
              ) : (
                !result.passed && (
                  <dl className="mt-1.5 pl-14 font-mono text-[12px]">
                    <Row term="expected" value={result.expected} />
                    <Row term="received" value={result.received || '(nothing)'} />
                  </dl>
                )
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ term, value }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 text-muted">{term}</dt>
      <dd className="whitespace-pre-wrap text-text2">{value}</dd>
    </div>
  );
}
