import express from 'express';
import problems from './routes/problems.js';
import submissions from './routes/submissions.js';
import doubts from './routes/doubts.js';
import review from './routes/review.js';

export const app = express();

app.use(express.json({ limit: '256kb' }));

// The web app is served from a different port, so the browser needs to be told
// this origin may call us and may send the role header.
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', process.env.WEB_ORIGIN ?? 'http://localhost:3000');
  res.set('Access-Control-Allow-Headers', 'Content-Type, x-demo-role');
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});
app.use('/api/problems', problems);
app.use('/api/submissions', submissions);
app.use('/api/doubts', doubts);
app.use('/api/review', review);

const FALLBACK = {
  400: 'That request was not something we could read. Nothing was saved.',
  404: 'That does not exist.',
  500: 'Something went wrong on the server. Nothing was saved. Try again.',
};

// Every failure leaves as { error } with a real status code.
//
// Only messages this codebase wrote are sent on. A library error can carry its
// own status - a malformed JSON body arrives from the body parser as a 400 -
// and forwarding those verbatim would show a student our parser internals.
app.use((error, _req, res, _next) => {
  const status = error.status ?? 500;
  if (!error.clientMessage) console.error(error);

  res.status(status).json({ error: error.clientMessage ?? FALLBACK[status] ?? FALLBACK[500] });
});

if (process.env.NODE_ENV !== 'test') {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.log(`TrustGrade API listening on ${port}`));
}
