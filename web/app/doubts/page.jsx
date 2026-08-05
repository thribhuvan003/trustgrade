'use client';

import { useEffect, useState } from 'react';
import { getDoubts, askDoubt } from '../../lib/api';
import StatusBadge from '../../components/StatusBadge';

const PREVIEW_LENGTH = 140;

export default function DoubtsPage() {
  const [doubts, setDoubts] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  async function load() {
    try {
      setDoubts(await getDoubts());
      setLoadError(null);
    } catch (error) {
      setLoadError(error.message);
    }
  }
  useEffect(() => { load(); }, []);

  if (loadError && !doubts) return <p className="p-8 text-[14px] text-danger">{loadError}</p>;
  if (!doubts) return <p className="p-8 text-[14px] text-muted">Loading questions.</p>;
  return (
    <div className="h-full overflow-y-auto px-8 py-6">
      <h1 className="page-title">Doubt board</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-text2">
        Questions are visible to everyone straight away. Their AI-drafted answers appear only after a teacher has reviewed them.
      </p>
      <Composer onPosted={load} />
      <h2 className="section-title mt-8">
        Questions <span className="tnum font-mono text-[13px] font-normal text-muted">({doubts.length})</span>
      </h2>
      {doubts.length === 0 ? (
        <p className="mt-3 text-[13px] text-muted">No questions yet. Be the first to ask.</p>
      ) : (
        <ul className="mt-3 border-t border-border">
          {doubts.map((doubt) => (
            <DoubtRow key={doubt.id} doubt={doubt} expanded={doubt.id === expandedId}
              onToggle={() => setExpandedId((id) => (id === doubt.id ? null : doubt.id))} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Composer({ onPosted }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState(null);
  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !posting;
  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setPosting(true);
    setError(null);
    try {
      await askDoubt({ title: title.trim(), body: body.trim(), codeSnippet: codeSnippet.trim() || null });
      setTitle('');
      setBody('');
      setCodeSnippet('');
      await onPosted();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setPosting(false);
    }
  }
  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded border border-border bg-surface p-4">
      <ComposerFields title={title} setTitle={setTitle} body={body} setBody={setBody}
        codeSnippet={codeSnippet} setCodeSnippet={setCodeSnippet} />
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      <button type="submit" disabled={!canSubmit}
        className="mt-3 rounded bg-accent px-3 py-1.5 text-[13px] text-white hover:bg-accent-hover disabled:opacity-50">
        {posting ? 'Posting' : 'Post question'}
      </button>
    </form>
  );
}

function ComposerFields({ title, setTitle, body, setBody, codeSnippet, setCodeSnippet }) {
  return (
    <>
      <p className="text-[12px] text-muted">
        Do not include passwords, personal data or confidential information.
      </p>
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Title"
        className="mt-3 w-full rounded border border-border-strong bg-surface p-2 text-[13px] outline-none focus:border-accent" />
      <textarea value={body} onChange={(event) => setBody(event.target.value)}
        placeholder="Describe what you tried and where it breaks."
        className="mt-2 h-24 w-full resize-none rounded border border-border-strong bg-surface p-2 text-[13px] leading-relaxed outline-none focus:border-accent" />
      <div className="tnum text-right font-mono text-[11px] text-muted">{body.length} characters</div>
      <textarea value={codeSnippet} onChange={(event) => setCodeSnippet(event.target.value)}
        placeholder="Code snippet (optional)"
        className="mt-2 h-20 w-full resize-none rounded border border-border-strong bg-code-bg p-2 font-mono text-[12px] text-code-fg outline-none focus:border-accent" />
    </>
  );
}

function DoubtRow({ doubt, expanded, onToggle }) {
  const preview = doubt.body.length > PREVIEW_LENGTH ? `${doubt.body.slice(0, PREVIEW_LENGTH).trimEnd()}…` : doubt.body;
  return (
    <li className="border-b border-border">
      <button type="button" onClick={onToggle} className="block w-full py-3 text-left hover:bg-surface2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-text">{doubt.title}</div>
            {!expanded && <p className="mt-0.5 truncate text-[13px] text-text2">{preview}</p>}
          </div>
          <StatusBadge status={doubt.status} />
        </div>
        <div className="tnum mt-1.5 font-mono text-[11px] text-muted">
          {doubt.author} · {new Date(doubt.createdAt).toLocaleString()}
        </div>
      </button>
      {expanded && <DoubtDetail doubt={doubt} />}
    </li>
  );
}

function DoubtDetail({ doubt }) {
  return (
    <div className="pb-4">
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text2">{doubt.body}</p>
      {doubt.codeSnippet && (
        <pre className="mt-2 overflow-x-auto rounded bg-code-bg p-3 font-mono text-[12px] text-code-fg">{doubt.codeSnippet}</pre>
      )}
      {doubt.status === 'PENDING_REVIEW' && (
        <p className="mt-3 rounded border border-border bg-warn-soft p-3 text-[13px] leading-relaxed text-warn">
          Your question is awaiting teacher review. The generated draft remains private until approved.
        </p>
      )}
      {doubt.status === 'REJECTED' && (
        <p className="mt-3 rounded border border-border bg-danger-soft p-3 text-[13px] leading-relaxed text-danger">
          A teacher read the generated draft and chose not to publish it, so this question has no
          answer. Ask it again as a new question if you still need help.
        </p>
      )}
      {doubt.status === 'APPROVED' && doubt.answer && (
        <div className="mt-3 rounded border border-border bg-success-soft p-3">
          <div className="text-[12px] text-success">AI-assisted draft, reviewed and approved by a teacher</div>
          <div className="tnum mt-0.5 font-mono text-[11px] text-muted">
            {doubt.answer.reviewer} · {new Date(doubt.answer.approvedAt).toLocaleString()}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-text">{doubt.answer.text}</p>
        </div>
      )}
    </div>
  );
}
