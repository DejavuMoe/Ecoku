import { ref } from 'vue'
import type { EcokuLocale } from './types'

export const adminLocale = ref<EcokuLocale>('zh-CN')
let refreshTranslations: () => void = () => {}

const catalog = {
  'zh-CN': {
    comments: '评论', sites: '站点', notifications: '通知', security: '安全',
    skip: '跳到主要内容', loginTitle: '管理员登录', username: '用户名', password: '密码', login: '登录', loggingIn: '登录中…',
    logout: '退出登录', discardTitle: '放弃未保存的修改？', discardCopy: '离开后，本页的修改不会保存。', continue: '继续编辑', discard: '放弃修改',
    locale: '后台语言', simple: '简体中文', traditional: '繁體中文', english: 'English',
  },
  'zh-Hant': {
    comments: '評論', sites: '站點', notifications: '通知', security: '安全',
    skip: '跳到主要內容', loginTitle: '管理員登入', username: '使用者名稱', password: '密碼', login: '登入', loggingIn: '登入中…',
    logout: '登出', discardTitle: '放棄尚未儲存的修改？', discardCopy: '離開後，本頁的修改不會儲存。', continue: '繼續編輯', discard: '放棄修改',
    locale: '後台語言', simple: '简体中文', traditional: '繁體中文', english: 'English',
  },
  en: {
    comments: 'Comments', sites: 'Sites', notifications: 'Notifications', security: 'Security',
    skip: 'Skip to main content', loginTitle: 'Admin sign in', username: 'Username', password: 'Password', login: 'Sign in', loggingIn: 'Signing in…',
    logout: 'Sign out', discardTitle: 'Discard unsaved changes?', discardCopy: 'Leaving this page will discard its changes.', continue: 'Keep editing', discard: 'Discard changes',
    locale: 'Admin language', simple: '简体中文', traditional: '繁體中文', english: 'English',
  },
} as const

export type AdminKey = keyof typeof catalog['zh-CN']
export function setAdminLocale(value: EcokuLocale | undefined): void {
  adminLocale.value = value === 'en' || value === 'zh-Hant' ? value : 'zh-CN'
}
export function adminText(key: AdminKey): string { return catalog[adminLocale.value][key] }

const translations: Record<AdminKey, Record<EcokuLocale, string>> = {
  comments: { 'zh-CN': '评论', 'zh-Hant': '評論', en: 'Comments' }, sites: { 'zh-CN': '站点', 'zh-Hant': '站點', en: 'Sites' }, notifications: { 'zh-CN': '通知', 'zh-Hant': '通知', en: 'Notifications' }, security: { 'zh-CN': '安全', 'zh-Hant': '安全', en: 'Security' },
  skip: { 'zh-CN': '跳到主要内容', 'zh-Hant': '跳到主要內容', en: 'Skip to main content' }, loginTitle: { 'zh-CN': '管理员登录', 'zh-Hant': '管理員登入', en: 'Admin sign in' }, username: { 'zh-CN': '用户名', 'zh-Hant': '使用者名稱', en: 'Username' }, password: { 'zh-CN': '密码', 'zh-Hant': '密碼', en: 'Password' }, login: { 'zh-CN': '登录', 'zh-Hant': '登入', en: 'Sign in' }, loggingIn: { 'zh-CN': '登录中…', 'zh-Hant': '登入中…', en: 'Signing in…' }, logout: { 'zh-CN': '退出登录', 'zh-Hant': '登出', en: 'Sign out' }, discardTitle: { 'zh-CN': '放弃未保存的修改？', 'zh-Hant': '放棄尚未儲存的修改？', en: 'Discard unsaved changes?' }, discardCopy: { 'zh-CN': '离开后，本页的修改不会保存。', 'zh-Hant': '離開後，本頁的修改不會儲存。', en: 'Leaving this page will discard its changes.' }, continue: { 'zh-CN': '继续编辑', 'zh-Hant': '繼續編輯', en: 'Keep editing' }, discard: { 'zh-CN': '放弃修改', 'zh-Hant': '放棄修改', en: 'Discard changes' }, locale: { 'zh-CN': '后台语言', 'zh-Hant': '後台語言', en: 'Admin language' }, simple: { 'zh-CN': '简体中文', 'zh-Hant': '简体中文', en: '简体中文' }, traditional: { 'zh-CN': '繁體中文', 'zh-Hant': '繁體中文', en: '繁體中文' }, english: { 'zh-CN': 'English', 'zh-Hant': 'English', en: 'English' },
}

const textCatalog: Record<EcokuLocale, Record<string, string>> = {
  'zh-CN': Object.fromEntries(Object.keys(translations).map(key => [translations[key as AdminKey]['zh-CN'], translations[key as AdminKey]['zh-CN']])),
  'zh-Hant': Object.fromEntries(Object.keys(translations).map(key => [translations[key as AdminKey]['zh-CN'], translations[key as AdminKey]['zh-Hant']])),
  en: Object.fromEntries(Object.keys(translations).map(key => [translations[key as AdminKey]['zh-CN'], translations[key as AdminKey].en])),
}

for (const [source, values] of Object.entries({
  '关闭': ['關閉', 'Off'], '开启': ['開啟', 'On'], '必填': ['必填', 'Required'], '选填': ['選填', 'Optional'], '保存': ['儲存', 'Save'], '重试': ['重試', 'Retry'], '取消': ['取消', 'Cancel'], '新增站点': ['新增站點', 'New site'], '站点设置': ['站點設定', 'Site settings'], '基本信息': ['基本資訊', 'Basic information'], '评论区': ['評論區', 'Comment area'], '评论排序': ['評論排序', 'Comment order'], '最新评论': ['最新評論', 'Newest'], '最早评论': ['最早評論', 'Oldest'], '站点 ID': ['站點 ID', 'Site ID'], '站点 URL': ['站點 URL', 'Site URL'], '站点名称': ['站點名稱', 'Site name'], '允许来源': ['允許來源', 'Allowed origins'], '评论长度上限': ['評論長度上限', 'Comment limit'], '评论占位文案': ['評論佔位文案', 'Comment placeholder'], '无评论文案': ['無評論文案', 'Empty-state message'], '评论已发布。': ['評論已發布。', 'Comment posted.'], '回复已发布。': ['回覆已發布。', 'Reply posted.'], '有未保存的修改': ['有尚未儲存的修改', 'Unsaved changes'], '站点已创建。': ['站點已建立。', 'Site created.'], '站点设置已保存。': ['站點設定已儲存。', 'Site settings saved.'], '请求参数不符合要求，请检查后重试。': ['請求參數不符合要求，請檢查後重試。', 'The request is invalid. Check it and try again.'], '操作过于频繁，请稍后重试。': ['操作過於頻繁，請稍後重試。', 'Too many requests. Try again later.'], '服务端暂时无法完成操作，数据没有被修改。': ['伺服器暫時無法完成操作，資料未被修改。', 'The server could not complete the operation; no data was changed.'], '管理会话已过期，请重新登录。': ['管理工作階段已過期，請重新登入。', 'Your admin session expired. Sign in again.'], '用户名或密码错误。': ['使用者名稱或密碼錯誤。', 'Incorrect username or password.'], '当前实例还没有站点。': ['目前實例還沒有站點。', 'This instance has no sites yet.'], '请输入用户名，或保留 admin。': ['請輸入使用者名稱，或保留 admin。', 'Enter a username, or keep admin.'], '新密码至少 12 个字符，且不能超过 72 个 UTF-8 字节。': ['新密碼至少 12 個字元，且不能超過 72 個 UTF-8 位元組。', 'The new password must be at least 12 characters and no more than 72 UTF-8 bytes.'], '两次输入的密码不一致。': ['兩次輸入的密碼不一致。', 'The passwords do not match.'], '保存并进入后台': ['儲存並進入後台', 'Save and open admin'], '设置你的密码': ['設定你的密碼', 'Set your password'], '用户名': ['使用者名稱', 'Username'], '新密码': ['新密碼', 'New password'], '确认密码': ['確認密碼', 'Confirm password'], '显示密码': ['顯示密碼', 'Show password'], '至少 12 个字符，最多 72 个 UTF-8 字节；可粘贴密码管理器生成的密码。': ['至少 12 個字元，最多 72 個 UTF-8 位元組；可貼上密碼管理器產生的密碼。', 'Use at least 12 characters and at most 72 UTF-8 bytes; password-manager values are supported.'], '完成设置前，暂不能管理站点或评论。': ['完成設定前，暫時不能管理站點或評論。', 'Sites and comments remain unavailable until setup is complete.'], '评论列表没有加载出来': ['評論列表無法載入', 'Comments could not be loaded'], '当前没有站点': ['目前沒有站點', 'No sites are configured'], '评论暂时不可用': ['評論暫時無法使用', 'Comments are temporarily unavailable'], '已发布': ['已發布', 'Published'], '已删除': ['已刪除', 'Deleted'], '墓碑删除': ['墓碑刪除', 'Tombstone delete'], '彻底删除': ['徹底刪除', 'Delete permanently'], '查看原评论': ['查看原評論', 'View original comment'], '上一页': ['上一頁', 'Previous'], '下一页': ['下一頁', 'Next'], '电子邮件': ['電子郵件', 'Email'], '邮件通知': ['郵件通知', 'Email notifications'], 'Telegram 通知': ['Telegram 通知', 'Telegram notifications'], '发送测试邮件': ['發送測試郵件', 'Send test email'], '发送测试消息': ['發送測試訊息', 'Send test message'], '人机验证': ['人機驗證', 'CAPTCHA'], '验证设置': ['驗證設定', 'Verification settings'], '验证设置已保存。': ['驗證設定已儲存。', 'Verification settings saved.'], '通知收件人': ['通知收件人', 'Notification recipients'], '接收目标 ID': ['接收目標 ID', 'Target IDs'], '实例设置': ['實例設定', 'Instance settings'], '保存栏': ['儲存列', 'Save bar'],
} as const)) {
  textCatalog['zh-Hant'][source] = values[0]
  textCatalog.en[source] = values[1]
}

for (const [source, values] of Object.entries({
  'Ecoku 评论管理首页': ['Ecoku 評論管理首頁', 'Ecoku comment management home'],
  '主导航': ['主導航', 'Primary navigation'], '主导航（底部）': ['主導航（底部）', 'Primary navigation (bottom)'],
  '更换临时密码后，即可进入管理后台。用户名可以保留为 admin。': ['更換臨時密碼後，即可進入管理後台。使用者名稱可以保留為 admin。', 'Replace the temporary password to enter the admin console. You may keep the username admin.'],
  '正在保存…': ['正在儲存…', 'Saving…'], '设置成功': ['設定成功', 'Setup complete'],
  '无评论': ['無評論', 'No comments'], '正在加载评论…': ['正在載入評論…', 'Loading comments…'],
  '当前没有站点': ['目前沒有站點', 'No sites are configured'], '尚未保存': ['尚未儲存', 'Not saved'],
  '不在当前页': ['不在目前頁面', 'Not on this page'], '已发布': ['已發布', 'Published'], '已删除': ['已刪除', 'Deleted'],
  '当前没有已发布评论': ['目前沒有已發布評論', 'No published comments'], '当前没有已删除评论': ['目前沒有已刪除評論', 'No deleted comments'],
  '通知设置': ['通知設定', 'Notification settings'], '对所有站点生效，保存后立即使用新配置。': ['對所有站點生效，儲存後立即使用新設定。', 'Applies to all sites after saving.'],
  '有新评论时发给通知收件人；访客留了邮箱时，他的评论被别人回复也会收到邮件。': ['有新評論時傳送給通知收件人；訪客留下信箱後，他的評論被回覆也會收到郵件。', 'Send new comments to the recipients. Visitors who leave an email also receive replies to their comments.'],
  'SMTP 服务器': ['SMTP 伺服器', 'SMTP server'], '加密方式': ['加密方式', 'Encryption'], '发件人地址': ['寄件人地址', 'From address'],
  '有新评论时由机器人发到下列用户、群组或频道。': ['有新評論時由機器人傳送到下列使用者、群組或頻道。', 'The bot sends new comments to the users, groups or channels below.'],
  '安全': ['安全', 'Security'], '人机验证对整个实例生效，同时用于访客评论和管理员登录，不按站点分开。': ['人機驗證對整個實例生效，同時用於訪客評論和管理員登入，不按站點分開。', 'CAPTCHA applies to the whole instance, including visitor comments and admin sign-in.'],
  '三种方式互斥，切换后保存才会生效。': ['三種方式互斥，切換後儲存才會生效。', 'Choose one provider; changes take effect after saving.'],
  '不显示验证组件': ['不顯示驗證元件', 'Do not show a CAPTCHA'], '由 Cloudflare 托管的验证': ['由 Cloudflare 託管的驗證', 'Hosted by Cloudflare'], '连接自托管的 Cap 实例': ['連接自託管的 Cap 實例', 'Connect to a self-hosted Cap instance'],
  '关闭后，访客评论和管理员登录都不再要求额外验证；现有限流仍然生效。': ['關閉後，訪客評論和管理員登入都不再要求額外驗證；現有限流仍然生效。', 'With CAPTCHA disabled, comments and admin sign-in need no extra challenge; rate limits still apply.'],
  '实例地址': ['實例地址', 'Instance URL'], '自托管 Cap 的 HTTPS 地址，不带查询参数。': ['自託管 Cap 的 HTTPS 地址，不帶查詢參數。', 'The HTTPS URL of the self-hosted Cap instance, without query parameters.'],
  '关闭后需保存才会生效': ['關閉後需儲存才會生效', 'Save for the change to take effect'],
  '评论区语言': ['評論區語言', 'Comment language'], '访客评论区的默认语言；接入 SDK 时传入 `i18n` 可以覆盖此设置。': ['訪客評論區的預設語言；接入 SDK 時傳入 `i18n` 可以覆寫此設定。', 'The default language for visitors; the SDK `i18n` option overrides it.'],
  '启用': ['啟用', 'On'], '表情包': ['表情包', 'Stickers'], 'Smoji 清单': ['Smoji 清單', 'Smoji manifest'], '图片来源': ['圖片來源', 'Image origin'],
  '博主身份': ['博主身分', 'Blogger identity'], '博主昵称': ['博主暱稱', 'Blogger name'], '博主邮箱': ['博主信箱', 'Blogger email'], '博主口令': ['博主口令', 'Blogger passphrase'], '评论区标志': ['評論區標誌', 'Comment badge'],
  '站点 ID 格式无效': ['站點 ID 格式無效', 'Invalid site ID'], '站点 URL 格式无效': ['站點 URL 格式無效', 'Invalid site URL'], '站点名称不能超过 120 个字符': ['站點名稱不能超過 120 個字元', 'Site name must be 120 characters or fewer'],
  '请选择 1 至 32 个允许来源': ['請填寫 1 至 32 個允許來源', 'Enter 1 to 32 allowed origins'], '允许来源格式无效': ['允許來源格式無效', 'Invalid allowed origin'],
  '评论占位文案需为 1 至 80 个字符': ['評論佔位文案需為 1 至 80 個字元', 'Comment placeholder must be 1 to 80 characters'], '评论长度上限需为 1 至 10000': ['評論長度上限需為 1 至 10000', 'Comment limit must be 1 to 10000'], '无评论文案需为 1 至 240 个字符': ['無評論文案需為 1 至 240 個字元', 'Empty-state text must be 1 to 240 characters'],
  '清单 URL 无效；生产环境需使用 HTTPS': ['清單 URL 無效；生產環境需使用 HTTPS', 'Invalid manifest URL; HTTPS is required in production'], '启用表情包时必须填写清单 URL': ['啟用表情包時必須填寫清單 URL', 'A manifest URL is required when stickers are enabled'], '图片来源无效；请填写 HTTPS 来源，不含路径': ['圖片來源無效；請填寫 HTTPS 來源，不含路徑', 'Invalid image origin; enter an HTTPS origin without a path'],
  '评论区标志不能超过 16 个字符': ['評論區標誌不能超過 16 個字元', 'Comment badge must be 16 characters or fewer'], '评论区显示为': ['評論區顯示為', 'Shown in comments as'],
  '新站点尚未创建': ['新站點尚未建立', 'New site has not been created'],
  '保存修改': ['儲存修改', 'Save changes'],
  '密码为空': ['密碼為空', 'Password is empty'], '用户名或密码错误。': ['使用者名稱或密碼錯誤。', 'Incorrect username or password.'], '无法连接到 Ecoku，请检查网络后重试。': ['無法連線到 Ecoku，請檢查網路後重試。', 'Could not connect to Ecoku. Check the network and try again.'],
  '当前会话无权执行这项操作。': ['目前工作階段無權執行此操作。', 'This session is not allowed to perform this action.'], '评论或站点不存在，数据可能已经变化。': ['評論或站點不存在，資料可能已經變更。', 'The comment or site does not exist; the data may have changed.'], '数据已经被其他请求修改，请刷新后重试。': ['資料已被其他請求修改，請重新整理後重試。', 'The data was changed by another request. Refresh and try again.'], '请求内容超过服务端限制。': ['請求內容超過伺服器限制。', 'The request exceeds the server limit.'], '请求未能完成，请稍后重试。': ['請求未能完成，請稍後重試。', 'The request could not be completed. Try again later.'],
  '评论已替换为墓碑。': ['評論已替換為墓碑。', 'Comment replaced with a tombstone.'], '墓碑已彻底删除。': ['墓碑已徹底刪除。', 'Tombstone permanently deleted.'], '评论列表已刷新。': ['評論列表已重新整理。', 'Comments refreshed.'], '电子邮件通知已保存。': ['電子郵件通知已儲存。', 'Email notifications saved.'], 'Telegram 通知已保存。': ['Telegram 通知已儲存。', 'Telegram notifications saved.'], '验证失败，请重试。': ['驗證失敗，請重試。', 'Verification failed. Try again.'], '请完成验证后再登录。': ['請完成驗證後再登入。', 'Complete the verification before signing in.'],
} as const)) {
  textCatalog['zh-Hant'][source] = values[0]
  textCatalog.en[source] = values[1]
}

for (const [source, values] of Object.entries({
  '评论管理：': ['評論管理：', 'Comment management:'], '时间未知': ['時間未知', 'Unknown time'], '今天': ['今天', 'Today'], '昨天': ['昨天', 'Yesterday'], '评论排序：': ['評論排序：', 'Comment order:'], '最新在前': ['最新在前', 'Newest first'], '最早在前': ['最早在前', 'Oldest first'], '刷新评论': ['重新整理評論', 'Refresh comments'], '刷新评论（R）': ['重新整理評論（R）', 'Refresh comments (R)'], '评论状态': ['評論狀態', 'Comment status'], '评论列表没有加载出来': ['評論列表無法載入', 'Comments could not be loaded'], '当前实例还没有站点。': ['目前實例還沒有站點。', 'This instance has no sites yet.'], '私有邮箱': ['私有信箱', 'Private email'], '访客网站': ['訪客網站', 'Visitor website'], '回复 ': ['回覆 ', 'Reply to '], '父评论 ': ['父評論 ', 'Parent comment '], '该评论已删除': ['此評論已刪除', 'This comment was deleted'], '文章标题 ': ['文章標題 ', 'Article title '], '页面 key ': ['頁面 key ', 'Page key '], '查看原评论': ['查看原評論', 'View original comment'], '仍有回复，不能彻底删除': ['仍有回覆，不能徹底刪除', 'Replies remain; permanent deletion is unavailable'], '墓碑删除这条评论？': ['要將這條評論替換為墓碑嗎？', 'Replace this comment with a tombstone?'], '彻底删除这条墓碑？': ['要徹底刪除這條墓碑嗎？', 'Permanently delete this tombstone?'], '昵称、私有邮箱、网站和正文会被清除，公开页面改为显示「已删除」，下面的回复保留不变。此操作无法撤销。': ['暱稱、私有信箱、網站和正文會被清除，公開頁面改為顯示「已刪除」，下方回覆保持不變。此操作無法復原。', 'The name, private email, website and body will be removed. The public page will show “Deleted”; replies remain. This cannot be undone.'], '这条墓碑会从数据库中移除。此操作无法撤销。': ['這條墓碑會從資料庫移除。此操作無法復原。', 'This tombstone will be removed from the database. This cannot be undone.'], '处理中…': ['處理中…', 'Working…'], '上下条': ['上下條', 'Previous / next'], '原评论': ['原評論', 'Original comment'], '删除': ['刪除', 'Delete'], '评论列表分页': ['評論列表分頁', 'Comment list pagination'], 'SMTP 服务器无效': ['SMTP 伺服器無效', 'Invalid SMTP server'], '端口无效': ['連接埠無效', 'Invalid port'], '发件人地址格式错误': ['寄件人地址格式錯誤', 'Invalid sender address'], '邮箱格式错误': ['信箱格式錯誤', 'Invalid email format'], '密码为空': ['密碼為空', 'Password is empty'], 'Bot Token 为空': ['Bot Token 為空', 'Bot Token is empty'], '接收目标 ID 格式错误': ['接收目標 ID 格式錯誤', 'Invalid target ID format'], '开启': ['開啟', 'On'], '关闭': ['關閉', 'Off'], '未开启。': ['未開啟。', 'Disabled.'], '未开启，不会发送任何邮件，包括访客回复通知。': ['未開啟，不會傳送任何郵件，包括訪客回覆通知。', 'Disabled; no email, including visitor reply notifications, will be sent.'], '有新评论时由机器人发到下列用户、群组或频道。': ['有新評論時由機器人傳送到下列使用者、群組或頻道。', 'The bot sends new comments to the users, groups or channels below.'], '通过 @BotFather 获取。': ['透過 @BotFather 取得。', 'Get it from @BotFather.'], '按 Enter、逗号或换行添加多个邮箱': ['按 Enter、逗號或換行新增多個信箱', 'Press Enter, comma or newline to add multiple emails'], '按 Enter、逗号或换行添加；支持用户、群组、频道 ID，如 123456789 或 -1001234567890': ['按 Enter、逗號或換行新增；支援使用者、群組、頻道 ID，例如 123456789 或 -1001234567890', 'Press Enter, comma or newline to add users, groups or channel IDs, such as 123456789 or -1001234567890'], '关闭后需保存才会生效': ['關閉後需儲存才會生效', 'Save for the change to take effect'], '保存': ['儲存', 'Save'], '撤销修改': ['撤銷修改', 'Undo changes'], '保存修改': ['儲存修改', 'Save changes'], '保存中…': ['儲存中…', 'Saving…'], 'Sitekey 不能为空': ['Sitekey 不能為空', 'Sitekey is required'], 'Secret key 不能为空': ['Secret key 不能為空', 'Secret key is required'], '请输入有效的 HTTPS 实例地址': ['請輸入有效的 HTTPS 實例地址', 'Enter a valid HTTPS instance URL'], 'Site key 不能为空': ['Site key 不能為空', 'Site key is required'], '设置你的密码': ['設定你的密碼', 'Set your password'], '设置成功': ['設定成功', 'Setup complete'], '没有可用站点': ['沒有可用站點', 'No sites available'], '选择站点': ['選擇站點', 'Select a site'], '新站点': ['新站點', 'New site'], '评论区显示为': ['評論區顯示為', 'Shown in comments as'], '写下评论（仅支持纯文本）': ['寫下評論（僅支援純文字）', 'Write a plain-text comment'], '还没有评论': ['還沒有評論', 'No comments yet'],
} as const)) {
  textCatalog['zh-Hant'][source] = values[0]
  textCatalog.en[source] = values[1]
}

export function translateAdminText(source: string): string {
  const values = textCatalog[adminLocale.value]
  if (values[source]) return values[source]
  let match = source.match(/^(\d+) 条已删除评论$/)
  if (match) return adminLocale.value === 'en' ? `${match[1]} deleted comments` : adminLocale.value === 'zh-Hant' ? `${match[1]} 則已刪除評論` : source
  match = source.match(/^(\d+) 条评论$/)
  if (match) return adminLocale.value === 'en' ? `${match[1]} comments` : adminLocale.value === 'zh-Hant' ? `${match[1]} 則評論` : source
  match = source.match(/^查看原评论 #(.+)$/)
  if (match) return adminLocale.value === 'en' ? `View original comment #${match[1]}` : adminLocale.value === 'zh-Hant' ? `查看原評論 #${match[1]}` : source
  match = source.match(/^回复 (.+)$/)
  if (match) return adminLocale.value === 'en' ? `Reply to ${match[1]}` : adminLocale.value === 'zh-Hant' ? `回覆 ${match[1]}` : source
  match = source.match(/^有 (\d+) 处需要修改$/)
  if (match) return adminLocale.value === 'en' ? `${match[1]} items need attention` : adminLocale.value === 'zh-Hant' ? `有 ${match[1]} 處需要修改` : source
  return source
}

export function installAdminTranslations(root: HTMLElement = document.body): () => void {
  const originals = new WeakMap<Text, string>()
  const originalAttributes = new WeakMap<HTMLElement, Map<string, string>>()
  const skip = (node: Node) => {
    const parent = node.parentElement
    return !parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE'].includes(parent.tagName) || Boolean(parent.closest('.ecoku-comment-copy,.entry-copy,.entry-author'))
  }
  const scan = () => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      if (skip(node)) continue
      const original = originals.get(node) ?? node.textContent ?? ''
      originals.set(node, original)
      const translated = translateAdminText(original.trim())
      const rendered = original.replace(original.trim(), translated)
      if (node.textContent !== rendered) node.textContent = rendered
    }
    root.querySelectorAll<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
      const attrs = originalAttributes.get(element) ?? new Map<string, string>()
      for (const name of ['aria-label', 'title', 'placeholder']) {
        const value = element.getAttribute(name)
        if (!value) continue
        const original = attrs.get(name) ?? value
        attrs.set(name, original)
        const translated = translateAdminText(original)
        if (translated !== original) element.setAttribute(name, translated)
      }
      originalAttributes.set(element, attrs)
    })
  }
  const observer = new MutationObserver(scan)
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  refreshTranslations = scan
  const stop = () => observer.disconnect()
  scan()
  return stop
}

export function refreshAdminTranslations(): void { refreshTranslations() }
