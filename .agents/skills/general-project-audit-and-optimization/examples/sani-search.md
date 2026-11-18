# Sani administrator search

**AUD-006.** An administrator saves a text share with a Chinese slug, copies its browser-encoded short URL and pastes it into the admin search field. The same share must remain visible and editable under that filter. Changing the statistics period must preserve the filter and its single result.

## Replay

Use a local clone of [Sani](https://github.com/DejavuMoe/sani) containing the listed commits. Run on Linux with Bash, Git, tar, Make and the OS libraries for Playwright Chromium. The historical pair uses Go 1.27.3, Node 24.21.0 and pnpm 12.5.1 with the same dependency lockfile and Playwright configuration. The v2.0.0 recheck uses its own Go 1.27.4, Node 26.13.1 and pnpm 12.21.0. The script installs the locked packages and the matching headless browser if needed. Run attempts serially with loopback ports 18765 and 18770 free.

From this skill's root, run each command separately and record its exit status.

```sh
bash examples/sani-search.sh /path/to/sani 0205f32afb6dc340bb35ef69b19e6a7d061756ce
bash examples/sani-search.sh /path/to/sani 4419880b512dc65555b6abc88da3094665076df8
# Switch to the v2.0.0 tool pins before this replay.
bash examples/sani-search.sh /path/to/sani ebbbd385729a459df1a8a3ad737b0275b478436d
```

On Windows, use the same commands in a WSL2 Linux shell. Start in the source or installed skill directory containing `SKILL.md`, use the Sani checkout path as seen by Linux, and choose the tool versions for the candidate you are replaying.

The [replay script](sani-search.sh) exports the candidate's tracked files into a fresh directory, adds the same upstream test file under a distinct name, builds the product and runs one case with one worker and zero retries. The test fixture uses a new SQLite database, a local admin session and a real loopback server. Metadata fetching is disabled. The script cleans up its run directory, including the databases and Playwright traces. Tool and dependency caches can be reused.

## What the assertion observes

The upstream fixture creates the text share `搜索-zh-1280` using the admin HTTP API. In Chromium with a Chinese interface, dark theme and 1280 × 900 viewport, the test finds the share by slug, takes the encoded URL from the rendered link, fills the search box with it and checks that the original row is visible and unique. It edits the title, observes a successful PATCH to that share's ID, switches to seven days of statistics and checks for seven chart rows, the exact search text, one result, an API total of one and zero page errors. [Pinned upstream test](https://github.com/DejavuMoe/sani/blob/4419880b512dc65555b6abc88da3094665076df8/web/e2e/audit-regressions.spec.ts#L278)

Check the reporter for exactly one executed case with the name printed by the script. On the earlier revision, expect exit 1 at the original row's visibility assertion. On the repair and the release, expect exit 0 and one pass. A skipped case leaves the journey untested. A browser launch, dependency or port failure blocks verification.

## Recorded review

On 2026-11-18 the audit agent and a separate review agent each ran all three candidates on Debian WSL2 (linux/amd64). Each started with its own tracked-source export, server, database and browser context. Both used the same host and pinned upstream test. The reviewer received the contract, candidate and recipe and recorded observations independently of the producer's logs. [Runner excerpts and SHA-256 digests for all six runs](sani-search.evidence.txt)

| AUD-006 attempt | Producer | Independent reviewer | Disposition |
| --- | --- | --- | --- |
| 1. Before repair, `0205f32` | `FAIL`, exit 1 | `FAIL`, exit 1 | Returned. Both found the share by slug. After the encoded-URL search, row ID 1 was missing for five seconds at line 289. Editing and statistics were `NOT_RUN`. |
| 2. Upstream repair, `4419880` | `PASS`, exit 0 | `PASS`, exit 0 | Rechecked the returned criterion under the same ID. The original row survived the search, the edit succeeded and the statistics refresh preserved the filter. Reviewer recommended acceptance. |
| 3. Tagged v2.0.0, `ebbbd38` | `PASS`, exit 0 | `PASS`, exit 0 | Rebuilt and repeated the full journey on the tagged source with its own locked dependencies. Reviewer recommended acceptance for this revision too. |

For attempt 2 we selected Sani's existing repair. The server and the frontend filter now decode the short URL path before matching it against the stored slug. The skill replay added only the pinned test file to each disposable source copy. Owner sign-off was outside this exercise. [Upstream repair](https://github.com/DejavuMoe/sani/commit/4419880b512dc65555b6abc88da3094665076df8)

**Coverage limits.** The fixture creates one share and uses Playwright's `fill()` for the encoded URL. Native clipboard paste, discrimination among multiple records, title persistence after reload, other browsers and production behavior remain unverified.
