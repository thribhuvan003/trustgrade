import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { httpError } from '../lib/errors.js';

const router = Router();

// Visible test cases only. The hidden ones exist to stop a student writing a
// solution that pattern-matches the examples.
router.get('/:id', async (req, res) => {
  const problem = await prisma.problem.findUnique({
    where: { id: req.params.id },
    include: {
      testCases: {
        where: { hidden: false },
        select: { id: true, input: true, expected: true },
        orderBy: { id: 'asc' },
      },
    },
  });

  if (!problem) throw httpError(404, 'That problem does not exist.');
  return res.json(problem);
});

export default router;
