---
name: general-project-audit-and-optimization
description: Audit a local project or GitHub repository, present verified findings for one batch decision, and implement selected improvements. Use for project optimization, deep test audits, migration planning, reproducible feature acceptance or independent re-review of returned work.
---

# General project audit and optimization

Answer in the user's language. Start at the stage the user requested. During an audit, preserve the target's source, configuration and remote state. Use a disposable copy for checks that write files. An already selected fix goes straight to implementation and verification. A submitted feature can enter independent review directly. A return reopens its original finding ID at the unmet criterion.

## Chat commands

The user selects `general-project-audit-and-optimization` using their client's skill picker or native prefix, then supplies a command in chat. For example, Codex accepts `$general-project-audit-and-optimization audit`. With only the skill selected and no task, show brief help. A quick reply to a displayed menu in the same chat needs no skill prefix. Accept plain-language requests with an explicit task too.

`audit` uses the current project by default. Accept a GitHub URL or local path as the target. Topics can precede the target, as in `audit reliability,ci ../service`, `ci ../service` or `rewrite rust .`. Use `./ci` for a directory named like a topic.

| Input after selecting the skill | Action |
| --- | --- |
| `audit [target]` | Trace the project, run the relevant baseline checks and present one decision menu. |
| `tests`, `security`, `perf`, `reliability` | Focus on test coverage and obsolete code, defensive security, measured performance and resource use, or failure recovery. |
| `stack`, `data`, `rewrite <language>`, `ui`, `ci`, `agents` | Assess toolchains, databases and drivers, a language rewrite, user experience, CI or self-hosted agents. A rewrite request in this form asks for an assessment. |
| `fix <IDs>`, `trial <IDs>` | Implement the identified fix or run the bounded experiment. Use the agreed route and criteria. |
| `verify <ID> [ref]`, `review <ID> [ref]` | Replay acceptance or obtain an independent review. Resolve and record the candidate, defaulting to the current working state. |
| `return <ID> <reason>`, `accept <ID>` | Reopen the same finding on the stated criterion, or record the owner's explicit decision for the identified receipt. Preserve the actual check statuses. |
| `split`, `handoff`, `help` | Propose a split of selected work, prepare its handoff, or show commands and the current menu. Use these only when needed. |

An ID may be a stable finding ID (including an existing project ID) or a number from the active report. For a command outside that report, use the supplied finding or feature description and criteria. Ask once for any missing identity or contract needed to proceed.

## Establish what the project must keep doing

1. Identify the local path or GitHub repository, revision, working-tree changes, project instructions and requested scope. For a remote target, inspect the named ref and record its resolved commit. If execution needs a checkout, use an isolated local copy. Distinguish files actually inspected from surfaces unavailable to you.
2. Read the entry points, manifests, lockfiles, build and release definitions, data schemas and tests. Trace a representative user journey from input through persisted state or external effects to the observable result. Identify users, public contracts, deployment targets, data owners, failure recovery and supported older inputs. Mark inferred business requirements and what could confirm them.
3. Reproduce the existing checks and relevant workload as access permits. Record commands, versions, fixture, environment and pre-existing failures. Respect the project's source and build ownership. Inspect unfamiliar install hooks, task files and workflows before running them. Use disposable data and a least-privilege environment for third-party code.
4. In a whole-project audit, cover correctness, security, reliability, performance, resource use, tests and delivery. Follow dependencies and public consumers across package boundaries. Record material gaps in coverage. For a narrower request, trace only the paths needed to answer it.

## Build a finding that survives review

- Start from a contract and identify who experiences the consequence. Give a file and symbol or line, trigger, expected and observed result, and a compact way to verify it. Record a code trace, failing check, advisory or measurement and its limits. Rank by user impact, likelihood and breadth. Keep confidence separate from severity. Put plausible but unconfirmed issues under **needs evidence**, with the cheapest resolving check.
- For a deep test audit, map each suspect test to the behavior it protects. Trace exports, plugin discovery, reflection, generated bindings, CI/packaging, external callers and old stored data where relevant. Delete obsolete production code only after demonstrating that no supported contract or consumer relies on it. Retire a test only when its contract was retired or a named surviving test catches the same meaningful regression. Zero search hits, zero coverage and a failing test are each insufficient. Keep compatibility paths with unknown consumers. Repair genuine bugs at the shared cause.
- For security findings, inspect trust boundaries, permissions, data handling and dependency reachability. Match the installed artifact and platform to upstream or distribution advisories, including backports. Use configuration evidence and defensive regression checks. Redact secrets and personal data. For reliability, trace retries, duplicate work, partial writes, concurrency and recovery where they affect the journey.
- For speed or resource claims, profile a representative workload first. Pick a metric with units, such as p95 request latency, peak RSS, cold start, throughput or CI wall time. Compare equivalent inputs, hardware, build mode and cache state over repeated runs. Report spread, absolute and relative change, and meaningful trade-offs. Label estimates and microbenchmarks with their scope.
- When delegation is available, authorized and useful, split independent surfaces with clear ownership. Wait for every assigned review, independently verify its evidence, merge duplicates by root cause, and report gaps. A single reviewer uses the same evidence standard.

## Offer routes that fit the evidence

Keep the current implementation as the comparison point. Prefer the smallest option that meets the goal. Consider an in-place fix, a tool or access-layer change, a bounded rewrite or a wider migration only when project evidence or the user's request warrants it. For a named target language, evaluate that route explicitly. Recheck changing facts in primary documentation for the installed and target versions. Record the URL, lookup date and implications. Mark unknowns when a source or environment is unavailable.

**Technology constraints.** Exclude PHP, Java, Next.js and Deno as new implementation, runtime or tooling choices. Exclude dependencies on Vercel- or Cloudflare-specific services, APIs, SDKs, adapters and deployment features. Apply this to transitive operational requirements too. Inventory existing uses, who relies on them and a portable exit route. Preserve existing behavior through the selected migration. Surface any request that conflicts with these exclusions in the batch decision. For a portable candidate, show how to build, run and recover it on an independent host using ordinary protocols and exportable data.

Choose a guide when its subject could change the decision.

| When the evidence points here | Guide |
| --- | --- |
| Runtime, package manager, language support, build, lint or dependency lifecycle | [Toolchains](references/toolchains.md) |
| Slow queries, engine or ORM choice, data migration, requested cross-language rewrite | [Data and rewrites](references/data-and-rewrites.md) |
| User-facing flows, implicit states, copy, accessibility or visual design | [Interface review](references/interface.md) |
| Slow pipelines, test selection, quality gates or self-hosted agent workflows | [Continuous integration](references/ci.md) |
| Replaying a feature, obtaining an independent verdict, returning work or handing it off | [Feature acceptance](references/feature-acceptance.md) |

## Present one decision

Deliver one report in the conversation unless the user requests a file. Open with the project profile, critical user journey, baseline and highest-impact finding. Group related findings and give each a stable ID. Include the verification steps **in the report**. Use one compact table and expand the evidence for complex rows underneath it.

| Number, ID and priority | Impact and evidence | Options and recommendation | Decision cost | Acceptance |
| --- | --- | --- | --- | --- |
| 1 / F1, high (illustrative) | Client retry creates a second invoice. Include fixture, entry point and observed count. | Fix. Enforce the existing request key at the write boundary. A client debounce covers only one caller. | Small schema change. Check existing duplicate keys before rollout. | Replaying the same key leaves one invoice and returns its original ID. |

Give each material option an effort estimate with its assumptions, dependencies, conflicts, risks of action and deferral, and recovery cost. Mark estimates and label each row's recommended action and option. Offer shortcuts only for decisions the user actually has. If nothing warrants action, report the checked scope and remaining uncertainty.

End a report with open choices by printing its exact recommended bundle (for example, `A = fix F1 + F3, trial F2`) and the available replies below.

- Use `A` alone to confirm that displayed bundle or `D` alone to defer all open choices in the report.
- Numbers such as `1 3` confirm only those rows' displayed recommendations. In the same reply, `T2` requests a trial for row 2, `D2` defers it and `X2` rejects it. For example, `1 3 T2 X4` makes four decisions. Leave unmentioned items pending. A trial authorizes only its bounded experiment.
- Keep each number bound to its finding within this report, even after reprioritization. Accept spaces or commas between choices. Interpret letters case-insensitively and only against the active project's displayed menu. A valid reply confirms the choices and starts the selected work. For a stale menu, unknown number, conflicting choices or an unresolved dependency, clarify the ambiguity once before applying the batch. Honor explicit natural-language selections too. Approval at the findings menu authorizes the selected work. Owner sign-off applies to a specific tested receipt at acceptance.

## Implement and accept the selected work

1. For each selected ID, state the observable acceptance condition, scope and rollback trigger. For repeatable acceptance, identify the actor, clean starting state, exact command, expected effects and cleanup. A trial has a bounded workload, success threshold and stop condition. Trial approval covers the experiment only.
2. For a verified bug, first run a regression test that fails for the intended reason on the old code. Apply the smallest fix and rerun the same test, adjacent contracts and relevant project checks. If the old behavior or a required environment is unavailable, record that limit and use the strongest independent check possible. Preserve meaningful coverage. A weakened assertion, updated snapshot or new skip needs independent evidence that the supported contract changed.
3. For behavior-preserving optimization, verify parity and measure the promised outcome against the baseline. Check the normal entry point, compatibility, failure recovery and supported targets affected by the change. Respect existing authorization for implementation, external publication, production changes and irreversible data operations.
4. When independent review is requested or warranted by risk, give a different executor the pinned candidate and acceptance recipe. Record their own run from fresh state and their verdict. If the reviewer or owner returns the work, retain the original receipt, resolve the stated criterion and rerun the affected checks on the new attempt. Use the [feature acceptance guide](references/feature-acceptance.md) for these steps and for a multi-PR split or handoff when needed.
5. Close with a row per selected ID giving change, criterion, command or artifact, observed result and status. Use `PASS` for an executed check that met its criterion, `FAIL` for an executed violation, `NOT_RUN` for an omitted check and `BLOCKED` for a specific missing prerequisite. Bind results to the tested revision or working diff and environment. Give remaining blockers, unverified surfaces, deferred choices and the recovery action. When owner sign-off is due, list the passing IDs and tested revisions eligible for acceptance. Offer `Y` to accept exactly that list, `accept <ID>` for one receipt or `return <ID> <reason>` to reopen it. A reviewer's technical pass alone leaves the owner decision open.
