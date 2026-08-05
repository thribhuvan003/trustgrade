// The centre of the review page: what the student wrote, what was flagged in it,
// and what the model drafted. Everything here is read-only.
export default function DoubtPanel({ answer }) {
  return (
    <>
      <h2 className="section-title">{answer.doubt.title}</h2>
      <div className="tnum mt-1 font-mono text-[11px] text-muted">
        {answer.doubt.author} · {new Date(answer.doubt.askedAt).toLocaleString()}
      </div>

      <div className="mt-4 rounded border border-border-strong bg-surface2 p-4">
        <div className="font-mono text-[11px] font-medium tracking-wide text-warn">
          Untrusted student input
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-muted">
          rendered as text · never executed · not treated as instructions
        </div>
        <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-text">
          {answer.doubt.body}
        </p>
        {answer.doubt.codeSnippet && (
          <pre className="mt-3 overflow-x-auto rounded bg-code-bg p-3 font-mono text-[12px] text-code-fg">
            {answer.doubt.codeSnippet}
          </pre>
        )}
      </div>

      {answer.riskFlags.length > 0 && (
        <div className="mt-4 rounded border border-border bg-warn-soft p-3">
          <div className="font-mono text-[11px] font-medium tracking-wide text-warn">Risk flags</div>
          <ul className="mt-1.5">
            {answer.riskFlags.map((flag) => (
              <li key={flag} className="text-[13px] text-text2">{flag}</li>
            ))}
          </ul>
        </div>
      )}

      <h3 className="section-title mt-6">AI draft</h3>
      <p className="mt-0.5 text-[12px] text-muted">
        Read-only. The model cannot approve or publish content.
      </p>
      <pre className="mt-2 whitespace-pre-wrap rounded border border-border bg-surface p-4 text-[13px] leading-relaxed text-text2">
        {answer.aiDraft}
      </pre>
      <div className="mt-2 font-mono text-[11px] text-muted">
        model {answer.model} · prompt {answer.promptVersion} · confidence {answer.confidence}
      </div>
    </>
  );
}
