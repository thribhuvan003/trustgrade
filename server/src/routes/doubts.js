import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/errors.js';
import { currentUser } from '../middleware/role.js';
import { answerDoubt } from '../services/llm.js';
import { transition } from '../services/approval.js';

const router = Router();

const posted = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8 * 1024),
  codeSnippet: z.string().max(8 * 1024).nullish(),
}).strict();

// One message per failure. Telling a student their title is missing when their
// code snippet was too long sends them looking in the wrong place.
function explain(issue) {
  if (issue.code === 'unrecognized_keys') return 'That doubt carries fields we do not accept. Nothing was saved.';
  if (issue.path[0] === 'title') {
    return issue.code === 'too_big'
      ? 'That title is longer than 200 characters. Nothing was saved.'
      : 'A doubt needs a title. Nothing was saved.';
  }
  if (issue.path[0] === 'codeSnippet') return 'That code snippet is longer than the 8 KB limit. Nothing was saved.';
  if (issue.code === 'too_big') return 'That question is longer than the 8 KB limit. Nothing was saved.';
  return 'A doubt needs a question. Nothing was saved.';
}

// A doubt is answered by whichever answer reached APPROVED. Anything still in
// draft or review is reported as pending and nothing of it is returned.
function present(doubt) {
  const approved = doubt.answers.find((answer) => answer.status === 'APPROVED');
  if (!approved) {
    // Only call it rejected when a teacher actually rejected it. A doubt with no
    // answer, or one still in DRAFT because drafting failed, is waiting — saying
    // otherwise invents a human decision, in the one product whose whole claim is
    // that human decisions are real.
    const rejected = doubt.answers.length > 0
      && doubt.answers.every((answer) => answer.status === 'REJECTED');
    return { ...strip(doubt), status: rejected ? 'REJECTED' : 'PENDING_REVIEW', answer: null };
  }

  const approval = approved.transitions.at(-1);
  return {
    ...strip(doubt),
    status: 'APPROVED',
    answer: {
      text: approved.publishedText,
      reviewer: approval?.actor.name ?? 'a teacher',
      approvedAt: approval?.createdAt ?? approved.createdAt,
    },
  };
}

const strip = ({ id, title, body, codeSnippet, createdAt, user }) => ({
  id, title, body, codeSnippet, createdAt, author: user.name,
});

// The student writes the question; the model drafts a reply that no one can see
// yet. Only approval.js moves it, and it stops at PENDING_REVIEW.
router.post('/', async (req, res) => {
  const parsed = posted.safeParse(req.body);
  if (!parsed.success) throw httpError(400, explain(parsed.error.issues[0]));

  const user = await currentUser(req);
  const doubt = await prisma.doubt.create({ data: { ...parsed.data, userId: user.id } });
  const drafted = await answerDoubt(doubt);

  const answer = await prisma.answer.create({
    data: {
      doubtId: doubt.id,
      aiDraft: drafted.draft,
      riskFlags: drafted.riskFlags,
      confidence: drafted.confidence,
      model: drafted.model,
      promptVersion: drafted.promptVersion,
    },
  });
  await transition({
    answerId: answer.id, to: 'PENDING_REVIEW', actorId: user.id, expectedVersion: answer.version,
  });

  // The draft is deliberately absent from this response. The wording a student
  // reads belongs to the page, not to the API.
  return res.status(201).json({ id: doubt.id, title: doubt.title, status: 'PENDING_REVIEW' });
});

// Approved answers only. aiDraft is never selected, so a pending or rejected
// draft cannot reach a student even by accident.
router.get('/', async (_req, res) => {
  const doubts = await prisma.doubt.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { name: true } },
      answers: {
        select: {
          status: true,
          createdAt: true,
          publishedText: true,
          transitions: {
            where: { toStatus: 'APPROVED' },
            select: { createdAt: true, actor: { select: { name: true } } },
          },
        },
      },
    },
  });

  return res.json(doubts.map(present));
});

export default router;
