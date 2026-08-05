// The left half of the solve workspace: the statement a student is answering.
export default function ProblemPanel({ problem }) {
  return (
    <>
      <div className="font-mono text-[11px] uppercase tracking-wide text-muted">
        Problem 1 · Medium
      </div>
      <h1 className="page-title mt-1">{problem.title}</h1>
      <p className="mt-4 text-[14px] leading-relaxed text-text2">{problem.description}</p>

      <Block heading="Input">{problem.inputFormat}</Block>
      <Block heading="Output">{problem.outputFormat}</Block>
      <Block heading="Constraints" mono>{problem.constraints}</Block>

      <h2 className="section-title mt-7">Examples</h2>
      {problem.examples.map((example) => (
        <div key={example.input} className="mt-3 rounded border border-border bg-surface p-3">
          <pre className="whitespace-pre-wrap font-mono text-[12px] text-text">{example.input}</pre>
          <div className="mt-2 border-t border-border pt-2 font-mono text-[12px] text-accent">
            {example.output}
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-text2">{example.explanation}</p>
        </div>
      ))}

      <p className="mt-7 rounded border border-border bg-surface2 p-3 text-[13px] leading-relaxed text-text2">
        Your score is determined only by test cases. AI feedback does not affect your score.
      </p>
    </>
  );
}

function Block({ heading, children, mono }) {
  return (
    <div className="mt-5">
      <h2 className="font-mono text-[11px] uppercase tracking-wide text-muted">{heading}</h2>
      <p className={`mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-text2 ${mono ? 'font-mono' : ''}`}>
        {children}
      </p>
    </div>
  );
}
