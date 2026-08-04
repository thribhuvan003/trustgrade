import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { currentUser } from '../middleware/role.js';
import { grade } from '../services/grader.js';
import { reviewCode } from '../services/llm.js';

const router = Router();

// Bytes, not characters, so this agrees with the limit the sandbox enforces.
// Counting UTF-16 units here would let a program with accented comments pass
// validation and then fail inside the runner with no explanation.
const MAX_CODE_BYTES = 16 * 1024;

const submission = z.object({
  problemId: z.string().min(1),
  code: z.string().min(1).refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_CODE_BYTES, 'too long'),
}).strict();

function reject(status, message) {
  const error = new Error(message);
  error.status = status;
  error.clientMessage = message;
  return error;
}

// One message per failure. "That request was invalid" tells a student nothing
// about what to change.
function explain(issue) {
  if (issue.code === 'unrecognized_keys') return 'That submission carries fields we do not accept. Nothing was saved.';
  if (issue.path[0] === 'problemId') return 'That submission does not say which problem it answers. Nothing was saved.';
  if (issue.message === 'too long') return 'That program is longer than the 16 KB limit. Nothing was saved.';
  return 'That submission has no code to run. Nothing was saved.';
}

function parse(body) {
  const result = submission.safeParse(body);
  if (result.success) return result.data;
  throw reject(400, explain(result.error.issues[0]));
}

async function testCasesFor(problemId, visibleOnly) {
  const where = visibleOnly ? { problemId, hidden: false } : { problemId };
  const cases = await prisma.testCase.findMany({ where, orderBy: { id: 'asc' } });

  if (cases.length === 0) throw reject(404, 'That problem does not exist, or has no test cases. Nothing was run.');
  return cases;
}

// Visible tests only, and nothing is kept. This is the button a student presses
// while still working.
router.post('/run', async (req, res) => {
  const { problemId, code } = parse(req.body);
  return res.json(await grade(code, await testCasesFor(problemId, true)));
});

// The graded submission. The score comes from the test cases and is written
// once, here.
router.post('/', async (req, res) => {
  const { problemId, code } = parse(req.body);
  const user = await currentUser(req);
  const testCases = await testCasesFor(problemId, false);

  let outcome;
  try {
    outcome = await grade(code, testCases);
  } catch (error) {
    // The sandbox being down is our failure, not the student's. Record the
    // attempt so it is not silently lost, but do not give it a score.
    await prisma.submission.create({
      data: {
        userId: user.id, problemId, code, status: 'FAILED', total: testCases.length, results: [],
      },
    });
    throw error;
  }

  const saved = await prisma.submission.create({
    data: {
      userId: user.id,
      problemId,
      code,
      status: 'COMPLETED',
      score: outcome.score,
      passed: outcome.passed,
      total: outcome.total,
      results: outcome.results,
      runtimeMs: outcome.results.reduce((sum, result) => sum + result.runtimeMs, 0),
    },
  });

  return res.status(201).json(saved);
});

// Advisory only. This never touches the stored score, and the lookup is scoped
// to the caller so one student cannot request feedback on another's work.
router.post('/:id/feedback', async (req, res) => {
  const user = await currentUser(req);
  const submission = await prisma.submission.findFirst({
    where: { id: req.params.id, userId: user.id },
    select: { code: true },
  });

  if (!submission) throw reject(404, 'That submission does not exist.');
  return res.json(await reviewCode(submission.code));
});

router.get('/', async (req, res) => {
  const user = await currentUser(req);
  return res.json(await prisma.submission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { problem: { select: { title: true } } },
  }));
});

export default router;
