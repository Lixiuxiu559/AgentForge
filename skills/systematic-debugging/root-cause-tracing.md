# 根因追踪

## 概述

Bug 往往在调用栈深处才暴露（git init 跑错了目录、文件建错了位置、数据库用错了路径）。你的直觉是在报错的地方修，但那是在治症状。

**核心原则**：沿调用链向上追溯，找到原始触发点，在源头修复。

## 适用场景

- 错误发生在执行深处（不是入口处）
- 堆栈跟踪显示很长的调用链
- 不清楚非法数据从哪里来
- 需要找出是哪个测试/代码触发了问题

## 追踪流程

### 1. 观察症状
```
Error: git init failed in /Users/jesse/project/packages/core
```

### 2. 找到直接原因
**什么代码直接导致了这个错误？**
```typescript
await execFileAsync('git', ['init'], { cwd: projectDir });
```

### 3. 追问：谁调用了它？
```typescript
WorktreeManager.createSessionWorktree(projectDir, sessionId)
  → 被 Session.initializeWorkspace() 调用
  → 被 Session.create() 调用
  → 被测试的 Project.create() 调用
```

### 4. 继续向上追
**传入了什么值？**
- `projectDir = ''`（空字符串！）
- 空字符串作为 `cwd` 解析为 `process.cwd()`
- 那是源码目录！

### 5. 找到原始触发点
**空字符串从哪来的？**
```typescript
const context = setupCoreTest(); // 返回 { tempDir: '' }
Project.create('name', context.tempDir); // 在 beforeEach 之前访问了！
```

## 加堆栈跟踪

当手动追踪不了时，加 instrumentation：

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  console.error('DEBUG git init:', {
    directory,
    cwd: process.cwd(),
    nodeEnv: process.env.NODE_ENV,
    stack,
  });

  await execFileAsync('git', ['init'], { cwd: directory });
}
```

**关键**：在测试中用 `console.error()`（不要用 logger——可能被抑制输出）。

**运行并捕获**：
```bash
npm test 2>&1 | grep 'DEBUG git init'
```

**分析堆栈**：
- 找测试文件名
- 找触发调用的行号
- 识别模式（同一个测试？同一个参数？）

## 定位是哪个测试造成了污染

如果某个现象在测试期间出现但不知道是哪个测试导致的，采用二分法：逐个运行测试文件，每跑完一个检查目标文件/状态是否出现，定位第一个产生污染的测试。

## 真实案例：空 projectDir

**症状**：`.git` 目录出现在 `packages/core/`（源码目录）

**追踪链**：
1. `git init` 在 `process.cwd()` 中运行 ← cwd 参数为空
2. WorktreeManager 被传入了空 projectDir
3. Session.create() 传了空字符串
4. 测试在 beforeEach 之前访问了 `context.tempDir`
5. setupCoreTest() 初始返回 `{ tempDir: '' }`

**根因**：顶层变量初始化时访问了空值

**修复**：把 tempDir 改成 getter，在 beforeEach 之前访问就抛错

**同时加了纵深防御**：
- 第 1 层：Project.create() 校验 directory
- 第 2 层：WorkspaceManager 校验不为空
- 第 3 层：NODE_ENV guard 拒绝在 tmpdir 之外 git init
- 第 4 层：git init 之前加堆栈日志

## 关键原则

**绝不要在报错的地方直接修。**向上追溯，找到原始触发点。

## 堆栈跟踪技巧

- **测试中**：用 `console.error()` 不要用 logger——logger 可能被抑制
- **操作之前**：在危险操作之前打日志，不是失败之后
- **包含上下文**：目录、cwd、环境变量、时间戳
- **捕获堆栈**：`new Error().stack` 显示完整调用链
