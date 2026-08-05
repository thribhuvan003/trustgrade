# TrustGrade

An AI-assisted code grading and doubt-resolution portal, built around one rule:

> Deterministic tests decide correctness. AI produces advisory text, not authority.
> No AI-generated answer reaches a student without teacher approval.

The service layer enforces that rule, and so does the database, so it holds even when the
application is bypassed entirely.

## Review in five minutes

```bash
cp .env.example server/.env   # an LLM key is optional; see "With the model offline"
docker compose up -d      # Postgres, and builds the sandbox image

# terminal 1
cd server && npm install && npx prisma migrate deploy && npm run seed && npm run dev

# terminal 2
cd web && npm install && npm run dev
```

Then open <http://localhost:3000>. The sidebar switches between student and teacher.

```bash
cd server
npm test          # the workflow, sandbox and injection suites
npm run attack    # fires every defence live and prints what happened
```

Screenshots of all four pages are in [docs/screenshots](docs/screenshots).

## Architecture

```
browser ──x-demo-role──▶ Express :4000 ──▶ Postgres :5432
                              │                 ▲
                              │                 └── CHECK constraint, partial unique
                              │                     index, BEFORE INSERT OR UPDATE trigger
                              │
                              ├──▶ docker ──▶ one disposable container per test case
                              │               no network, 256 MB, 0.5 CPU, 64 pids,
                              │               read-only root, no capabilities
                              │
                              └──▶ an OpenAI-compatible endpoint (optional)
```

Trust boundaries: student code is fully untrusted and only ever runs in a container;
doubt text is untrusted and only ever reaches the model inside delimiters; model output is
untrusted and is schema-validated, never executed, and never visible to a student until a
teacher publishes it. Details and the honest limits are in [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md).

## Approval workflow

```
DRAFT ──▶ PENDING_REVIEW ──┬──▶ APPROVED   (terminal)
                           └──▶ REJECTED   (terminal)
```

| Rule | Enforced by |
|---|---|
| Which transitions are legal | Postgres `BEFORE INSERT OR UPDATE` trigger |
| An answer is born `DRAFT` | the same trigger, on insert |
| `publishedText` only on an approved row | `CHECK` constraint |
| One approved answer per doubt | partial unique index |
| Who may request a transition | Express role middleware |
| Two reviewers cannot overwrite each other | `updateMany` with a version guard, in a transaction |

`server/src/services/approval.js` is the only file in the codebase that writes
`Answer.status`. Postgres decides *which* transitions are legal; Express decides *who* may
request one. **The database does not verify teacher identity, and this README does not
claim it does.**

`aiDraft` is written once and never mutated. A teacher's edits go to `publishedText`, so
every row shows what the model said next to what a human chose to publish.

`Answer.doubtId` is deliberately **not** unique, which is a conscious departure from the
brief. `REJECTED` is terminal, so with one answer per doubt a rejected question would be
permanently unanswerable. A doubt may hold several answers over time, and the partial
unique index is what keeps at most one of them published.

## Sandbox

| Control | Risk reduced | Observed |
|---|---|---|
| `--network none` | exfiltration, callbacks | `OSError: [Errno 101] Network unreachable`, only `lo` present |
| `--memory 256m --memory-swap 256m` | host memory exhaustion | `[0]*10**9` killed by the cgroup OOM killer |
| `--pids-limit 64` | fork bombs | `BlockingIOError: [Errno 11] Resource temporarily unavailable` |
| `--read-only` + `--tmpfs /tmp` | persisting to image or host | writes outside `/tmp` refused |
| `--cap-drop ALL`, `no-new-privileges` | privilege escalation | no capabilities retained |
| `--user 65534:65534` | running as root | `uid=65534(nobody)` |
| host timer, then `docker rm -f` | runaway programs | `while True: pass` stopped at ~5.1s |
| 64 KB output cap | flooding the server | 10 MB print truncated at exactly 65536 bytes |
| 16 KB source limit | argument-length crash | refused before any container starts |

The program reaches the container base64-encoded in an environment variable rather than as a
mounted file. `docker cp` was tried first and fails outright against `--read-only` with
*"container rootfs is marked read-only"* — observed, not assumed. A bind mount does work
while the API runs on the host, but it ties the runner to wherever the API happens to live
and would break the moment the API is containerised.

This reduces the listed risks. It is **not** a claim that the container is secure.

## AI safety

Four layers, and only the last one is load bearing.

1. Length and charset validation on what a student submits.
2. A risk scan over the student's text, recorded for the reviewing teacher.
3. The untrusted block is delimited, and the model is told not to follow it.
4. **A human approves before anything is published.**

The regex list is described as secondary because it is. Six injection phrasings were tried
against it and **four defeated it completely** — a synonym-only rewrite, zero-width
characters mid-word, a base64 payload, and spaced-out letters all produced no flags. Every
one still ended `PENDING_REVIEW` with nothing published.

> Even a fully successful prompt injection cannot change a score, approve itself, publish
> itself, or become visible to a student.

The model has no tools, no database access and no route to approval. Its reply is
schema-validated and **rejected on mismatch, never repaired**. A reply that echoes the
prompt or claims a decision it cannot make is discarded.

### With the model offline

Grading and the doubt board work with no API key at all. Five failure modes were measured —
no key, invalid key, unreachable host, unknown model, and a stalled provider — and every one
falls back in under 260 ms rather than failing the page. Risk flags are read from what the
student wrote, not from what the model replied, so an injection is still recorded and still
flagged when the model is entirely absent.

## Test evidence

Observed, not asserted. `npm test` and `npm run attack` reproduce every count below.
The timings under them were measured by hand on one machine and will differ on yours.

- **15 automated tests pass**, covering the six required cases: `DRAFT → APPROVED` throws,
  `APPROVED → PENDING_REVIEW` throws, raw SQL is blocked by the trigger, a student calling
  approve gets 403, `GET /api/doubts` leaks no pending draft, and an injection attempt lands
  `PENDING_REVIEW` with non-empty `riskFlags`.
- **30 of 30 live defences hold** — 19 raw-SQL attacks on the database guards, 6 sandbox
  attacks, 4 injection containment checks, and a leftover-container check.
- **13 of 13 adversarial probes contained**, including `__proto__` and
  `constructor.prototype` sent as raw JSON leaving `Object.prototype` untouched.
- The raw-SQL test was **mutation-checked**: disabling the trigger makes it fail, so it is
  detecting the guard rather than passing vacuously.

Measured on a production build:

| | |
|---|---|
| API reads | 5–23 ms median (`/problems` 5 ms, `/submissions` 13 ms, `/doubts` 23 ms at 60 rows) |
| First contentful paint | 92–168 ms |
| Full page load, data included | 700–922 ms |
| Client-side navigation | 125–261 ms |
| Transferred per page | ~569 KB, of which 477 KB is the React and Next runtime |
| A graded submission | 3–5 s, because it runs five real containers |

Grading is the only slow path and it is honestly slow: it executes real code in real
containers, so a three-second floor is the work, not the overhead. Everything a student
reads is single-digit-to-low-double-digit milliseconds.

### Known limitations

- Test cases are graded one at a time. Running them concurrently was measured at 1739 ms
  against 3094 ms, and was rejected: five containers competing for CPU make a borderline
  program's verdict depend on machine load, which would undermine the claim that
  deterministic tests decide correctness.
- Network denial surfaces as a **timeout** for anything DNS-based. A direct IP connection
  fails cleanly in under a second; a hostname lookup has no resolver to reach and hangs
  until the five-second wall clock.
- A timeout **masks** a memory kill. When a program approaches both limits the timeout
  verdict wins, because the timer has already removed the container.
- The demo's database user is a Postgres **superuser**, so it could disable the trigger with
  one statement. The guarantee covers ordinary application SQL, not a superuser who could
  equally drop the table.
- Cleanup on exit is best effort and **does not run at all on Windows**, where Node cannot
  catch `SIGTERM`. Startup therefore removes containers a previous process stranded.

## Known simplifications

- Python only, and one problem.
- Role switching is a header set by a sidebar dropdown. There is no login, no session and no
  password anywhere in this project.
- No public deployment. Exposing an arbitrary-code execution service needs production
  controls beyond this scope.
- The deployed instance runs everything except code execution. No managed host gives a
  container a Docker daemon, so a submission there returns "The grading sandbox is
  unavailable" rather than a score. Grading works locally, and the demo video shows it.
- **`docker compose up` starts Postgres and builds the sandbox image; it does not start the
  API or the web app.** Those run with `npm run dev`, as the setup steps above show. The API
  spawns sandbox containers directly on the host daemon, which keeps the runner independent
  of where the server itself is running.
- No claim of complete prompt-injection prevention.
- `QUEUED` and `RUNNING` exist in `SubmissionStatus` because the data model names them, but
  grading is synchronous so the code never produces them.
- **A rejected question cannot be re-drafted.** The schema deliberately allows several
  answers per doubt so that a rejected question can be answered again, but no route builds
  that second draft, so today a student has to ask a new question. The badge says "Not
  published" rather than "Rejected for revision" because the interface should not promise a
  path that does not exist.
- **A teacher cannot review past decisions.** Every approval and rejection, with its note,
  is stored in `AnswerTransition` and shown while the answer is in the queue, but once
  decided it leaves the queue and there is no history screen to find it again.

## Tooling

AI assistance was used for boilerplate — Prisma scaffolding, Docker configuration, test
setup and page markup. The architecture, the threat model and the workflow design are mine,
and I can explain any file in this repository.
