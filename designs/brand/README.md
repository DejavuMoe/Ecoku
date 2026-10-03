# Ecoku 品牌标识

`index-v2.html` 是已批准的品牌标识稿：把「區」刻成一方白文朱印。外框「匸」三面合围、向右敞开，
与评论区的 `[-]`、`[博主]` 方括号同一手势；里面「品」的三个口，也是一条评论和它下面的两条回复。
字标沿用 Georgia 衬线 Ecoku。管理后台、文档站与通知邮件（邮件模板 v7）已使用这一枚标志；管理后台与文档站同时使用 favicon。

`index-v1.html`（评论气泡印章内刻衬线 E）已被否决，仅作记录保留，不再使用。

## 文件

- `ecoku-mark.svg`：标准彩色标志（64×64 网格），印面朱砂 `#b8472f`，刻线为纸色 `#f7f4ee`；
- `ecoku-mark-mono.svg`：单色版，刻线以 mask 镂空，使用 `currentColor`；
- `favicon.svg`：浏览器标签页图标，系统深色模式下印面提亮为 `#c55a40`、刻线改为深色纸 `#1a1816`；
- `app-icon.svg`：180×180 纸色底图标，批准后导出 `apple-touch-icon.png`；
- `ecoku-mark-email.png`：已批准，邮件模板 v7 页眉内嵌使用。由 `ecoku-mark-mono.svg` 以朱砂 `#b8472f` 在浏览器 canvas 中渲染为 84×84 RGBA PNG，
  刻线与印外透明，邮件按 28×28 显示；改动标志时需重新导出；
- `index-v2.html`：字源、印稿网格、尺寸、组合、应用与用法说明；首屏印蜕只用于展示，标志文件本身不带滤镜；
- `_d_meta.json`：设计审批元数据。

## 生产映射

- `ecoku-mark.svg` → `docs/public/logo.svg`
- `favicon.svg` → `docs/public/favicon.svg`、`packages/admin/public/favicon.svg`
- `app-icon.svg`：保留的应用图标导出资源，当前未接入管理后台。
- `ecoku-mark-email.png` → `server/notifications/ecoku-mark.png`：编译进服务端，作为内嵌附件（Content-ID `ecoku-mark`）随通知邮件发送；两份文件须保持一致，服务端测试会比对。

批准前不修改生产文件。
