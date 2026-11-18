# Replaying and reviewing a user outcome

Use this guide when a feature needs repeatable acceptance, an independent verdict or a second review after a return. One finding ID can follow the work through all three. Keep the record in the audit report or an existing issue. Save a reusable recipe when another person, agent or CI job will run it.

## Write a recipe another executor can run

| Record | What the next executor needs |
| --- | --- |
| Outcome and identity | Actor, normal UI/CLI/API entry point, user-visible result, candidate commit or artifact digest, and any working diff. Identify the revision of the test separately if it differs. |
| Clean start | Required tool versions, exact setup command, synthetic data, initial state and services. Give each run its own writable state. Identify shared ports or services that require serial execution. |
| Actions and observations | Exact invocation or short sequence. State what to assert at the entry point and which saved state or external effect matters. Include a meaningful failure, retry or restart if the contract depends on it. |
| Result and cleanup | Expected test name/count and result, where to find evidence, how to clean up owned data/processes, and what the check cannot establish. Record missing prerequisites explicitly. |

Reuse the project's existing test and launch commands. For a known regression, the same assertion should fail for the intended reason on the earlier implementation and pass on the candidate. If the earlier revision predates the test, bring only the pinned test into a disposable copy and record that overlay. A missing test, skipped case, setup error or occupied port cannot confirm a product regression. If no historical failure exists, a controlled fault in a disposable copy can demonstrate that the check detects the fault. Label its origin. [Worked example using a real Sani browser test](../examples/sani-search.md)

## Obtain an independent verdict

When requested, or when the acceptance decision relies on high-risk behavior or disputed evidence, give a reviewer who did not implement the change the recipe, candidate identity and agreed criteria. Have them start with fresh state, run the entry point and record their own observations before comparing notes. A trusted CI run can supply execution evidence. Identify who independently assessed its scope and outcome. If only the author can rerun it, record the self-check and leave the requested independent review pending or blocked.

Keep one receipt per attempt. Record the finding ID, candidate and probe identities, executor, environment, command and exit code, named assertions actually reached, observations or redacted artifact, check status, review disposition and owner decision if given. Separate a reviewer's technical recommendation from the owner's acceptance. Different reviewers can use the same oracle and host. Record that common dependency.

## Return, revise and recheck

1. **Return.** Name the unmet criterion, expected and observed result, affected revision and prior receipt. A reviewer can return a technical failure. An owner can request a change after a technical pass. Group related returns into one decision.
2. **Triage.** For an in-scope defect, correct the cause. For an environment or evidence failure, repair the verification conditions and keep the product verdict open. If the owner changes the desired behavior, agree on the revised criterion before implementing it. Preserve the original assertion and outcome in the history.
3. **Rerun.** Keep the finding ID, assign a new attempt to the revised candidate or recipe, and link the earlier receipt. Repeat the disputed check and affected adjacent contracts. A changed head, artifact or oracle requires fresh evidence for what it can affect. Keep a previous pass attached to its original identity.
4. **Close.** Record `PASS`, `FAIL`, `NOT_RUN` or `BLOCKED` per check. A passing independent review can recommend acceptance. Record owner acceptance only when the owner or a previously authorized policy grants it. If a blocker or unexplained discrepancy persists, record the next resolving check and who can act.

## Split or hand off only when the work demands it

Keep one change together when it can be reviewed, verified and reverted as a unit. Split when an approved change has independently shippable outcomes or a prerequisite must land first. For each slice, a short row with the outcome, dependency, write scope/owner, acceptance command and recovery action is enough. On an actual handoff, also pass the current revision, last receipt, open decision and next action. Shared API, schema or lockfile changes need one named owner.
