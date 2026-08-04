process.env.NODE_ENV = 'test';
import { app } from '../src/index.js';
import { prisma } from '../src/lib/prisma.js';
import { transition } from '../src/services/approval.js';
import request from 'supertest';

const log = (label, data) => console.log(`\n=== ${label} ===\n${JSON.stringify(data, null, 2)}`);

const CORRECT_SOLUTION = `
import sys

def main():
    data = sys.stdin.read().split()
    n = int(data[0]); limit = int(data[1])
    arr = list(map(int, data[2:2+n]))
    from collections import deque
    max_dq = deque()
    min_dq = deque()
    left = 0
    best = 0
    for right in range(n):
        while max_dq and arr[max_dq[-1]] <= arr[right]:
            max_dq.pop()
        max_dq.append(right)
        while min_dq and arr[min_dq[-1]] >= arr[right]:
            min_dq.pop()
        min_dq.append(right)
        while arr[max_dq[0]] - arr[min_dq[0]] > limit:
            left += 1
            if max_dq[0] < left: max_dq.popleft()
            if min_dq[0] < left: min_dq.popleft()
        best = max(best, right - left + 1)
    print(best)

main()
`;

async function main() {
  const student = await prisma.user.findFirst({ where: { email: 'aditi@trustgrade.test' } });
  const teacher = await prisma.user.findFirst({ where: { email: 'priya@trustgrade.test' } });
  if (!student || !teacher) throw new Error('Seed users missing');

  const createdDoubtIds = [];
  const createdSubmissionIds = [];

  // ---------- TASK 1a: full walk DRAFT -> PENDING_REVIEW -> APPROVED ----------
  const post1 = await request(app).post('/api/doubts').set('x-demo-role', 'STUDENT')
    .send({ title: 'Workflow test A', body: 'Why is my sliding window off by one?' });
  createdDoubtIds.push(post1.body.id);
  const answer1 = await prisma.answer.findFirst({ where: { doubtId: post1.body.id } });
  log('1a POST /api/doubts response', post1.body);
  log('1a answer row after post (should be PENDING_REVIEW, version 1)', answer1);

  const approved1 = await transition({
    answerId: answer1.id, to: 'APPROVED', actorId: teacher.id,
    expectedVersion: answer1.version, publishedText: 'Use a two-pointer sliding window; expand right, shrink left while max-min>limit.',
  });
  log('1a approved answer row', approved1);

  const board1 = await request(app).get('/api/doubts').set('x-demo-role', 'STUDENT');
  log('1a GET /api/doubts entry', board1.body.find((d) => d.id === post1.body.id));

  // ---------- TASK 1b: reject then second answer approved ----------
  const post2 = await request(app).post('/api/doubts').set('x-demo-role', 'STUDENT')
    .send({ title: 'Workflow test B', body: 'My program times out on the last hidden test.' });
  createdDoubtIds.push(post2.body.id);
  const answerB1 = await prisma.answer.findFirst({ where: { doubtId: post2.body.id } });
  const rejectedB1 = await transition({
    answerId: answerB1.id, to: 'REJECTED', actorId: teacher.id,
    expectedVersion: answerB1.version, note: 'Draft missed the point; answering directly instead.',
  });
  log('1b rejected first answer', rejectedB1);

  const answerB2 = await prisma.answer.create({
    data: { doubtId: post2.body.id, aiDraft: 'second draft', riskFlags: [], model: 'none', promptVersion: 'v1' },
  });
  const pendingB2 = await transition({
    answerId: answerB2.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: answerB2.version,
  });
  const approvedB2 = await transition({
    answerId: answerB2.id, to: 'APPROVED', actorId: teacher.id,
    expectedVersion: pendingB2.version, publishedText: 'A sliding window keeps this at O(n); check the shrink condition.',
  });
  log('1b second answer approved', approvedB2);

  const board2 = await request(app).get('/api/doubts').set('x-demo-role', 'STUDENT');
  log('1b GET /api/doubts entry (should show 2nd answer text, ignore rejected 1st)', board2.body.find((d) => d.id === post2.body.id));

  // ---------- states a-f ----------
  const doubtA = await prisma.doubt.create({ data: { userId: student.id, title: 'State A - no answers', body: 'placeholder' } });
  createdDoubtIds.push(doubtA.id);

  const doubtB = await prisma.doubt.create({ data: { userId: student.id, title: 'State B - one rejected', body: 'placeholder' } });
  createdDoubtIds.push(doubtB.id);
  const ansB = await prisma.answer.create({ data: { doubtId: doubtB.id, aiDraft: 'd', riskFlags: [], model: 'none', promptVersion: 'v1' } });
  const ansBp = await transition({ answerId: ansB.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: ansB.version });
  await transition({ answerId: ansB.id, to: 'REJECTED', actorId: teacher.id, expectedVersion: ansBp.version, note: 'no' });

  const doubtC = await prisma.doubt.create({ data: { userId: student.id, title: 'State C - rejected + pending', body: 'placeholder' } });
  createdDoubtIds.push(doubtC.id);
  const ansC1 = await prisma.answer.create({ data: { doubtId: doubtC.id, aiDraft: 'd1', riskFlags: [], model: 'none', promptVersion: 'v1' } });
  const ansC1p = await transition({ answerId: ansC1.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: ansC1.version });
  await transition({ answerId: ansC1.id, to: 'REJECTED', actorId: teacher.id, expectedVersion: ansC1p.version, note: 'no' });
  const ansC2 = await prisma.answer.create({ data: { doubtId: doubtC.id, aiDraft: 'd2', riskFlags: [], model: 'none', promptVersion: 'v1' } });
  await transition({ answerId: ansC2.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: ansC2.version });

  const doubtD = await prisma.doubt.create({ data: { userId: student.id, title: 'State D - rejected + approved', body: 'placeholder' } });
  createdDoubtIds.push(doubtD.id);
  const ansD1 = await prisma.answer.create({ data: { doubtId: doubtD.id, aiDraft: 'd1', riskFlags: [], model: 'none', promptVersion: 'v1' } });
  const ansD1p = await transition({ answerId: ansD1.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: ansD1.version });
  await transition({ answerId: ansD1.id, to: 'REJECTED', actorId: teacher.id, expectedVersion: ansD1p.version, note: 'no' });
  const ansD2 = await prisma.answer.create({ data: { doubtId: doubtD.id, aiDraft: 'd2', riskFlags: [], model: 'none', promptVersion: 'v1' } });
  const ansD2p = await transition({ answerId: ansD2.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: ansD2.version });
  await transition({ answerId: ansD2.id, to: 'APPROVED', actorId: teacher.id, expectedVersion: ansD2p.version, publishedText: 'Published text D' });

  const doubtE = await prisma.doubt.create({ data: { userId: student.id, title: 'State E - two rejected', body: 'placeholder' } });
  createdDoubtIds.push(doubtE.id);
  for (const draftText of ['e1', 'e2']) {
    const a = await prisma.answer.create({ data: { doubtId: doubtE.id, aiDraft: draftText, riskFlags: [], model: 'none', promptVersion: 'v1' } });
    const p = await transition({ answerId: a.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: a.version });
    await transition({ answerId: a.id, to: 'REJECTED', actorId: teacher.id, expectedVersion: p.version, note: 'no' });
  }

  const doubtF = await prisma.doubt.create({ data: { userId: student.id, title: 'State F - approved, transition deleted', body: 'placeholder' } });
  createdDoubtIds.push(doubtF.id);
  const ansF = await prisma.answer.create({ data: { doubtId: doubtF.id, aiDraft: 'f', riskFlags: [], model: 'none', promptVersion: 'v1' } });
  const ansFp = await transition({ answerId: ansF.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: ansF.version });
  await transition({ answerId: ansF.id, to: 'APPROVED', actorId: teacher.id, expectedVersion: ansFp.version, publishedText: 'Published text F' });
  await prisma.answerTransition.deleteMany({ where: { answerId: ansF.id, toStatus: 'APPROVED' } });

  const boardFinal = await request(app).get('/api/doubts').set('x-demo-role', 'STUDENT');
  log('boardFinal status', boardFinal.status);
  for (const [label, id] of [['A', doubtA.id], ['B', doubtB.id], ['C', doubtC.id], ['D', doubtD.id], ['E', doubtE.id], ['F', doubtF.id]]) {
    log(`State ${label} present() output`, boardFinal.body.find((d) => d.id === id));
  }

  // ---------- TASK 3: idempotency + concurrency ----------
  const dupBody = { title: 'Duplicate check', body: 'Same body sent twice at once.' };
  const [d1, d2] = await Promise.all([
    request(app).post('/api/doubts').set('x-demo-role', 'STUDENT').send(dupBody),
    request(app).post('/api/doubts').set('x-demo-role', 'STUDENT').send(dupBody),
  ]);
  if (d1.body.id) createdDoubtIds.push(d1.body.id);
  if (d2.body.id) createdDoubtIds.push(d2.body.id);
  log('concurrent identical POST /api/doubts', {
    d1_status: d1.status, d1_id: d1.body.id, d2_status: d2.status, d2_id: d2.body.id, sameId: d1.body.id === d2.body.id,
  });

  const concurDoubt = await prisma.doubt.create({ data: { userId: student.id, title: 'Concurrency test', body: 'placeholder' } });
  createdDoubtIds.push(concurDoubt.id);
  const concurAnswer = await prisma.answer.create({ data: { doubtId: concurDoubt.id, aiDraft: 'c', riskFlags: [], model: 'none', promptVersion: 'v1' } });
  const concurPending = await transition({ answerId: concurAnswer.id, to: 'PENDING_REVIEW', actorId: teacher.id, expectedVersion: concurAnswer.version });

  const [r1, r2] = await Promise.allSettled([
    transition({ answerId: concurAnswer.id, to: 'APPROVED', actorId: teacher.id, expectedVersion: concurPending.version, publishedText: 'Version A text' }),
    transition({ answerId: concurAnswer.id, to: 'APPROVED', actorId: teacher.id, expectedVersion: concurPending.version, publishedText: 'Version B text' }),
  ]);
  log('concurrent approvals of same answer/version', {
    r1_status: r1.status, r1_error: r1.reason?.message, r1_code: r1.reason?.status,
    r2_status: r2.status, r2_error: r2.reason?.message, r2_code: r2.reason?.status,
  });
  const finalAnswerState = await prisma.answer.findUnique({ where: { id: concurAnswer.id } });
  log('answer row after concurrent approvals', finalAnswerState);

  // ---------- TASK 2: API contract spot checks ----------
  const badSubmission = await request(app).post('/api/submissions').set('x-demo-role', 'STUDENT').send({ problemId: 'longest-stable-segment' });
  log('POST /api/submissions missing code -> contract check', { status: badSubmission.status, body: badSubmission.body });

  const missingProblem = await request(app).get('/api/problems/does-not-exist');
  log('GET /api/problems/:id missing -> contract check', { status: missingProblem.status, body: missingProblem.body });

  const badDoubt = await request(app).post('/api/doubts').set('x-demo-role', 'STUDENT').send({ title: '' });
  log('POST /api/doubts invalid body -> contract check', { status: badDoubt.status, body: badDoubt.body });

  // ---------- TASK 4: data correctness (real sandbox run) ----------
  const submitRes = await request(app).post('/api/submissions').set('x-demo-role', 'STUDENT')
    .send({ problemId: 'longest-stable-segment', code: CORRECT_SOLUTION });
  if (submitRes.body.id) createdSubmissionIds.push(submitRes.body.id);
  log('submission response status', submitRes.status);
  log('submission response body', submitRes.body);

  if (submitRes.status === 201) {
    const sumRuntimes = submitRes.body.results.reduce((s, r) => s + r.runtimeMs, 0);
    log('runtimeMs check', { reported: submitRes.body.runtimeMs, sumOfResults: sumRuntimes, matches: submitRes.body.runtimeMs === sumRuntimes });

    const hiddenEntries = submitRes.body.results.filter((r) => r.hidden);
    const hiddenLeak = hiddenEntries.some((r) => 'input' in r || 'expected' in r || 'received' in r);
    log('hidden test leak check', { hiddenCount: hiddenEntries.length, hiddenLeak, sampleHiddenKeys: hiddenEntries[0] ? Object.keys(hiddenEntries[0]) : [] });

    const expectedScore = Math.round((submitRes.body.passed / submitRes.body.total) * 100);
    log('score formula check', { score: submitRes.body.score, passed: submitRes.body.passed, total: submitRes.body.total, expectedScore, matches: submitRes.body.score === expectedScore });

    // double-check against the persisted DB row directly, not just the response
    const persisted = await prisma.submission.findUnique({ where: { id: submitRes.body.id } });
    log('persisted submission row matches response runtimeMs/score', {
      runtimeMsMatches: persisted.runtimeMs === submitRes.body.runtimeMs,
      scoreMatches: persisted.score === submitRes.body.score,
      persistedHiddenLeak: persisted.results.filter((r) => r.hidden).some((r) => 'input' in r || 'expected' in r),
    });
  }

  // ---------- cleanup ----------
  await prisma.doubt.deleteMany({ where: { id: { in: createdDoubtIds.filter(Boolean) } } });
  await prisma.submission.deleteMany({ where: { id: { in: createdSubmissionIds.filter(Boolean) } } });
  log('cleanup', { doubtsDeleted: createdDoubtIds.length, submissionsDeleted: createdSubmissionIds.length });
}

main()
  .catch((e) => { console.error('SCRIPT ERROR', e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
