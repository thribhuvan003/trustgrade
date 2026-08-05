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

  // Reset the editor when the teacher moves to a different answer. The
  // confirmation is deliberately not cleared here: approving pulls the next
  // answer into view, and wiping the message on that jump made a successful
  // approval look like nothing had happened.
  useEffect(() => {
    // Only a real model draft is worth starting from. When the model produced
    // nothing, aiDraft holds our own fallback sentence, and pre-loading that as
    // editable text means one unthinking click publishes it to a student.
    const drafted = selected && selected.model !== 'none';
    setPublished(drafted ? selected.aiDraft : '');
    setNote('');
    setError(null);
  }, [selectedId]);

  // Approving is irreversible, so losing a half-written answer to a stray
  // refresh should at least require confirming.
  useEffect(() => {
    const unsaved = () => published.trim() && published !== selected?.aiDraft;
    const warn = (event) => { if (unsaved()) event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [published, selected]);

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
    } catch (failure) {
      setError(failure.message);
    } finally {
      // Reload either way: on success the queue has changed, and on a conflict
      // it was already out of date.
      await load();
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
          // Clearing the confirmation here and not in the reset effect keeps it on
          // screen through the jump that approving causes, while stopping it from
          // following the teacher onto an answer they have not decided yet.
          onClick={() => { setSelectedId(answer.id); setDone(null); }}
          aria-current={answer.id === selectedId}
          className={`block w-full border-b border-border px-5 py-3 text-left transition-colors ${
            answer.id === selectedId ? 'bg-accent-soft' : 'hover:bg-surface2'
          }`}
        >
          <div className="truncate text-[13px] font-medium">{answer.doubt.title}</div>
          <div className="mt-0.5 truncate text-[12px] text-text2">{answer.doubt.author}</div>
          <div className="tnum mt-1 font-mono text-[11px] text-muted">
            <span className={answer.riskFlags.length ? 'font-medium text-warn' : undefined}>
              {answer.riskFlags.length} flags
            </span>
            {` · confidence ${answer.confidence} · v${answer.version}`}
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
  ) : (
    // Deciding the last answer empties the queue, and without this the panel
    // unmounts and the teacher never sees what happened to it.
    <div className="h-full border-l border-border px-6 py-5">
      <p className={`text-[13px] leading-relaxed ${done ? 'text-success' : 'text-muted'}`}>
        {done ?? 'Nothing selected.'}
      </p>
    </div>
  );

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
