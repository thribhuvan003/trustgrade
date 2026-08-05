'use client';

import { useEffect, useState } from 'react';
import TestResults from './TestResults';
import AIFeedback from './AIFeedback';

// The tabbed console under the editor. It owns which tab is showing, and jumps
// back to the tests whenever a new run starts, because that is what the student
// just asked for.
export default function ResultConsole({ outcome, feedback, busy, error, onAskFeedback }) {
  const [tab, setTab] = useState('tests');

  useEffect(() => {
    if (busy === 'run' || busy === 'submit') setTab('tests');
    if (busy === 'feedback') setTab('feedback');
  }, [busy]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex shrink-0 gap-1 border-b border-border px-4">
        <Tab active={tab === 'tests'} onClick={() => setTab('tests')}>Test results</Tab>
        <Tab active={tab === 'feedback'} onClick={() => setTab('feedback')}>AI feedback</Tab>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {error && <p className="mb-3 text-[13px] text-danger">{error}</p>}
        {tab === 'tests' ? (
          <TestResults outcome={outcome} busy={busy} />
        ) : (
          <AIFeedback
            feedback={feedback}
            busy={busy === 'feedback'}
            canAsk={Boolean(outcome?.id)}
            onAsk={onAskFeedback}
          />
        )}
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border-b-2 px-3 py-2 text-[13px] transition-colors ${
        active ? 'border-accent font-medium text-text' : 'border-transparent text-text2 hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}
