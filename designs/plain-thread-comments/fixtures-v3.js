(() => {
  "use strict";

  const authors = [
    { name: "青崖", website: "https://qingya.example.test" },
    { name: "Dejavu Moe", website: "https://dejavu.example.test" },
    { name: "南窗", website: null },
    { name: "木泽", website: "http://muze.example.test/notes" },
    { name: "初七", website: null },
    { name: "Lin", website: "javascript:alert('unsafe')" },
    { name: "风物长宜", website: "https://fengwu.example.test" },
    { name: "Mori", website: "ftp://files.example.test" },
    { name: "北岸", website: null },
    { name: "纸鸢", website: "https://zhiyuan.example.test/about" },
    { name: "远山", website: null },
    { name: "白榆", website: "https://baiyu.example.test" }
  ];

  const messages = [
    "这篇指南把安装、激活和后续维护拆开以后，查阅起来轻松很多。",
    "我更关心长期使用时，系统更新会不会把本地策略恢复成默认值？",
    "大版本更新后确实需要复查，最好把关键策略单独列成清单。",
    "这样就够了。比起承诺永久有效，我更需要知道什么时候重新检查。",
    "虚拟机里的结果和实体机一致，差别主要出现在驱动与电源管理。",
    "补充一个小细节：测试前记录快照时间，回滚时会省很多麻烦。",
    "纯文本安全测试：<script>window.__unsafe = true</script> 不应执行。",
    "Markdown 安全测试：**这段不会变粗**，链接语法也只按普通文字显示。",
    "第一行保留。\n第二行也应该原样显示，不合并成一段。",
    "没有头像和反应按钮之后，注意力确实更集中在讨论本身。",
    "六级讨论仍然能看清回复对象，手机上也不应该出现横向滚动。",
    "这是一段用于验证超长连续文本换行的内容：abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123456789。",
    "建议把每次验证的系统版本写清楚，未来回看时更容易判断结论是否仍然适用。",
    "文章里的命令我在干净环境重新跑过，顺序没有问题。",
    "如果后面补充自动化检查，可以把预期输出也一起记录下来。",
    "这里的边界说明很重要：测试结果不应该被描述成线上环境已经验收。"
  ];

  const comments = [];
  const rootDepths = [1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 6];
  const baseTime = Date.UTC(2026, 7, 13, 1, 10, 0);
  let nextID = 2400;
  let sequence = 0;

  const addComment = ({ parentId = null, rootId = null, depth, authorIndex, bodyIndex, deleted = false }) => {
    nextID += 1;
    sequence += 1;
    const author = authors[authorIndex % authors.length];
    const id = nextID;
    const record = {
      id,
      siteId: "blog-local",
      mark: "/posts/windows-11-iot-ltsc-guide/",
      parentId,
      rootId: rootId ?? id,
      depth,
      status: "approved",
      author: deleted ? "已删除" : author.name,
      privateEmail: deleted ? "" : `reader-${id}@example.test`,
      website: deleted ? null : author.website,
      body: deleted ? "" : messages[bodyIndex % messages.length],
      deleted,
      createdAt: new Date(baseTime + sequence * 7 * 60 * 1000).toISOString()
    };
    comments.push(record);
    return record;
  };

  rootDepths.forEach((targetDepth, rootIndex) => {
    const root = addComment({
      depth: 1,
      authorIndex: rootIndex,
      bodyIndex: rootIndex
    });
    let parent = root;

    for (let depth = 2; depth <= targetDepth; depth += 1) {
      const deleted = rootIndex === 4 && depth === 3;
      parent = addComment({
        parentId: parent.id,
        rootId: root.id,
        depth,
        authorIndex: rootIndex + depth,
        bodyIndex: rootIndex * 2 + depth,
        deleted
      });
    }

    if (rootIndex >= 1 && rootIndex <= 10) {
      addComment({
        parentId: root.id,
        rootId: root.id,
        depth: 2,
        authorIndex: rootIndex + 5,
        bodyIndex: rootIndex + 9
      });
    }
  });

  comments.push(
    {
      id: 9901,
      siteId: "blog-local",
      mark: "/posts/windows-11-iot-ltsc-guide/",
      parentId: null,
      rootId: 9901,
      depth: 1,
      status: "pending",
      author: "待审核访客",
      privateEmail: "pending@example.test",
      website: "https://pending.example.test",
      body: "这条待审核评论不得进入公共原型。",
      deleted: false,
      createdAt: "2026-08-13T09:31:00.000Z"
    },
    {
      id: 9902,
      siteId: "blog-local",
      mark: "/posts/windows-11-iot-ltsc-guide/",
      parentId: null,
      rootId: 9902,
      depth: 1,
      status: "rejected",
      author: "已拒绝访客",
      privateEmail: "rejected@example.test",
      website: null,
      body: "这条已拒绝评论不得进入公共原型。",
      deleted: false,
      createdAt: "2026-08-13T09:32:00.000Z"
    }
  );

  window.EcokuCommentFixtures = Object.freeze({
    generatedAt: "2026-08-13T10:00:00.000Z",
    pageSize: 4,
    comments: Object.freeze(comments),
    expected: Object.freeze({
      allRecords: 54,
      publicComments: 52,
      publicRoots: 12,
      maxDepth: 6,
      hiddenByModeration: 2
    })
  });
})();
