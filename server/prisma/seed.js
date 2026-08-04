// Demo data. Safe to run more than once.
//
// Expected outputs were produced by running a reference solution through the
// real sandbox rather than worked out by hand.
import { prisma } from '../src/lib/prisma.js';

const PROBLEM_ID = 'longest-stable-segment';

const people = [
  { email: 'aditi@trustgrade.test', name: 'Aditi Sharma', role: 'STUDENT' },
  { email: 'priya@trustgrade.test', name: 'Priya Raman', role: 'TEACHER' },
];

const problem = {
  id: PROBLEM_ID,
  title: 'Longest Stable Segment',
  description:
    'Given an array of integers and a limit, find the length of the longest contiguous '
    + 'segment whose largest and smallest values differ by no more than that limit.',
  inputFormat:
    'The first line holds two integers, n and limit. The second line holds n integers '
    + 'separated by spaces.',
  outputFormat:
    'A single integer: the length of the longest segment that stays within the limit.',
  constraints: '1 <= n <= 100000\n0 <= limit <= 1000000000\n-1000000000 <= each value <= 1000000000',
  examples: [
    {
      input: '5 2\n1 3 2 4 5',
      output: '3',
      explanation:
        'The segment 1 3 2 has a range of 2, which is within the limit. Adding 4 would '
        + 'push the range to 3.',
    },
    {
      input: '4 0\n7 7 7 1',
      output: '3',
      explanation:
        'A limit of 0 means every value in the segment must be identical, so the three '
        + 'sevens are the longest run.',
    },
  ],
};

// Values cycle 0 to 5, so any window has a range of at most 5 and the whole
// array is one stable segment. A quadratic solution never breaks out of its
// inner loop and runs past the time limit; a sliding window answers in under a
// second. Ten thousand values is enough to separate them and keeps the row small.
const stableBand = Array.from({ length: 10000 }, (_, index) => index % 6).join(' ');

// Each case targets something different, and no two answers match, so a program
// that prints a constant scores zero instead of stumbling into marks.
const testCases = [
  { id: 'lss-1', input: '5 2\n1 3 2 4 5', expected: '3', hidden: false },
  { id: 'lss-2', input: '4 0\n7 7 7 1', expected: '3', hidden: false },
  // the answer is the whole array, which catches a window that never grows
  { id: 'lss-3', input: '6 100\n5 8 3 9 2 7', expected: '6', hidden: true },
  // negative values, and the answer sits at the start rather than the end
  { id: 'lss-4', input: '8 4\n-9 -7 -6 -5 12 1 2 3', expected: '4', hidden: true },
  // correct but quadratic is not good enough
  { id: 'lss-5', input: `10000 5\n${stableBand}`, expected: '10000', hidden: true },
];

async function seed() {
  for (const person of people) {
    await prisma.user.upsert({ where: { email: person.email }, update: {}, create: person });
  }

  const { id, ...fields } = problem;
  await prisma.problem.upsert({ where: { id }, update: fields, create: problem });

  for (const testCase of testCases) {
    await prisma.testCase.upsert({
      where: { id: testCase.id },
      update: { ...testCase, problemId: PROBLEM_ID },
      create: { ...testCase, problemId: PROBLEM_ID },
    });
  }

  const visible = testCases.filter((testCase) => !testCase.hidden).length;
  console.log(
    `Seeded ${people.length} people, 1 problem, `
    + `${visible} visible and ${testCases.length - visible} hidden test cases.`,
  );
}

await seed();
await prisma.$disconnect();
