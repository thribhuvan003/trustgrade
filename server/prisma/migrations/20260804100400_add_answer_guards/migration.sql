-- Database-level guards for the answer approval workflow.
-- PostgreSQL decides which transitions are legal.
-- Express decides who may request one.
--
-- Scope of the guarantee: these hold against ordinary SQL issued on this
-- database, including psql sessions that bypass the API entirely. They do not
-- hold against a Postgres superuser, who can run
-- "SET session_replication_role = replica" or "ALTER TABLE ... DISABLE TRIGGER"
-- and skip the trigger -- just as they could drop the table. The demo's single
-- credential is such a superuser, so the README says "ordinary application SQL"
-- rather than claiming the workflow is unconditionally tamper-proof.

-- 1. publishedText may only exist on an approved answer.
ALTER TABLE "Answer"
  ADD CONSTRAINT "answer_published_only_when_approved"
  CHECK ("publishedText" IS NULL OR "status" = 'APPROVED');

-- 2. At most one APPROVED answer per doubt.
--    A doubt may hold several answers, because REJECTED is terminal and a
--    rejected doubt must still be answerable by a fresh draft. This index is
--    therefore the only thing stopping two published answers to one question.
CREATE UNIQUE INDEX "answer_one_approved_per_doubt"
  ON "Answer" ("doubtId")
  WHERE "status" = 'APPROVED';

-- 3. Every answer is born DRAFT, and only
--    DRAFT -> PENDING_REVIEW -> APPROVED | REJECTED may follow.
--    APPROVED and REJECTED are terminal.
--
--    INSERT is guarded as well as UPDATE. Without the INSERT arm, a direct
--    "INSERT ... status='APPROVED'" would forge a published answer that never
--    passed through review, and delete-then-reinsert would do the same while
--    discarding the audit trail.
CREATE OR REPLACE FUNCTION enforce_answer_transition()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'DRAFT' THEN
      RAISE EXCEPTION 'answers must be created as DRAFT, got %', NEW."status"
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."status" = OLD."status" THEN
    RETURN NEW;
  END IF;

  IF (OLD."status" = 'DRAFT'          AND NEW."status" = 'PENDING_REVIEW')
  OR (OLD."status" = 'PENDING_REVIEW' AND NEW."status" IN ('APPROVED', 'REJECTED')) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'illegal answer transition: % -> %', OLD."status", NEW."status"
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "answer_transition_guard"
  BEFORE INSERT OR UPDATE ON "Answer"
  FOR EACH ROW
  EXECUTE FUNCTION enforce_answer_transition();
