import StatusBadge from './StatusBadge';

export default function TestResults({ outcome, busy }) {
  if (busy === 'run' || busy === 'submit') {
    return (
      <p className="text-[13px] text-text2">
        {busy === 'run' ? 'Running the visible tests.' : 'Grading against every test case.'} Each one
        runs in its own container, so this takes a few seconds.
      </p>
    );
  }

  if (!outcome) {
    return (
      <p className="text-[13px] text-muted">
        Run the visible tests while you work, or submit to be graded against every case.
      </p>
    );
  }

  const { results, passed, total, score, kind } = outcome;

  return (
    <div>
      <div className="flex items-baseline gap-6 border-b border-border pb-4">
        <div>
          <div className="tnum font-mono text-[26px] leading-none">{score} / 100</div>
          <div className="mt-1 text-[12px] text-muted">
            {kind === 'run' ? 'Visible tests only, not saved' : 'Recorded'}
          </div>
        </div>
        <div className="text-[14px] text-text2">
          {passed} of {total} tests passed.
        </div>
      </div>

      <ul className="mt-3">
        {results.map((result, index) => (
          <li key={result.id} className="border-b border-border py-2.5 last:border-0">
            <div className="flex items-center gap-3">
              <span className="tnum w-14 font-mono text-[12px] text-muted">
                Test {index + 1}
              </span>
              <StatusBadge status={result.passed ? 'OK' : result.verdict} />
              <span className="tnum ml-auto font-mono text-[12px] text-muted">
                {result.runtimeMs} ms
              </span>
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
