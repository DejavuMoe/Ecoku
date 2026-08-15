import type { CommentStatus } from './types'

export const messages = {
  loginFailed: '用户名或密码错误。',
  loginUnavailable: '管理员登录暂时不可用，请稍后重试。',
  networkError: '无法连接到 Ecoku，请检查网络后重试。',
  sessionExpired: '管理会话已过期，请重新登录。',
  invalidRequest: '请求参数不符合要求，请检查后重试。',
  forbidden: '当前会话无权执行这项操作。',
  notFound: '评论或站点不存在，数据可能已经变化。',
  conflict: '数据已经被其他请求修改，请刷新后重试。',
  tooLarge: '请求内容超过服务端限制。',
  rateLimited: '操作过于频繁，请稍后重试。',
  serverError: '服务端暂时无法完成操作，数据没有被修改。',
  genericError: '请求未能完成，请稍后重试。',
  tombstoned: '评论已替换为墓碑。',
  permanentlyDeleted: '墓碑已彻底删除。',
  refreshed: '评论列表已刷新。',
  siteCreated: '站点已创建。',
  siteUpdated: '站点设置已保存。',
  emailSaved: '电子邮件通知已保存。',
  telegramSaved: 'Telegram 通知已保存。',
  turnstileSaved: '验证设置已保存。',
  loginChallengeFailed: '验证失败，请重试。',
  loginChallengeRequired: '请完成验证后再登录。',
  noSites: '当前实例还没有站点。',
} as const

export const statusOrder: CommentStatus[] = ['published', 'deleted']

export const statusMeta: Record<CommentStatus, { label: string; className: string }> = {
  published: { label: '已发布', className: 'badge-published' },
  deleted: { label: '已删除', className: 'badge-deleted' },
}
