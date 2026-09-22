# 基于条件的等待

## 概述

不稳定的测试（flaky test）往往用随意的延迟来猜时序。这导致竞态条件：测试在快机器上能过，但在高负载或 CI 环境中就挂了。

**核心原则**：等待你真正关心的**条件**，而不是猜一个时长。

## 适用场景

- 测试中有随意延迟（`setTimeout`、`sleep`、`time.sleep()`）
- 测试不稳定（有时过有时挂）
- 并行跑时测试超时
- 等待异步操作完成

**不要用的时候**：
- 测试的就是时间行为（debounce、throttle 间隔）
- 如果用固定超时，必须写注释说明为什么

## 核心模式

```typescript
// ❌ 之前：猜时序
await new Promise(r => setTimeout(r, 50));
const result = getResult();
expect(result).toBeDefined();

// ✅ 之后：等待条件
await waitFor(() => getResult() !== undefined);
const result = getResult();
expect(result).toBeDefined();
```

## 常用模式

| 场景 | 模式 |
|------|------|
| 等待事件 | `waitFor(() => events.find(e => e.type === 'DONE'))` |
| 等待状态 | `waitFor(() => machine.state === 'ready')` |
| 等待数量 | `waitFor(() => items.length >= 5)` |
| 等待文件 | `waitFor(() => fs.existsSync(path))` |
| 复合条件 | `waitFor(() => obj.ready && obj.value > 10)` |

## 实现

通用轮询函数：

```typescript
async function waitFor<T>(
  condition: () => T | undefined | null | false,
  description: string,
  timeoutMs = 5000
): Promise<T> {
  const startTime = Date.now();

  while (true) {
    const result = condition();
    if (result) return result;

    if (Date.now() - startTime > timeoutMs) {
      throw new Error(`等待 "${description}" 超时，已等 ${timeoutMs}ms`);
    }

    await new Promise(r => setTimeout(r, 10)); // 每 10ms 轮询一次
  }
}
```

参见本目录下的 `condition-based-waiting.ts.example`，里面有完整的领域专用 helper（`waitForEvent`、`waitForEventCount`、`waitForEventMatch`）。

## 常见错误

- **轮询太快**：`setTimeout(check, 1)` — 浪费 CPU。应该每 10ms 轮询一次
- **没有超时**：条件永远不满足就无限循环。必须带超时和清晰的错误信息
- **数据过期**：在循环外缓存状态。应该在循环内每次调 getter 拿最新数据

## 什么时候固定超时是对的

```typescript
// Tool 每 100ms tick 一次 — 需要等 2 个 tick 来验证部分输出
await waitForEvent(manager, 'TOOL_STARTED'); // 第一步：等待条件
await new Promise(r => setTimeout(r, 200));   // 然后：等待基于时间的行为
// 200ms = 100ms 间隔 × 2 个 tick — 有文档记录且理由充分
```

**要求**：
1. 首先等待触发条件
2. 基于已知的时间参数（不是猜的）
3. 注释说明为什么

## 实际效果

来自调试记录（2025-10-03）：
- 修复了 3 个文件中共 15 个不稳定的测试
- 通过率：60% → 100%
- 执行时间：快 40%
- 零竞态条件
