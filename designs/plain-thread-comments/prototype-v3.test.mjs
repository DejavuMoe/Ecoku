import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const fixtureSource = fs.readFileSync(path.join(directory, "fixtures-v3.js"), "utf8");
const prototypeSource = fs.readFileSync(path.join(directory, "prototype-v3.js"), "utf8");
const htmlSource = fs.readFileSync(path.join(directory, "index-v3.html"), "utf8");
const cssSource = fs.readFileSync(path.join(directory, "styles-v3.css"), "utf8");

const context = { window: {} };
vm.runInNewContext(fixtureSource, context, { filename: "fixtures-v3.js" });
const fixtures = context.window.EcokuCommentFixtures;
const publicComments = fixtures.comments.filter((comment) => comment.status === "approved");
const hiddenComments = fixtures.comments.filter((comment) => comment.status !== "approved");
const roots = publicComments.filter((comment) => comment.parentId === null);
const byId = new Map(publicComments.map((comment) => [comment.id, comment]));

assert.equal(fixtures.comments.length, 54, "fixture should contain 54 records");
assert.equal(publicComments.length, 52, "public fixture should contain 52 approved comments");
assert.equal(roots.length, 12, "public fixture should contain 12 root threads");
assert.equal(hiddenComments.length, 2, "pending and rejected fixtures should stay non-public");
assert.deepEqual(
  [...new Set(publicComments.map((comment) => comment.depth))].sort(),
  [1, 2, 3, 4, 5, 6],
  "fixture should cover every depth from 1 through 6"
);

for (const comment of publicComments) {
  if (comment.parentId === null) {
    assert.equal(comment.depth, 1, `root ${comment.id} should have depth 1`);
    assert.equal(comment.rootId, comment.id, `root ${comment.id} should reference itself`);
    continue;
  }

  const parent = byId.get(comment.parentId);
  assert.ok(parent, `comment ${comment.id} should have a public parent`);
  assert.equal(comment.depth, parent.depth + 1, `comment ${comment.id} should increment parent depth`);
  assert.equal(comment.rootId, parent.rootId, `comment ${comment.id} should stay in its parent thread`);
  assert.equal(comment.siteId, parent.siteId, `comment ${comment.id} should stay in the same site`);
  assert.equal(comment.mark, parent.mark, `comment ${comment.id} should stay on the same page`);

  const visited = new Set([comment.id]);
  let cursor = parent;
  while (cursor) {
    assert.ok(!visited.has(cursor.id), `comment ${comment.id} should not be part of a cycle`);
    visited.add(cursor.id);
    cursor = cursor.parentId === null ? null : byId.get(cursor.parentId);
  }
}

const deleted = publicComments.find((comment) => comment.deleted);
assert.ok(deleted, "fixture should include a deleted tombstone");
assert.equal(deleted.privateEmail, "", "deleted fixture should clear private email");
assert.equal(deleted.website, null, "deleted fixture should clear website");
assert.equal(deleted.body, "", "deleted fixture should clear original body");
assert.ok(
  publicComments.some((comment) => comment.parentId === deleted.id),
  "deleted fixture should retain descendants"
);

assert.match(fixtureSource, /javascript:/, "fixture should exercise an unsafe website protocol");
assert.match(fixtureSource, /ftp:\/\//, "fixture should exercise an unsupported website protocol");
assert.doesNotMatch(prototypeSource, /\.innerHTML\s*=|insertAdjacentHTML/, "prototype should not render untrusted HTML");
assert.match(prototypeSource, /parsed\.protocol === "http:" \|\| parsed\.protocol === "https:"/, "website links should be protocol allowlisted");
assert.doesNotMatch(htmlSource, />\s*链接\s*</, "prototype should not render a standalone link label");
assert.match(htmlSource, /id="comment-count"[^>]*>正在加载<\/h2>/, "comment count should be the only heading text");
assert.match(htmlSource, />最新评论<\/button>/, "sort menu should use the approved newest label");
assert.match(htmlSource, />最早评论<\/button>/, "sort menu should use the approved oldest label");
assert.match(cssSource, /\.root-thread\s*\{[^}]*border-bottom:/s, "each root thread should own one divider");
assert.doesNotMatch(cssSource, /\.comment-node\s*\{[^}]*border-bottom:/s, "child comments should not own dividers");
assert.match(cssSource, /data-depth="6"/, "CSS should explicitly cover sixth-level comments");

console.log("prototype-v3 fixture and static contract tests passed");
