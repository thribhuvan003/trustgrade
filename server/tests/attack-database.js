// Raw SQL attacks on the database guards, re-run on every push as a regression
// gate.
//
// Every statement here is raw SQL. It never touches approval.js, so what holds
// is the database itself: a CHECK constraint, a partial unique index, and a
// BEFORE INSERT OR UPDATE trigger.
import { prisma } from '../src/lib/prisma.js';

const EMAIL = 'attack@trustgrade.test';

const draft = (id, doubtId) => prisma.$executeRaw`
  INSERT INTO "Answer" (id,"doubtId","aiDraft",status,"riskFlags",model,"promptVersion")
  VALUES (${id}, ${doubtId}, 'model draft', 'DRAFT', ARRAY[]::text[], 'none', 'v1')`;

const setStatus = (id, status) => prisma.$executeRaw`
  UPDATE "Answer" SET status=${status}::"AnswerStatus" WHERE id=${id}`;

const publish = (id, status) => prisma.$executeRaw`
  UPDATE "Answer" SET status=${status}::"AnswerStatus", "publishedText"='published' WHERE id=${id}`;

const insertAs = (id, doubtId, status) => prisma.$executeRaw`
  INSERT INTO "Answer" (id,"doubtId","aiDraft",status,"publishedText","riskFlags",model,"promptVersion")
  VALUES (${id}, ${doubtId}, 'draft', ${status}::"AnswerStatus", 'forged', ARRAY[]::text[], 'none', 'v1')`;

// Prisma wraps database errors in its own prose but also exposes the Postgres
// message and SQLSTATE as structured fields. Read those rather than scraping
// the wrapper, and report what Postgres actually said without embellishing it.
// Note: Prisma does not pass through the constraint name on a unique violation,
// only the SQLSTATE, so that row is identified by code.
function reason(error) {
  const raw = String(error.meta?.message ?? error.message).replace(/\s+/g, ' ').trim();
  const sentence = raw
    .replace(/^ERROR:\s*/, '')
    .split(/ (?:CONTEXT|DETAIL):/)[0]
    .replace(/=\([^)]{12,}\)/, '=(...)')
    .trim();

  const named = sentence.match(/constraint "([^"]+)"/);
  if (named) return `violates ${named[1]}`;
  return error.meta?.code ? `${sentence} [SQLSTATE ${error.meta.code}]` : sentence;
}

async function shouldFail(record, attack, expected, run) {
  try {
    await run();
    record('database', attack, expected, 'SUCCEEDED - the guard did not hold', false);
  } catch (error) {
    record('database', attack, expected, reason(error), true);
  }
}

async function shouldPass(record, attack, expected, run) {
  try {
    await run();
    record('database', attack, expected, 'allowed', true);
  } catch (error) {
    record('database', attack, expected, `REFUSED - ${reason(error)}`, false);
  }
}

async function insertGuards(record, doubt) {
  await shouldFail(record, 'insert an approved answer', 'must be born DRAFT',
    () => insertAs('atk-forged', doubt, 'APPROVED'));
  await shouldFail(record, 'insert skipping straight to review', 'must be born DRAFT',
    () => insertAs('atk-skip', doubt, 'PENDING_REVIEW'));
  await shouldFail(record, 'insert a draft holding published text', 'check constraint',
    () => insertAs('atk-sneak', doubt, 'DRAFT'));
  await shouldPass(record, 'insert a draft', 'allowed', () => draft('atk-a', doubt));
}

async function transitionGuards(record) {
  await shouldFail(record, 'draft straight to approved', 'illegal transition', () => setStatus('atk-a', 'APPROVED'));
  await shouldFail(record, 'draft straight to rejected', 'illegal transition', () => setStatus('atk-a', 'REJECTED'));
  await shouldPass(record, 'draft to pending review', 'allowed', () => setStatus('atk-a', 'PENDING_REVIEW'));
  await shouldFail(record, 'publish while still pending', 'check constraint',
    () => prisma.$executeRaw`UPDATE "Answer" SET "publishedText"='leaked' WHERE id='atk-a'`);
  await shouldPass(record, 'pending review to rejected', 'allowed', () => setStatus('atk-a', 'REJECTED'));
  await shouldFail(record, 'reopen a rejected answer', 'rejected is terminal', () => setStatus('atk-a', 'PENDING_REVIEW'));
  await shouldFail(record, 'approve a rejected answer', 'rejected is terminal', () => setStatus('atk-a', 'APPROVED'));
}

async function answeringAgain(record, doubt) {
  await shouldPass(record, 'answer the doubt again after rejection', 'allowed', () => draft('atk-b', doubt));
  await shouldPass(record, 'second answer to pending review', 'allowed', () => setStatus('atk-b', 'PENDING_REVIEW'));
  await shouldPass(record, 'second answer approved', 'allowed', () => publish('atk-b', 'APPROVED'));
  await shouldFail(record, 'reopen an approved answer', 'approved is terminal', () => setStatus('atk-b', 'PENDING_REVIEW'));
}

async function onlyOneApproved(record, doubt) {
  await shouldPass(record, 'a competing draft', 'allowed', () => draft('atk-c', doubt));
  await shouldPass(record, 'competing draft to pending review', 'allowed', () => setStatus('atk-c', 'PENDING_REVIEW'));
  await shouldFail(record, 'a second approved answer on one doubt', 'partial unique index',
    () => publish('atk-c', 'APPROVED'));
  await shouldFail(record, 'delete then reinsert as approved', 'must be born DRAFT', async () => {
    await prisma.$executeRaw`DELETE FROM "Answer" WHERE id='atk-c'`;
    await insertAs('atk-c', doubt, 'APPROVED');
  });
}

export async function attackDatabase(record) {
  const user = await prisma.user.upsert({
    where: { email: EMAIL }, update: {},
    create: { email: EMAIL, name: 'Attack Fixture', role: 'STUDENT' },
  });
  const doubt = await prisma.doubt.create({
    data: { userId: user.id, title: 'Fixture doubt', body: 'body' },
  });

  await insertGuards(record, doubt.id);
  await transitionGuards(record);
  await answeringAgain(record, doubt.id);
  await onlyOneApproved(record, doubt.id);

  await prisma.doubt.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
}
