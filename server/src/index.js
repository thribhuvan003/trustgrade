import express from 'express';
import problems from './routes/problems.js';
import submissions from './routes/submissions.js';
import doubts from './routes/doubts.js';

export const app = express();

app.use(express.json({ limit: '256kb' }));
app.use('/api/problems', problems);
app.use('/api/submissions', submissions);
app.use('/api/doubts', doubts);

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
