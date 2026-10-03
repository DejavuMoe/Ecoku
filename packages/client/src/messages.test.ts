import { describe, expect, it } from 'vitest'
import { getMessages, SERVER_CHALLENGE_REQUIRED } from './messages'

describe('comment locale catalog', () => {
  it('provides distinct Simplified Chinese, Traditional Chinese and English UI copy', () => {
    expect(getMessages('zh-CN').submitComment).toBe('发布')
    expect(getMessages('zh-Hant').submitComment).toBe('發布')
    expect(getMessages('en').submitComment).toBe('Post')
    expect(getMessages('en').contentTooLong(3)).toBe('Comment content must be 3 characters or fewer.')
  })

  it('keeps every locale complete without Simplified Chinese leaking into Traditional Chinese', () => {
    const keys = Object.keys(getMessages('zh-CN')).sort()
    expect(Object.keys(getMessages('zh-Hant')).sort()).toEqual(keys)
    expect(Object.keys(getMessages('en')).sort()).toEqual(keys)
    expect(getMessages('zh-Hant').reply).toBe('回覆')
    expect(getMessages('zh-Hant').submitReply).toBe('回覆')
  })

  it('matches the server default empty message in Simplified Chinese', () => {
    const zh = getMessages('zh-CN')
    expect(`${zh.emptyTitle}\n${zh.emptyBody}`).toBe('还没有评论\n成为第一个留下评论的人。')
    expect(SERVER_CHALLENGE_REQUIRED).toBe(zh.challengeRequired)
  })
})
