// A plain list, not a timeline graphic. Every row is a real AnswerTransition.
export default function AuditTrail({ transitions }) {
  if (!transitions?.length) {
    return <p className="mt-2 text-[12px] text-muted">Nothing has moved yet.</p>;
  }

  return (
    <ol className="mt-2">
      {transitions.map((step) => (
        <li key={step.createdAt} className="border-b border-border py-2 last:border-0">
          <div className="font-mono text-[11px] text-text2">
            {step.fromStatus.toLowerCase().replace('_', ' ')} to {step.toStatus.toLowerCase().replace('_', ' ')}
          </div>
          <div className="tnum mt-0.5 font-mono text-[11px] text-muted">
            {step.actor.name} · {new Date(step.createdAt).toLocaleString()}
          </div>
          {step.note && <p className="mt-1 text-[12px] leading-relaxed text-text2">{step.note}</p>}
        </li>
      ))}
    </ol>
  );
}
