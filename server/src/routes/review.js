import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/errors.js';
import { currentUser, requireTeacher } from '../middleware/role.js';
import { transition } from '../services/approval.js';

const router = Router();

// Every route below is a teacher action. Nothing here is reachable as a student.
router.use(requireTeacher);

const approval = z.object({
  publishedText: z.string().min(1),
  version: z.number().int().nonnegative(),
}).strict();

const rejection = z.object({
  note: z.string().min(1),
  version: z.number().int().nonnegative(),
}).strict();

function parse(schema, body, message) {
  const result = schema.safeParse(body);
  if (result.success) return result.data;

  throw httpError(400, message);
}

const trail = {
  orderBy: { createdAt: 'asc' },
  select: { fromStatus: true, toStatus: true, note: true, createdAt: true, actor: { select: { name: true } } },
};

router.get('/queue', async (_req, res) => {
  const waiting = await prisma.answer.findMany({
    where: { status: 'PENDING_REVIEW' },
    include: {
      transitions: trail,
      doubt: { include: { user: { select: { name: true } } } },
    },
  });

  // Flagged answers first, then oldest. A teacher should meet the questions
  // that tried something before the ones that did not.
  waiting.sort((a, b) => b.riskFlags.length - a.riskFlags.length || a.createdAt - b.createdAt);

  return res.json(waiting.map((answer) => ({
    id: answer.id,
    version: answer.version,
    aiDraft: answer.aiDraft,
    riskFlags: answer.riskFlags,
    confidence: answer.confidence,
    model: answer.model,
    promptVersion: answer.promptVersion,
    createdAt: answer.createdAt,
    doubt: {
      id: answer.doubt.id,
      title: answer.doubt.title,
      body: answer.doubt.body,
      codeSnippet: answer.doubt.codeSnippet,
      author: answer.doubt.user.name,
      askedAt: answer.doubt.createdAt,
    },
    transitions: answer.transitions,
  })));
});

router.post('/:answerId/approve', async (req, res) => {
  const { publishedText, version } = parse(
    approval, req.body, 'An approved answer needs published text and the version you were shown.',
  );
  const teacher = await currentUser(req);

  const answer = await transition({
    answerId: req.params.answerId,
    to: 'APPROVED',
    actorId: teacher.id,
    expectedVersion: version,
    publishedText,
  });

  return res.json({ id: answer.id, status: answer.status, version: answer.version });
});

router.post('/:answerId/reject', async (req, res) => {
  const { note, version } = parse(
    rejection, req.body, 'A rejected answer needs a reason and the version you were shown.',
  );
  const teacher = await currentUser(req);

  const answer = await transition({
    answerId: req.params.answerId,
    to: 'REJECTED',
    actorId: teacher.id,
    expectedVersion: version,
    note,
  });

  return res.json({ id: answer.id, status: answer.status, version: answer.version });
});

export default router;
