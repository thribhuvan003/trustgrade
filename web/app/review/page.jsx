'use client';

import { useEffect, useState } from 'react';
import { getReviewQueue, approveAnswer, rejectAnswer } from '../../lib/api';
import DoubtPanel from '../../components/DoubtPanel';
import DecisionPanel from '../../components/DecisionPanel';
import SplitPane from '../../components/SplitPane';

export default function ReviewPage() {
  const [queue, setQueue] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [published, setPublished] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);

  async function load() {
    try {
      const waiting = await getReviewQueue();
      setQueue(waiting);
      setSelectedId((current) => (waiting.some((a) => a.id === current) ? current : waiting[0]?.id ?? null));
    } catch (failure) {
      setError(failure.message);
    }
  }

  useEffect(() => { load(); }, []);

  const selected = queue?.find((answer) => answer.id === selectedId) ?? null;

  useEffect(() => {
    setPublished(selected?.aiDraft ?? '');
    setNote('');
    setError(null);
    setDone(null);
  }, [selectedId]);

  async function decide(kind) {
    setBusy(true);
    setError(null);
    try {
      await (kind === 'approve'
        ? approveAnswer(selected.id, published, selected.version)
        : rejectAnswer(selected.id, note, selected.version));
      setDone(kind === 'approve'
        ? 'This answer is now visible to students.'
        : 'This draft remains hidden from students.');
      await load();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !queue) return <p className="p-8 text-[14px] text-danger">{error}</p>;
  if (!queue) return <p className="p-8 text-[14px] text-muted">Loading the review queue.</p>;

  const list = (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-border px-5 py-5">
        <h1 className="page-title">Review queue</h1>
        <p className="tnum mt-1 font-mono text-[11px] text-muted">{queue.length} awaiting review</p>
      </div>
      {queue.length === 0 && (
        <p className="px-5 py-4 text-[13px] leading-relaxed text-muted">
          Nothing is waiting. Approved and rejected answers leave this queue.
        </p>
      )}
      {queue.map((answer) => (
        <button
          key={answer.id}
          type="button"
          onClick={() => setSelectedId(answer.id)}
          className={`block w-full border-b border-border px-5 py-3 text-left transition-colors ${
            answer.id === selectedId ? 'bg-accent-soft' : 'hover:bg-surface2'
          }`}
        >
          <div className="truncate text-[13px] font-medium">{answer.doubt.title}</div>
          <div className="mt-0.5 truncate text-[12px] text-text2">{answer.doubt.author}</div>
          <div className="tnum mt-1 font-mono text-[11px] text-muted">
            {answer.riskFlags.length} flags · confidence {answer.confidence} · v{answer.version}
          </div>
        </button>
      ))}
    </div>
  );

  const centre = (
    <div className="h-full overflow-y-auto border-l border-border px-6 py-5">
      {selected
        ? <DoubtPanel answer={selected} />
        : <p className="text-[13px] text-muted">Select a question to review.</p>}
    </div>
  );

  const decision = selected ? (
    <DecisionPanel
      answer={selected}
      published={published}
      note={note}
      busy={busy}
      error={error}
      done={done}
      onPublishedChange={setPublished}
      onNoteChange={setNote}
      onDecide={decide}
    />
  ) : <div className="h-full border-l border-border" />;

  return (
    <SplitPane
      initial={24}
      min={16}
      max={40}
      first={list}
      second={<SplitPane initial={58} min={34} max={76} first={centre} second={decision} />}
    />
  );
}
