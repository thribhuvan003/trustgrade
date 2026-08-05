-- What the model reported about its own answer. Surfaced in the review queue so
-- a teacher can triage without opening every draft.
ALTER TABLE "Answer" ADD COLUMN "confidence" TEXT NOT NULL DEFAULT 'unknown';
