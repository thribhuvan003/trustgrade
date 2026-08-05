import StatusBadge, { outcomeOf } from './StatusBadge';


export default function TestResults({ outcome, busy, error }) {
  if (busy === 'run' || busy === 'submit') {
    return (
      <p className="text-[13px] text-text2">
        {busy === 'run' ? 'Running the visible tests.' : 'Grading against every test case.'} Each one
        runs in its own container, so this takes a few seconds.
      </p>
    );
  }

  // The console already shows the error. Inviting the student to run the tests
  // directly underneath it would contradict what just happened.
  if (!outcome) {
    if (error) return null;
    return (
      <p className="text-[13px] text-muted">
        Run the visible tests while you work, or submit to be graded against every case.
      </p>
    );
  }

  const { results, passed, total, score, kind } = outcome;

  return (
    <div>
      {/* A run covers the two visible cases, so its score is not the score. Showing
          "100 / 100" for it invites exactly the wrong conclusion, which is the one
          thing this project is meant not to do. Only a graded submission gets a number. */}
      <div className="flex items-baseline gap-6 border-b border-border pb-4">
        {kind === 'run' ? (
          <div>
            <div className="tnum font-mono text-[26px] leading-none">
              {passed} / {total}
            </div>
            <div className="mt-1 text-[12px] text-muted">Visible tests only, not scored or saved</div>
          </div>
        ) : (
          <>
            <div>
              <div className="tnum font-mono text-[26px] leading-none">{score} / 100</div>
              <div className="mt-1 text-[12px] text-muted">Recorded</div>
            </div>
            <div className="text-[14px] text-text2">
              {passed} of {total} tests passed.
            </div>
          </>
        )}
      </div>

      <ul className="mt-3">
        {results.map((result, index) => (
          <li key={result.id} className="border-b border-border py-2.5 last:border-0">
            <div className="flex items-center gap-3">
              <span className="tnum w-14 font-mono text-[12px] text-muted">
                Test {index + 1}
              </span>
              <StatusBadge status={outcomeOf(result)} />
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
