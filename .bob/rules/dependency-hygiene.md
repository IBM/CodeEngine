# Dependency Hygiene — Automatic Vulnerability Check

## Trigger: when this rule applies

When you write or modify **any file** inside a subdirectory that contains a
dependency manifest, you MUST perform a vulnerability check as part of that
same task — without waiting to be asked. Check the submodule directory **and**
its parents up to the repo root.

| Manifest file | Ecosystem |
|---|---|
| `go.mod` | Go |
| `package.json` | Node / npm |
| `requirements.txt` | Python / pip |

---

## Step 1 — Check for open Dependabot alerts first

Always consult GitHub before running local tools — it gives the authoritative
patched version and avoids redundant work.

```bash
# Requires: gh auth login --hostname github.com (scope: repo)
gh api --hostname github.com \
  "/repos/IBM/CodeEngine/dependabot/alerts?per_page=100&state=open" \
  | jq '[.[] | {
      number,
      severity:        .security_advisory.severity,
      cvss:            .security_advisory.cvss.score,
      package:         .dependency.package.name,
      ecosystem:       .dependency.package.ecosystem,
      manifest:        .dependency.manifest_path,
      patched_version: .security_vulnerability.first_patched_version.identifier,
      summary:         .security_advisory.summary
    }] | sort_by(.severity, -.cvss)'
```

Cross-check the alert against the actual lock-file version — an alert may
already be resolved in the lock file even though still open on GitHub:

```bash
# npm — check transitive version in lock file
jq '(.packages // {}) | to_entries[]
    | select(.key | test("<package>"))
    | {pkg: .key, version: .value.version}' package-lock.json

# Go — check resolved version
grep "<module>" go.mod go.sum | head -5
```

---

## Step 2 — Assess risk before acting

| Category | Action |
|---|---|
| Patch/minor bump of an indirect dep | Apply automatically |
| Patch/minor bump within same major, no API change | Apply automatically |
| Major version bump | Explain breaking-change risk, ask user for approval |
| No patched version available (`patched_version` is null) | Document in PR under "Deferred"; do not block |
| Lock-file version already ≥ patched version | Mark resolved; no action needed |

### Previously deferred alerts — re-verify before treating as still blocked

Some alerts were previously deferred because no fix was available or because
upgrading was a breaking change. **Do not assume these are still blocked.**
When a task touches one of the listed submodules, re-check the current state
live before deciding to defer again:

```bash
# Re-check a specific previously-deferred alert by number
gh api --hostname github.com \
  "/repos/IBM/CodeEngine/dependabot/alerts/<number>" \
  | jq '{state, patched_version: .security_vulnerability.first_patched_version.identifier}'

# For npm: check whether the package's latest version is still ESM-only or has a CJS compat release
npm show <package>@latest main exports type 2>/dev/null

# For pip: check whether a patched version now exists
pip index versions <package> 2>/dev/null | head -3
```

Use the following as **background hints only** — they describe why the alert
was deferred at the time of the last scan. Verify live before reusing this reasoning:

| Alert(s) | Package | Submodule(s) | Reason last deferred | Re-check command |
|---|---|---|---|---|
| #656 #657 #658 | `file-type` (npm) | `cos-to-sql`, `fruit-counter`, `trusted-profiles/node` | v17+ is ESM-only; CJS callers need `await import()` migration | `npm show file-type@latest type` — if not `"module"`, CJS is back |
| #123 | `cookie` (npm) | `fotobox/frontend-app` | Fixed version blocked inside `@sveltejs/kit@2.x` | `npm show @sveltejs/kit@latest dependencies \| grep cookie` |
| #1192 | `accelerate` (pip) | `serverless-fleets/tutorials/inferencing/src` | No upstream patched version | `pip index versions accelerate \| head -1` then compare to alert's `patched_version` |

If live re-check shows the blocker is gone, treat the alert as **actionable
now** and apply the fix following Steps 3–5.

### Other previously noted upgrade considerations

- **`golang.org/x/net` ≥ v0.55.0**: requires Go 1.26+. The `go.mod` `go`
  directive will be auto-bumped by `go get`. Safe, but changes the minimum
  toolchain version recorded in `go.mod` — verify CI uses a matching version.

- **`mongo-driver` v1 series**: officially deprecated in favour of v2.
  Bumping within v1.x is safe. Migration to v2 is a separate breaking effort
  and should not be done as part of a routine dependency update.

---

## Step 3 — Apply fixes

### npm
```bash
cd <submodule-dir>
npm update                  # resolves transitive bumps within declared ranges
npm audit                   # confirm remaining issues
npm ci                      # validate lock file installs cleanly
```

Never use `npm audit fix --force` without reviewing what it would change —
it can downgrade to breaking versions.

### Go
```bash
cd <submodule-dir>
go get golang.org/x/net@latest
go get go.mongodb.org/mongo-driver@latest   # example; target the specific module
go mod tidy
go build ./...              # confirm the module still compiles
```

### Python / pip
```bash
cd <submodule-dir>
pip-audit -r requirements.txt          # show vulnerabilities
pip install --upgrade <package>
pip freeze > requirements.txt
pip-audit -r requirements.txt          # confirm resolved
```

---

## Step 4 — Verify

### Native (preferred locally — no container needed)
```bash
npm ci          # npm: clean install from updated lock file
go build ./...  # Go: confirm compilation
go vet ./...
python -m py_compile <main>.py   # Python: syntax check
```

### Container-based (matches CI)
Each submodule has a `build` and/or `verify` shell script that runs
`docker build --platform linux/amd64 .`.

**On Apple Silicon (arm64):** QEMU x86_64 emulation via Podman is slow and
can SIGSEGV during `npm install` inside the container. Prefer native `npm ci`
locally; let CI handle the full container build.

```bash
podman machine start           # start Podman VM first
bash <submodule-dir>/verify    # run one at a time — parallel runs crash under QEMU
```

CI workflow: `.github/workflows/dependabot-build-verify.yml` — runs on every
PR that touches a submodule with a `build`/`verify` script on native x86_64.

---

## Step 5 — Commit and PR hygiene

Stage **only** dependency files. The `verify`/`build` scripts get
permission-bit changes from `chmod +x` — do not commit those:

```bash
# Restore permission-only changes to scripts
git checkout -- $(git diff --name-only | grep -E '/(verify|build)$')
```

Commit message format:
```
fix(deps): remediate Dependabot security alerts

npm updates
-----------
<submodule>:
  - <package> <old> -> <new>  (GHSA: <summary>, Severity #alert-number)

Go module updates
-----------------
<submodule>:
  - <module> <old> -> <new>   (Severity #alert-number)

Deferred / no fix available
----------------------------
- <package> (#alert): <reason>
```

PR description must include: summary table, deferred section with reasons,
and a testing section noting what was validated locally vs. what CI covers.

---

## Reporting format (inline with code change)

```
## Dependency vulnerability check — <submodule-dir>

Ecosystem: <Go|npm|pip>

| Package | Current | Fix | Severity | Action |
|---------|---------|-----|----------|--------|
| example | 1.2.3   | 1.2.4 | High   | Updated in this PR |
| other   | 2.0.0   | 3.0.0 | Medium | Major bump — needs approval |

Remaining open alerts: <n>
```

If no vulnerabilities found: `✅ No known vulnerabilities in <submodule-dir>.`

---

## Project map — all submodules with dependency files

| Submodule | Ecosystem |
|---|---|
| `app-n-event-notification` | Go |
| `auth-oidc-proxy/auth` | npm |
| `auth-oidc/node` | npm |
| `cloudant-change-listener/job` | npm |
| `cos-to-sql` | npm |
| `fotobox/download-app` | Go |
| `fotobox/frontend-app` | npm |
| `fotobox/upload-function` | pip |
| `fruit-counter` | npm |
| `gallery/app`, `gallery/job`, `gallery/function` | npm |
| `github-webhook` | Go |
| `grpc` | Go |
| `helloworld-samples/app-python` | pip |
| `helloworld-samples/*-nodejs*` | npm |
| `helloworld-samples/*-python*` | pip |
| `kafka` | Go |
| `kafka-observer` | Go |
| `llm-translator-app` | npm + pip |
| `logging/go-*` | Go |
| `logging/node-*` | npm |
| `logging/python-*` | pip |
| `metrics-collector` | Go |
| `metrics-examples/go` | Go |
| `metrics-examples/node` | npm |
| `metrics-examples/python` | pip |
| `private-path-to-vpc-vsi/ce-app` | Go |
| `remote-bob/apiserver`, `remote-bob/job-agent` | Go |
| `satellite-connector-to-vpc-vsi/ce-app` | Go |
| `serverless-fleets/tutorials/inferencing/src` | pip |
| `sessions` | Go |
| `thumbnail/eventer`, `thumbnail/v1`, `thumbnail/v2` | Go |
| `trusted-profiles/go` | Go |
| `trusted-profiles/node` | npm |
| `trusted-profiles/python` | pip |
