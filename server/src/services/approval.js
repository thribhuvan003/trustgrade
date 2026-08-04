// The only place Answer.status is ever written.
//
// Postgres decides which transitions are legal (see the guards migration).
// This file decides the same thing a second time so the API can answer with a
// clear 409 instead of a database error, and so every accepted change leaves an
// AnswerTransition row behind.
import { prisma } from '../lib/prisma.js';

const ALLOWED = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
};

// clientMessage marks this as ours to show a reviewer, rather than an internal
// message that happened to carry a status code.
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  error.clientMessage = message;
  return error;
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

// Approving publishes text to students, so it must carry text.
// Rejecting is feedback to a teacher, so it must carry a reason.
function checkPayload(to, publishedText, note) {
  if (to === 'APPROVED' && !isText(publishedText)) {
    throw fail(400, 'An approved answer needs published text. Nothing was saved.');
  }
  if (to === 'REJECTED' && !isText(note)) {
    throw fail(400, 'A rejected answer needs a reason. Nothing was saved.');
  }
}

export async function transition({
  answerId, to, actorId, expectedVersion, publishedText = null, note = null,
}) {
  // Without this, an omitted version silently drops out of the where clause
  // below and the optimistic lock disappears without anyone noticing.
  if (!Number.isInteger(expectedVersion)) {
    throw fail(400, 'A version number is required so a concurrent edit can be detected. Nothing was saved.');
  }

  return prisma.$transaction(async (tx) => {
    const answer = await tx.answer.findUnique({ where: { id: answerId } });
    if (!answer) throw fail(404, 'That answer no longer exists.');
    if (!ALLOWED[answer.status].includes(to)) {
      throw fail(409, `An answer cannot move from ${answer.status} to ${to}.`);
    }
    checkPayload(to, publishedText, note);

    // The version guard is what makes two reviewers safe. If someone else
    // changed this answer first, no row matches and nothing is overwritten.
    const changed = await tx.answer.updateMany({
      where: { id: answerId, status: answer.status, version: expectedVersion },
      data: {
        status: to,
        version: { increment: 1 },
        ...(to === 'APPROVED' ? { publishedText } : {}),
      },
    });
    if (changed.count === 0) {
      throw fail(409, 'Another reviewer changed this answer first. Reload it to see their version.');
    }

    await tx.answerTransition.create({
      data: { answerId, fromStatus: answer.status, toStatus: to, actorId, note },
    });
    return tx.answer.findUnique({ where: { id: answerId } });
  });
}
