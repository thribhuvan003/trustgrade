import StatusBadge from './StatusBadge';

const PREVIEW_LENGTH = 140;

// One question on the board. A pending or rejected answer is never rendered,
// because the API does not send it in the first place.
export default function DoubtRow({ doubt, expanded, onToggle }) {
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
