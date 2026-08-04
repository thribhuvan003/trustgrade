// Tests 1-3 from the PRD, plus the two behaviours approval.js exists to provide:
// a real audit trail and a version guard that refuses to overwrite.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/prisma.js';
import { transition } from '../src/services/approval.js';

const EMAIL = 'approval-test@trustgrade.test';
let teacherId;

beforeAll(async () => {
  const teacher = await prisma.user.upsert({
    where: { email: EMAIL },
    update: {},
    create: { email: EMAIL, name: 'Priya Raman', role: 'TEACHER' },
  });
  teacherId = teacher.id;
});

afterAll(async () => {
  await prisma.doubt.deleteMany({ where: { user: { email: EMAIL } } });
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  await prisma.$disconnect();
});

async function newDraft() {
  const doubt = await prisma.doubt.create({
    data: { userId: teacherId, title: 'Sliding window question', body: 'Why is my answer off by one?' },
  });
  return prisma.answer.create({
    data: { doubtId: doubt.id, aiDraft: 'model draft', riskFlags: [], model: 'none', promptVersion: 'v1' },
  });
}

async function approvedAnswer() {
  const draft = await newDraft();
  const pending = await transition({
    answerId: draft.id, to: 'PENDING_REVIEW', actorId: teacherId, expectedVersion: draft.version,
  });
  return transition({
    answerId: draft.id, to: 'APPROVED', actorId: teacherId,
    expectedVersion: pending.version, publishedText: 'Reviewed and published answer.',
  });
}

describe('answer approval', () => {
  it('refuses to jump straight from draft to approved', async () => {
    const draft = await newDraft();
    await expect(transition({
      answerId: draft.id, to: 'APPROVED', actorId: teacherId,
      expectedVersion: draft.version, publishedText: 'Sneaking this through.',
    })).rejects.toThrow(/cannot move from DRAFT to APPROVED/);
  });

  it('refuses to reopen an approved answer', async () => {
    const approved = await approvedAnswer();
    await expect(transition({
      answerId: approved.id, to: 'PENDING_REVIEW', actorId: teacherId, expectedVersion: approved.version,
    })).rejects.toThrow(/cannot move from APPROVED to PENDING_REVIEW/);
  });

  it('blocks the same jump when raw SQL bypasses this service', async () => {
    const draft = await newDraft();
    await expect(
      prisma.$executeRaw`UPDATE "Answer" SET status='APPROVED' WHERE id=${draft.id}`
    ).rejects.toThrow(/illegal answer transition: DRAFT -> APPROVED/);

    const after = await prisma.answer.findUnique({ where: { id: draft.id } });
    expect(after.status).toBe('DRAFT');
  });

  it('refuses a request that carries no version number', async () => {
    const draft = await newDraft();
    await expect(transition({
      answerId: draft.id, to: 'PENDING_REVIEW', actorId: teacherId,
    })).rejects.toThrow(/version number is required/);
  });

  it('reports an illegal transition as a conflict even when its reason is missing', async () => {
    const draft = await newDraft();
    await expect(transition({
      answerId: draft.id, to: 'REJECTED', actorId: teacherId, expectedVersion: draft.version,
    })).rejects.toThrow(/cannot move from DRAFT to REJECTED/);
  });

  it('records every accepted change in the audit trail', async () => {
    const approved = await approvedAnswer();
    const trail = await prisma.answerTransition.findMany({
      where: { answerId: approved.id }, orderBy: { createdAt: 'asc' },
    });
    expect(trail.map((t) => `${t.fromStatus}->${t.toStatus}`))
      .toEqual(['DRAFT->PENDING_REVIEW', 'PENDING_REVIEW->APPROVED']);
  });

  it('refuses a stale version instead of overwriting another reviewer', async () => {
    const draft = await newDraft();
    await transition({
      answerId: draft.id, to: 'PENDING_REVIEW', actorId: teacherId, expectedVersion: draft.version,
    });

    // Still holding version 0, which the first transition has already consumed.
    await expect(transition({
      answerId: draft.id, to: 'APPROVED', actorId: teacherId,
      expectedVersion: draft.version, publishedText: 'Written against a stale copy.',
    })).rejects.toThrow(/Another reviewer changed this answer first/);

    const after = await prisma.answer.findUnique({ where: { id: draft.id } });
    expect(after.status).toBe('PENDING_REVIEW');
    expect(after.publishedText).toBeNull();
  });
});
