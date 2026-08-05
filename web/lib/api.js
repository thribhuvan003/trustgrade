// Every call to the API goes through here. The role header is the whole auth
// story: the sidebar switcher sets it and the server takes it at face value.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export function currentRole() {
  if (typeof window === 'undefined') return 'STUDENT';
  return window.localStorage.getItem('trustgrade-role') ?? 'STUDENT';
}

export function setRole(role) {
  window.localStorage.setItem('trustgrade-role', role);
}

async function call(path, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-demo-role': currentRole(),
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);
  // The server always sends { error } with a real status, so the message it
  // wrote is the one worth showing.
  if (!response.ok) throw new Error(body?.error ?? 'The server could not be reached.');
  return body;
}

const post = (path, payload) => call(path, { method: 'POST', body: JSON.stringify(payload ?? {}) });

export const getProblem = (id) => call(`/problems/${id}`);
export const runVisibleTests = (problemId, code) => post('/submissions/run', { problemId, code });
export const submitSolution = (problemId, code) => post('/submissions', { problemId, code });
export const getSubmissions = () => call('/submissions');
export const getFeedback = (id) => post(`/submissions/${id}/feedback`);
export const getDoubts = () => call('/doubts');
export const askDoubt = (doubt) => post('/doubts', doubt);
export const getReviewQueue = () => call('/review/queue');
export const approveAnswer = (id, publishedText, version) => post(`/review/${id}/approve`, { publishedText, version });
export const rejectAnswer = (id, note, version) => post(`/review/${id}/reject`, { note, version });
