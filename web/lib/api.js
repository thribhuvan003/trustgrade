// Every call to the API goes through here. The role header is the whole auth
// story: the sidebar switcher sets it and the server takes it at face value.
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// Running code needs a Docker daemon, which managed hosting does not give a
// container, so the deployed API runs on a machine that has one. This stays a
// separate name because grading is the one route with that requirement: point
// it elsewhere and the rest of the site is unaffected.
const SANDBOX = process.env.NEXT_PUBLIC_SANDBOX_API_URL ?? BASE;

export function currentRole() {
  if (typeof window === 'undefined') return 'STUDENT';
  return window.localStorage.getItem('trustgrade-role') ?? 'STUDENT';
}

export function setRole(role) {
  window.localStorage.setItem('trustgrade-role', role);
}

async function call(path, options = {}, base = BASE) {
  let response;
  try {
    response = await fetch(base + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'x-demo-role': currentRole(), ...options.headers },
    });
  } catch {
    throw new Error('The server is not responding. Nothing was saved. Check it is running, then try again.');
  }

  const body = await response.json().catch(() => null);
  // A reply arrived but carried no message we wrote, so say that rather than
  // reusing the wording for a server that never answered at all.
  if (!response.ok) throw new Error(body?.error ?? 'The server sent back something we could not read. Nothing was saved.');
  return body;
}

const post = (path, payload, base) => call(path, { method: 'POST', body: JSON.stringify(payload ?? {}) }, base);

// Whether the machine that runs code is currently reachable. The workspace asks
// once on load so it can say plainly that grading is off rather than letting a
// student press Submit and meet an error.
export async function sandboxReachable() {
  if (SANDBOX === BASE) return true;
  try {
    const response = await fetch(SANDBOX.replace(/\/api$/, '/'), { signal: AbortSignal.timeout(6000) });
    return response.ok;
  } catch {
    return false;
  }
}

export const getProblem = (id) => call(`/problems/${id}`);
export const runVisibleTests = (problemId, code) => post('/submissions/run', { problemId, code }, SANDBOX);
export const submitSolution = (problemId, code) => post('/submissions', { problemId, code }, SANDBOX);
export const getSubmissions = () => call('/submissions');
export const getFeedback = (id) => post(`/submissions/${id}/feedback`);
export const getDoubts = () => call('/doubts');
export const askDoubt = (doubt) => post('/doubts', doubt);
export const getReviewQueue = () => call('/review/queue');
export const approveAnswer = (id, publishedText, version) => post(`/review/${id}/approve`, { publishedText, version });
export const rejectAnswer = (id, note, version) => post(`/review/${id}/reject`, { note, version });
