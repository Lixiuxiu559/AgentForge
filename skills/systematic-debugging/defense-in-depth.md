# 纵深防御

## 概述

修了一个由非法数据导致的 bug 后，只在一个地方加校验感觉够了。但那一个检查点可以被不同的代码路径、重构、或者 mock 绕过。

**核心原则**：在数据经过的**每一层**都加校验。让 bug 在结构上不可能发生。

## 为什么需要多层

单层校验："我们修了 bug"
多层防御："我们让 bug 不可能再出现"

不同层捕获不同情况：
- 入口校验捕获大多数 bug
- 业务逻辑校验捕获边缘情况
- 环境保护防止特定上下文中的危险操作
- 调试日志在其他层都失效时帮助排查

## 四层防御

### 第 1 层：入口校验
**目的**：在 API 边界拒绝明显非法的输入

```typescript
function createProject(name: string, workingDirectory: string) {
  if (!workingDirectory || workingDirectory.trim() === '') {
    throw new Error('workingDirectory 不能为空');
  }
  if (!existsSync(workingDirectory)) {
    throw new Error(`workingDirectory 不存在: ${workingDirectory}`);
  }
  if (!statSync(workingDirectory).isDirectory()) {
    throw new Error(`workingDirectory 不是目录: ${workingDirectory}`);
  }
  // ... 继续
}
```

### 第 2 层：业务逻辑校验
**目的**：确保数据对这个操作来说是有意义的

```typescript
function initializeWorkspace(projectDir: string, sessionId: string) {
  if (!projectDir) {
    throw new Error('projectDir 是工作空间初始化必需的');
  }
  // ... 继续
}
```

### 第 3 层：环境保护
**目的**：防止在特定上下文中执行危险操作

```typescript
async function gitInit(directory: string) {
  // 测试环境下，拒绝在临时目录之外执行 git init
  if (process.env.NODE_ENV === 'test') {
    const normalized = normalize(resolve(directory));
    const tmpDir = normalize(resolve(tmpdir()));

    if (!normalized.startsWith(tmpDir)) {
      throw new Error(
        `测试环境拒绝在临时目录之外执行 git init: ${directory}`
      );
    }
  }
  // ... 继续
}
```

### 第 4 层：调试 instrumentation
**目的**：捕获上下文用于事后排查

```typescript
async function gitInit(directory: string) {
  const stack = new Error().stack;
  logger.debug('即将执行 git init', {
    directory,
    cwd: process.cwd(),
    stack,
  });
  // ... 继续
}
```

## 如何应用

发现一个 bug 后：

1. **追踪数据流** — 非法值从哪里来？在哪里被使用？
2. **标记所有检查点** — 列出数据经过的每一个点
3. **在每一层加校验** — 入口、业务、环境、调试
4. **测试每一层** — 尝试绕过第 1 层，验证第 2 层能否捕获

## 案例

Bug：空的 `projectDir` 导致 `git init` 在源码目录执行

**数据流**：
1. 测试 setup → 空字符串
2. `Project.create(name, '')`
3. `WorkspaceManager.createWorkspace('')`
4. `git init` 在 `process.cwd()` 中运行

**加了四层**：
- 第 1 层：`Project.create()` 校验非空/存在/可写
- 第 2 层：`WorkspaceManager` 校验 projectDir 非空
- 第 3 层：`WorktreeManager` 在测试环境拒绝在 tmpdir 之外 git init
- 第 4 层：git init 之前加堆栈日志

**结果**：1847 个测试全部通过，bug 不可能再出现

## 关键洞察

四层全都是必要的。在测试中，每一层捕获了其他层漏掉的 bug：
- 不同的代码路径绕过了入口校验
- Mock 绕过了业务逻辑检查
- 不同平台的边缘情况需要环境保护
- 调试日志识别了结构性的误用

**不要只停在一个校验点。**在每一层都加检查。
