# FVT Coverage Plan (Phased)

This document serves as the `plan.yaml` content for the Agentic Harness. It
instructs the SETUP, DOER, REVIEWER, and TEARDOWN agents to download the IBM
CodeEngine samples/ai repository, capture a baseline, run a coverage-driven FVT
loop over every sample project, and finish by pushing changes and writing a
final summary.

This prompt must be written as a phased `plan.yaml` (version `2`) with exactly
these top-level sections:

- `meta` — title, version (`"2"`), and author
- `inputs` — files, directories, or URLs the agents need
- `phases.setup` — one-time preparation and baseline capture
- `phases.execute` — the Plan-Do-Review loop
- `phases.teardown` — one-time finishing steps
- `rules` — references to the active rules in `rules.yaml`

Before writing the YAML, classify every step into one of the three buckets
below. Do not mix one-time work into the execute loop.

1. **ONE-TIME SETUP**: clone repos, install tools, download inputs, capture
   baseline coverage, write `setup/starting-summary.md`.
2. **ITERATIVE EXECUTE**: discover samples, write tests, run coverage, compare
   against previous iteration, decide `done`/`incomplete`.
3. **ONE-TIME TEARDOWN**: push branch, open pull request, write
   `teardown/final-summary.md` comparing results to the starting summary and
   explaining why the loop finished.

---

## Plan

### meta

```yaml
meta:
  title: IBM CodeEngine samples/ai FVT coverage run
  version: "2"
  author: agentic-harness
```

### inputs

```yaml
inputs:
  - name: code_engine_samples
    type: url
    path: https://github.com/IBM/CodeEngine.git
    description: IBM CodeEngine samples repository containing samples/ai projects
  - name: prompt
    type: file
    path: fvt-coverage.md
    description: Original Markdown prompt used to derive this plan
  - name: ollama_models
    type: string
    value: ""
    description: Optional comma-separated list of Ollama model tags (DOER first, REVIEWER second)
  - name: github_repo
    type: string
    value: ""
    description: Optional owner/repo slug for PR creation
  - name: github_base_branch
    type: string
    value: master
    description: Optional base branch for PR creation
```

### phases.setup

The SETUP agent runs once before the execute loop.

Responsibilities:

1. Clone the IBM CodeEngine samples repository:

   ```bash
   git clone https://github.com/IBM/CodeEngine.git inputs/code-engine-samples
   ```

   If the repository is already present,
   verify it is a valid git clone and skip the download step.

2. Install tools needed by the harness for all samples, i.e.:
   - For Node.js samples with a `package.json`: run `npm install`.
   - For Python samples with a `requirements.txt`: run `pip install -r requirements.txt`.

3. Capture baseline FVT coverage for every sample under
   `CodeEngine/gallery/` using the detected test framework.
   Record the starting coverage percentages for `lines`, `statements`,
   `functions`, and `branches`, plus the total number of samples discovered.

4. Write `setup/starting-summary.md` describing:
   - The IBM CodeEngine repository URL and commit-ish used.
   - The number of sample projects discovered under `gallery/`.
   - The baseline coverage per sample (at minimum lines coverage percent).
   - The framework detected for each sample.
   - Any samples that could not be tested (no recognizable project files).

```yaml
phases:
  setup:
    description: >
      Clone the IBM CodeEngine samples repository into inputs/code-engine-samples.
      If the repository is already present, verify it is a valid git clone and skip
      the download step. Install dependencies for every sample under
      samples/ai/ (npm install for Node.js, pip install for Python). Capture
      baseline FVT coverage for each sample using the detected framework and
      write setup/starting-summary.md describing the repository URL, commit-ish,
      number of samples discovered, baseline coverage per sample, detected
      frameworks, and any samples that could not be tested.
    outputs:
      - name: starting-summary
        type: file
        path: setup/starting-summary.md
        description: Baseline coverage state for every discovered sample
```

### phases.execute

The DOER and REVIEWER agents run in a Plan-Do-Review loop until the reviewer
signals `done`, the maximum iteration limit is reached, or the time limit is
exceeded.

#### Goal

Increase FVT line coverage for every sample under `gallery/` in the IBM
CodeEngine repository.

**Measurable goal:** For each sample, `coverage_percent >= 100` (lines), or stop
when the per-sample improvement between consecutive iterations is 5% or less.

#### Completion criteria

| ID      | Description                  | Test                        |
|---------|------------------------------|-----------------------------|
| CC-001  | Coverage reaches 100%        | `coverage_percent >= 100`   |
| CC-002  | Coverage improvement stalls| `coverage_delta_percent <= 5` |
| CC-003  | Tests pass after changes     | `npm test` exits 0          |

#### DOER instructions

You are the DOER agent.

1. Read `setup/starting-summary.md` to understand the baseline coverage and
   which samples were discovered.

2. For each sample, read the existing source files and tests. Add focused FVT
   tests that exercise currently uncovered code paths.

   - Keep tests in the same language and framework as the sample.
   - Do not modify application source code unless strictly necessary to make
     it testable; prefer adding tests.
   - Place new test files alongside existing tests, following the sample's
     conventions.

3. Run the tests with coverage using the detected framework. Extract the
   coverage percentages for `lines`, `statements`, `functions`, and `branches`.
   Write the metrics to the sample output directory as `coverage.json`:

   ```json
   {
     "lines": { "total": 120, "covered": 96, "percent": 80.0 },
     "statements": { "total": 130, "covered": 104, "percent": 80.0 },
     "functions": { "total": 15, "covered": 12, "percent": 80.0 },
     "branches": { "total": 40, "covered": 28, "percent": 70.0 },
     "timestamp": "2026-06-14T12:00:00Z",
     "sampleName": "example-sample",
     "iteration": 1
   }
   ```

4. After producing all `coverage.json` files, hand off to the REVIEWER. If
   the REVIEWER signals `incomplete`, start the next iteration targeting the
   gaps listed in `review.yaml`. Continue until the REVIEWER signals `done`
   or the harness reaches its iteration/time limit.

#### REVIEWER instructions

You are the REVIEWER agent.

1. Load every `coverage.json` produced by the DOER. The primary metric is
   **lines** coverage percentage.

2. Compare the current coverage to the previous iteration (or to the baseline
   in `setup/starting-summary.md` on iteration 1). Compute the per-sample
   delta:

   ```
   delta = current_coverage_percent - previous_coverage_percent
   ```

3. Decide `done` when **all** samples meet one of these conditions:

   - **CC-001 (Threshold reached):** `coverage_percent >= 100`
   - **CC-002 (Coverage stalled):** `coverage_delta_percent <= 5`

   Otherwise, signal `incomplete` and list the remaining gaps.

4. For each sample, write a `review.yaml` to the sample output directory:

   ```yaml
   status: done | incomplete
   coverage_percent: <number>
   coverage_delta_percent: <number>
   gaps:
     - "lines: 80% covered (24 of 120 uncovered)"
     - "branches: 70% covered (12 of 40 uncovered)"
   iteration: <number>
   sample_name: <string>
   ```

5. When signaling `done` due to stall (not 100%), include a clear list of
   remaining uncovered areas. When signaling `incomplete`, list every metric
   below 100% as a gap. When all samples reach 100%, the gaps list is empty.

#### phases.execute outputs

```yaml
phases:
  execute:
    description: >
      For every sample discovered in setup, read the existing source files and
      tests, add focused FVT tests that exercise currently uncovered code paths,
      run the tests with coverage, and write per-sample coverage.json files.
      Hand off to the REVIEWER after each iteration. Continue until the
      REVIEWER signals done, the maximum iteration limit is reached, or the
      time limit is exceeded.
    goal:
      description: Increase FVT line coverage for every sample under samples/ai/.
      measurable: For each sample, coverage_percent >= 100 (lines), or stop when the per-sample improvement between consecutive iterations is 5% or less.
    completion_criteria:
      - id: CC-001
        description: Coverage reaches 100%
        test: coverage_percent >= 100
      - id: CC-002
        description: Coverage improvement stalls
        test: coverage_delta_percent <= 5
      - id: CC-003
        description: Tests pass after coverage changes
        test: npm test exits 0
    doer: >
      Read setup/starting-summary.md to understand the baseline coverage and
      discovered samples. For each sample, add focused FVT tests that exercise
      currently uncovered code paths, keeping tests in the same language and
      framework. Run the tests with coverage using the detected framework,
      extract coverage percentages for lines, statements, functions, and
      branches, and write a coverage.json file to the sample output directory.
      Hand off to the REVIEWER. If the REVIEWER signals incomplete, start the
      next iteration targeting the listed gaps. Continue until the REVIEWER
      signals done or the harness reaches its iteration/time limit.
    reviewer: >
      Load every coverage.json produced by the DOER. The primary metric is
      lines coverage percentage. Compare current coverage to the previous
      iteration (or to setup/starting-summary.md on iteration 1) and compute
      per-sample deltas. Signal done when all samples meet either
      coverage_percent >= 100 or coverage_delta_percent <= 5. Otherwise signal
      incomplete and list every metric below 100% as a gap. For each sample,
      write a review.yaml with status, coverage_percent, coverage_delta_percent,
      gaps, iteration, and sample_name.
    outputs:
      - name: coverage-reports
        type: directory
        path: samples
        description: Per-sample coverage.json files produced by the DOER
      - name: review-reports
        type: directory
        path: samples
        description: Per-sample review.yaml files produced by the REVIEWER
```

### phases.teardown

The TEARDOWN agent runs once after the execute loop ends, regardless of whether
the loop finished with `done`, `incomplete`, `timeout`, or an error.

Responsibilities:

1. Read `setup/starting-summary.md` and all `coverage.json` files produced
   during the execute phase.

2. Compare the final coverage to the baseline coverage in
   `setup/starting-summary.md`. Report, per sample:
   - Starting lines coverage
   - Final lines coverage
   - Absolute and percentage-point improvement
   - Whether the sample reached 100%, stalled, or remains incomplete

3. Explain **why the loop finished**: reviewer done, max iterations reached,
   timeout, or setup failure. Reference the final review status for each
   sample.

4. Push the FVT changes to a new branch in the samples repository. Open a
   GitHub pull request from that branch to the base branch.

   - Use `GITHUB_TOKEN` (required) to authenticate.
   - Resolve the target repository and base branch in this order:
     a. `meta.github_repo` / `inputs.github_repo` and `meta.github_base_branch` /
        `inputs.github_base_branch` from the plan.
     b. `GITHUB_REPO` and `GITHUB_BASE_BRANCH` environment variables.
     c. The git origin remote of `inputs/code-engine-samples`, defaulting the
        base branch to `master`.
   - Write the created PR URL to `teardown/pr-url.txt`.

5. Write `teardown/final-summary.md` that contains:
   - A recap of the IBM CodeEngine samples repository used.
   - The baseline coverage from `setup/starting-summary.md`.
   - The final coverage per sample.
   - A comparison showing improvement or stall.
   - The reason the loop finished.
   - The PR URL (if one was created) and where the changed files can be found.

```yaml
phases:
  teardown:
    description: >
      Read setup/starting-summary.md and all coverage.json files produced during
      the execute phase. Compare final coverage to the baseline and report, per
      sample, the starting lines coverage, final lines coverage, absolute and
      percentage-point improvement, and whether the sample reached 100%, stalled,
      or remains incomplete. Explain why the loop finished (reviewer done, max
      iterations reached, timeout, or setup failure). Push FVT changes to a new
      branch in the samples repository, open a GitHub pull request to the base
      branch using GITHUB_TOKEN, and write the created PR URL to
      teardown/pr-url.txt. Write teardown/final-summary.md that contains a
      recap of the repository used, the baseline coverage, the final coverage
      per sample, the comparison showing improvement or stall, the reason the
      loop finished, and the PR URL (if created) with the location of changed
      files.
    outputs:
      - name: final-summary
        type: file
        path: teardown/final-summary.md
        description: Final summary comparing results to setup/starting-summary.md and explaining why the loop finished
      - name: pr-url
        type: file
        path: teardown/pr-url.txt
        description: URL of the created pull request
```

### rules

```yaml
rules:
  - rule_id: RULE-001
    applies: true
  - rule_id: RULE-002
    applies: true
```

---

## Rules

- Never commit credentials or secrets.
- Only use environment variables for credentials.
- Do not modify files outside the sample output directory and the downloaded
  samples directory.
- The DOER must not evaluate its own work; the REVIEWER is the sole arbiter
  of completion.
- Each iteration must produce both `coverage.json` and `review.yaml` before
  the next iteration begins.
- One-time work (cloning, installing dependencies, PR creation) belongs in
  setup or teardown, never in the execute loop.

---

## Extracted plan.yaml

To use this prompt directly as a `plan.yaml`, extract the YAML blocks above
into a single file. The combined YAML must satisfy these structure checks:

- `meta.title`, `meta.version` (`"2"`), and `meta.author` are present.
- `inputs` has at least one entry with `name`, `type`, and `description`.
- `phases.setup.description` is non-empty and contains instructions to clone
  the repository, install tools, and capture baseline coverage.
- `phases.setup.outputs` includes an entry whose `path` ends with
  `setup/starting-summary.md`.
- `phases.execute.goal.measurable` is non-empty.
- `phases.execute.completion_criteria` has at least one entry with `id`,
  `description`, and `test`.
- `phases.execute.doer` and `phases.execute.reviewer` are non-empty.
- `phases.teardown.description` is non-empty and contains instructions to push
  a branch, open a pull request, write `teardown/final-summary.md` that
  compares results to `setup/starting-summary.md`, and explain why the loop
  finished.
- `phases.teardown.outputs` includes entries whose paths end with
  `teardown/final-summary.md` and `teardown/pr-url.txt`.
- `rules` lists at least one rule reference with `rule_id` and `applies`.
