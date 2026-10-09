import { afterEach, expect, it, vi } from 'vitest'
import { commentCountNoun, installAdminTranslations, refreshAdminTranslations, setAdminLocale, translateAdminText } from './i18n.svelte'

afterEach(() => { setAdminLocale('zh-CN'); vi.unstubAllGlobals(); vi.restoreAllMocks() })

// Drive scans explicitly so a regression cannot starve the test event loop.
function install(root: HTMLElement) {
  vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} })
  return installAdminTranslations(root)
}

it('does not rewrite translated text on repeated observer scans', () => {
  const root = document.createElement('div')
  root.textContent = '评论'
  const writes = vi.spyOn(root.firstChild!, 'textContent', 'set')
  setAdminLocale('en')
  const stop = install(root)
  try {
    expect(root.textContent).toBe('Comments')
    refreshAdminTranslations()
    refreshAdminTranslations()
    expect(writes).toHaveBeenCalledTimes(1)
  } finally { stop() }
})

it('keeps text that the renderer rewrites in place, in the default locale', () => {
  const root = document.createElement('p')
  root.append('8 ', document.createTextNode('条评论'))
  const noun = root.lastChild as Text
  const stop = install(root)
  try {
    noun.nodeValue = '条已删除评论'
    refreshAdminTranslations()
    expect(root.textContent).toBe('8 条已删除评论')
  } finally { stop() }
})

it('translates the new source after an in-place rewrite and after a locale change', () => {
  const root = document.createElement('p')
  root.append(document.createTextNode('保存'))
  const node = root.firstChild as Text
  setAdminLocale('en')
  const stop = install(root)
  try {
    expect(root.textContent).toBe('Save')
    node.nodeValue = '保存中…'
    refreshAdminTranslations()
    expect(root.textContent).toBe('Saving…')
    setAdminLocale('zh-Hant')
    refreshAdminTranslations()
    expect(root.textContent).toBe('儲存中…')
  } finally { stop() }
})

it('never translates visitor content marked translate="no"', () => {
  const root = document.createElement('div')
  root.innerHTML = '<span class="quote-text" translate="no">删除</span><span class="quote-ref">回复 <span translate="no">回复 楼上</span></span><button title="删除">删除</button>'
  setAdminLocale('en')
  const stop = install(root)
  try {
    expect(root.querySelector('.quote-text')?.textContent).toBe('删除')
    expect(root.querySelector('.quote-ref')?.textContent).toBe('Reply to 回复 楼上')
    expect(root.querySelector('button')?.textContent).toBe('Delete')
    expect(root.querySelector('button')?.getAttribute('title')).toBe('Delete')
  } finally { stop() }
})

it('translates item list labels, notes and announcements with their numbers', () => {
  setAdminLocale('en')
  expect(translateAdminText('允许来源，第 2 项')).toBe('Allowed origins, item 2')
  expect(translateAdminText('删除通知收件人第 3 项')).toBe('Remove item 3 from Notification recipients')
  expect(translateAdminText('与第 1 项重复，保存时合并')).toBe('Same as item 1; merged on save')
  expect(translateAdminText('已添加 3 项；最多 32 项，其余 2 项未添加')).toBe('Added 3; the limit is 32, so 2 were left out')
  expect(translateAdminText('已添加 1 项')).toBe('Added 1 item')
  expect(translateAdminText('已改为 https://blog.example.com')).toBe('Changed to https://blog.example.com')
  setAdminLocale('zh-Hant')
  expect(translateAdminText('接收目标 ID，第 1 项')).toBe('接收目標 ID，第 1 項')
  expect(translateAdminText('已达上限 32 项')).toBe('已達上限 32 項')
  expect(translateAdminText('已删除第 4 项')).toBe('已刪除第 4 項')
  setAdminLocale('zh-CN')
  expect(translateAdminText('允许来源，第 2 项')).toBe('允许来源，第 2 项')
})

it('names the account being set up in the first-login copy', () => {
  setAdminLocale('en')
  expect(translateAdminText('更换临时密码后，即可进入管理后台。用户名可以保留为 owner。')).toBe('Replace the temporary password to enter the admin console. You may keep the username owner.')
  expect(translateAdminText('请输入用户名，或保留 admin。')).toBe('Enter a username, or keep admin.')
  setAdminLocale('zh-Hant')
  expect(translateAdminText('更换临时密码后，即可进入管理后台。用户名可以保留为 admin。')).toBe('更換臨時密碼後，即可進入管理後台。使用者名稱可以保留為 admin。')
  expect(translateAdminText('请输入用户名，或保留 owner。')).toBe('請輸入使用者名稱，或保留 owner。')
})

it('keeps code samples apart from the translated help around them', () => {
  const root = document.createElement('p')
  root.innerHTML = '对应接入代码中的 <code>data-site-id</code>，创建后不能修改。'
  setAdminLocale('en')
  const stop = install(root)
  try {
    expect(root.textContent).toBe('Matches data-site-id in the embed code; it cannot be changed.')
  } finally { stop() }
})

it('marks the document language and chooses the count noun per locale', () => {
  setAdminLocale('en')
  expect(document.documentElement.lang).toBe('en')
  expect(commentCountNoun(1, false)).toBe('comment')
  expect(commentCountNoun(3, true)).toBe('deleted comments')
  setAdminLocale('zh-Hant')
  expect(document.documentElement.lang).toBe('zh-Hant')
  expect(commentCountNoun(3, false)).toBe('則評論')
  setAdminLocale(undefined)
  expect(commentCountNoun(3, true)).toBe('条已删除评论')
})
