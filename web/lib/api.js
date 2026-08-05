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
  let response;
  try {
    response = await fetch(BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-demo-role': currentRole(),
        ...options.headers,
      },
    });
  } catch {
    // fetch rejects with "Failed to fetch" when the API is down or blocked,
    // which tells a student nothing about what to do next.
    throw new Error('The server is not responding. Nothing was saved. Check it is running, then try again.');
  }

  const body = await response.json().catch(() => null);
  // The server always sends { error } with a real status, so the message it
  // wrote is the one worth showing.
  // A reply arrived but carried no message we wrote, so say that rather than
  // reusing the wording for a server that never answered at all.
  if (!response.ok) throw new Error(body?.error ?? 'The server sent back something we could not read. Nothing was saved.');
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
