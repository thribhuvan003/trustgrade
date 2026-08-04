# Threat model

What this system defends against, how, and where it stops. Written as the code was
built, and extended at each step. Every claim here has been observed, not assumed —
run `npm run attack` to watch the defences fire.

## Trust boundaries

| Input | Trusted? | Contained by |
|---|---|---|
| Student program | No | A disposable container with no network, capped memory, CPU and process count, and a read-only root filesystem |
| Doubt text and code snippet | No | Delimited as untrusted input in the prompt, then held for human approval |
| Model output | No | Schema validated, never executed, never visible to a student until a teacher publishes it |
| Teacher action | Yes, by assumption | Nothing. Role comes from a demo header, not authentication |

## What the database enforces

Postgres decides which answer transitions are legal: a `BEFORE INSERT OR UPDATE`
trigger, a `CHECK` constraint keeping `publishedText` empty until approval, and a
partial unique index allowing one approved answer per doubt. Express decides *who*
may request a transition. The database does not verify teacher identity.

## Honest limitations

These are real. They are listed because a defence you cannot describe the edge of
is a defence you do not understand.

- **The demo's database user is a Postgres superuser.** `SET session_replication_role
  = replica` or `ALTER TABLE ... DISABLE TRIGGER` bypasses the transition guard in one
  statement — verified. The guarantee therefore covers ordinary application SQL, not a
  superuser, who could equally drop the table. Production would run the application as
  a role with only DML rights.
- **Deleting an answer is not guarded.** Anyone with direct SQL access can delete a row,
  and its audit trail cascades with it. They still cannot forge an approval, because a
  reinserted row must be `DRAFT`. Destroying evidence and manufacturing consent are
  different threats; only the second is in scope here.
- **A timeout hides a memory kill.** When a program approaches both the memory limit and
  the five-second wall clock, the timeout verdict wins: the timer has already removed the
  container, so there is nothing left to inspect. A slow-building out-of-memory condition
  is reported as `TIME_LIMIT_EXCEEDED`.
- **Network denial surfaces as a timeout for DNS.** A direct IP connection fails in under
  a second with `OSError: [Errno 101] Network unreachable`, and the container holds only a
  loopback interface. A hostname lookup has no resolver to reach, so it hangs until the
  wall clock kills it.
- **The container is not claimed to be secure.** The flags reduce the listed risks. A
  kernel escape is out of scope for this project and would not be stopped by any of them.
- **Cleanup on exit is best effort, and on Windows it does not run at all.** Killing the
  server mid-run strands its container: verified by sending `SIGTERM` to the server process
  and watching the container survive. Node cannot catch `SIGTERM` on Windows, so the exit
  handler never fires there; in the Linux container that Compose actually runs, it does.
  Because that guarantee is platform dependent, the real fix is at startup — every process
  removes containers a previous one left behind before running anything. The stranded
  container above was cleared by the next process start, verified.

## Sandbox controls

| Control | Risk reduced | Observed |
|---|---|---|
| `--network none` | Data exfiltration, callbacks | `OSError: [Errno 101] Network unreachable`, only `lo` present |
| `--memory 256m --memory-swap 256m` | Host memory exhaustion | `[0]*10**9` killed by the cgroup OOM killer |
| `--pids-limit 64` | Fork bombs | `BlockingIOError: [Errno 11] Resource temporarily unavailable` |
| `--read-only` + `--tmpfs /tmp` | Persisting to the image or host | Writes outside `/tmp` refused |
| `--cap-drop ALL`, `no-new-privileges` | Privilege escalation | No capabilities retained |
| `--user 65534:65534` | Running as root | `uid=65534(nobody)` |
| Host timer, then `docker rm -f` | Runaway programs | `while True: pass` stopped at ~5.1s |
| 64 KB cap across stdout and stderr | Output flooding the server | 10 MB print truncated |
| 16 KB source limit | Argument-length crash | Refused before any container starts |
