import { describe, expect, it } from 'vitest'
import { getMessages } from './messages'

describe('comment locale catalog', () => {
  it('provides distinct Simplified Chinese, Traditional Chinese and English UI copy', () => {
    expect(getMessages('zh-CN').submitComment).toBe('发布')
    expect(getMessages('zh-Hant').submitComment).toBe('發布')
    expect(getMessages('en').submitComment).toBe('Post')
    expect(getMessages('en').contentTooLong(3)).toBe('Comment content must be 3 characters or fewer.')
  })
})
