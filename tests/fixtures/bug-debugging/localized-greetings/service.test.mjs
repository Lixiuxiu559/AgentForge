import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createGreetingService } from './service.mjs'

test('中文问候', () => {
  assert.equal(createGreetingService()('Lin', 'zh'), '你好, Lin')
})

test('英文问候', () => {
  assert.equal(createGreetingService()('Lin', 'en'), 'Hello, Lin')
})

test('拒绝不支持的语言', () => {
  assert.throws(() => createGreetingService()('Lin', 'fr'), /不支持的语言/)
})
