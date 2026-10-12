# T-003 Evidence — Build / Test / Smoke Baseline

Date: 2026-10-12, repo root.

## Verification 1 — one-command build, 3 consecutive successes: PASS

Command: `bash scripts/build.sh`

| Run | Result |
|---|---|
| 1 | `✓ built in 600ms` — BUILD OK |
| 2 | `✓ built in 787ms` — BUILD OK |
| 3 | `✓ built in 766ms` — BUILD OK |

Build installs workspace dependencies when missing, runs a backend syntax
pass (`node --check` over every backend module) and produces the frontend
bundle via Vite.

## Verification 2 — one-command test script, exit success with stats: PASS

Command: `bash scripts/test.sh`

```
[suite] backend: pass=8 fail=0
----------------------------------------
TOTAL passed=8 failed=0
TESTS PASSED
```

Exit code 0. Negative control: an intentionally failing test was injected
(`zz_negative_control.test.js`); the script reported `pass=8 fail=1`,
`TESTS FAILED`, exit code 1; after removal the run returned to
`pass=8 fail=0`, exit 0. The runner genuinely detects failures.

## Verification 3 — smoke chain, 3 consecutive successes, no residual process: PASS

Command: `bash scripts/smoke.sh` (start backend → poll /healthz → validate
structured `server_started` log line → graceful shutdown → assert the port no
longer responds)

| Run | health response | Result |
|---|---|---|
| 1 | `{"status":"ok"}` | SMOKE OK |
| 2 | `{"status":"ok"}` | SMOKE OK |
| 3 | `{"status":"ok"}` | SMOKE OK |

The script's final step fails the run if the server still answers after
shutdown, so each OK implies no leftover listener; three runs on the same
port also prove no port-holding residual process across runs.
