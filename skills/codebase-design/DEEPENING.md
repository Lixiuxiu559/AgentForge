# 深化（Deepening）

给定一个浅层模块集群的依赖，如何安全地深化它。假定 [SKILL.md](SKILL.md) 中的词汇——**module**、**interface**、**seam**、**adapter**。

## 依赖类别

评估一个深化候选时，分类它的依赖。类别决定深化后的模块如何跨 seam 测试。

### 1. In-process（进程内）

纯计算、内存状态、无 I/O。总是可深化——合并模块，直接通过新接口测试。不需要 adapter。

### 2. Local-substitutable（本地可替代）

有本地测试替身的依赖（Postgres 的 PGLite、内存文件系统）。替身存在即可深化。深化后的模块在测试套件中以运行中的替身测试。seam 是内部的；模块外部接口没有 port。

### 3. Remote but owned（远程但自有）（Ports & Adapters）

跨越网络边界的你自己的服务（微服务、内部 API）。在 seam 上定义一个 **port**（接口）。深层模块拥有逻辑；传输作为 **adapter** 注入。测试用内存 adapter。生产用 HTTP/gRPC/队列 adapter。

推荐话术：*"在 seam 上定义一个 port，为生产实现 HTTP adapter、为测试实现内存 adapter，这样逻辑坐落在一个深层模块里，即使它跨网络部署。"*

### 4. True external（真正外部）（Mock）

你无法控制的第三方服务（Stripe、Twilio 等）。深化后的模块把外部依赖作为注入的 port 接收；测试提供 mock adapter。

## Seam 纪律

- **一个 adapter 意味着假想的 seam。两个 adapter 意味着真实的。** 除非至少两个 adapter 有正当理由（通常是生产 + 测试），不要引入 port。单 adapter 的 seam 只是间接层。
- **内部 seam 与外部 seam。** 一个深层模块可以有内部 seam（对其实现私有，被它自己的测试使用）以及接口处的外部 seam。不要因为测试用它们就把内部 seam 暴露到接口上。

## 测试策略：替换，不要叠加

- 一旦深化后的模块接口处有了测试，浅层模块上的旧单元测试就成了废料——删除它们。
- 在深化后模块的接口处写新测试。**接口就是测试面**。
- 测试通过接口断言可观察的结果，不是内部状态。
- 测试应该在内部重构中存活——它们描述行为，不是实现。如果一个测试必须在实现改变时改变，它在测试越过接口的地方。
