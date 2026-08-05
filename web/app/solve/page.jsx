'use client';

import { useEffect, useRef, useState } from 'react';
import { getProblem, runVisibleTests, submitSolution, getFeedback } from '../../lib/api';
import ProblemPanel from '../../components/ProblemPanel';
import ResultConsole from '../../components/ResultConsole';
import SplitPane from '../../components/SplitPane';

const PROBLEM_ID = 'longest-stable-segment';
// False only on the hosted build, where there is no Docker daemon to run code in.
const SANDBOX_AVAILABLE = process.env.NEXT_PUBLIC_SANDBOX_AVAILABLE !== 'false';

const STARTER = `import sys

data = sys.stdin.read().split()
n, limit = int(data[0]), int(data[1])
values = list(map(int, data[2:2 + n]))

# Return the length of the longest run where max - min <= limit.
print(0)
`;

export default function SolvePage() {
  const [problem, setProblem] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [code, setCode] = useState(STARTER);
  const [busy, setBusy] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [actionError, setActionError] = useState(null);
  // Disabling the button is state, so React has not re-rendered yet when a
  // second click lands. Without this, three quick clicks graded three times and
  // wrote three rows into the student's history.
  const running = useRef(false);

  useEffect(() => {
    getProblem(PROBLEM_ID).then(setProblem).catch((error) => setLoadError(error.message));
  }, []);

  async function act(kind) {
    if (running.current) return;
    running.current = true;
    setBusy(kind);
    setActionError(null);
    try {
      const call = kind === 'run' ? runVisibleTests : submitSolution;
      setOutcome({ ...(await call(PROBLEM_ID, code)), kind });
      if (kind === 'submit') setFeedback(null);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(null);
      running.current = false;
    }
  }

  async function askForFeedback() {
    if (running.current) return;
    running.current = true;
    setBusy('feedback');
    try {
      setFeedback(await getFeedback(outcome.id));
    } catch (error) {
      setActionError(error.message);
    } finally {
      setBusy(null);
      running.current = false;
    }
  }

  if (loadError) return <p className="p-8 text-[14px] text-danger">{loadError}</p>;
  if (!problem) return <p className="p-8 text-[14px] text-muted">Loading the problem.</p>;

  const workspace = (
    <div className="flex h-full min-h-0 flex-col border-l border-border">
      {!SANDBOX_AVAILABLE && (
        <p className="shrink-0 border-b border-border bg-warn-soft px-6 py-2.5 text-[12px] leading-relaxed text-warn">
          This hosted copy has no Docker daemon, so code is not executed here and Run and Submit
          will not score. Everything else works: the doubt board, the AI drafts and the teacher
          review. Clone the repository and run <span className="font-mono">docker compose up</span> to
          grade for real.
        </p>
      )}

      <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-3">
        <div className="font-mono text-[12px] text-text2">
          solution.py <span className="text-muted">· Python 3.11</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => act('run')}
            disabled={Boolean(busy)}
            className="rounded border border-border-strong px-3 py-1.5 text-[13px] transition-colors hover:bg-surface2 disabled:opacity-50"
          >
            {busy === 'run' ? 'Running visible tests' : 'Run tests'}
          </button>
          <button
            type="button"
            onClick={() => act('submit')}
            disabled={Boolean(busy)}
            className="rounded bg-accent px-3 py-1.5 text-[13px] text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {busy === 'submit' ? 'Grading all tests' : 'Submit solution'}
          </button>
        </div>
      </div>

      <SplitPane
        row={false}
        initial={54}
        min={25}
        max={82}
        first={(
          <textarea
            value={code}
            spellCheck={false}
            onChange={(event) => setCode(event.target.value)}
            className="dark-scroll h-full w-full resize-none bg-code-bg p-5 font-mono text-[13px] leading-relaxed text-code-fg outline-none"
          />
        )}
        second={(
          <ResultConsole
            outcome={outcome}
            feedback={feedback}
            busy={busy}
            error={actionError}
            onAskFeedback={askForFeedback}
          />
        )}
      />
    </div>
  );

  return (
    <SplitPane
      initial={40}
      first={<div className="h-full overflow-y-auto px-7 py-6"><ProblemPanel problem={problem} /></div>}
      second={workspace}
    />
  );
}
