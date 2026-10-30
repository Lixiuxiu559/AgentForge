# 新鲜度、收尾复核与合并前检查

新鲜度表示“当前配置覆盖的来源与文档仍匹配已完成复核的快照”，不表示事实永久正确。以本地内容指纹和文件集合检测变化，不靠文档年龄，也不因无关提交自动使全库过期。

## 项目配置

沿用已有模块的 sources 和 docs；sources 应覆盖源码、配置、接口定义、工程脚本、相关测试与知识依据，不能只包含实现代码。目录前缀包含当前 Git 可见的子文件；工作区还包含未被 Git 忽略的未跟踪文件。外部网站和未映射资料的变化不在自动检测范围。

在现有配置中增加：

```json
{
  "version": 1,
  "modules": [
    {
      "id": "orders",
      "sources": ["src/orders", "docs/contracts/orders.md", "tests/orders.test.mjs"],
      "docs": ["docs/wiki/orders.md"]
    }
  ],
  "freshness": {
    "records": "docs/wiki/reviews.json"
  }
}
```

records 保存每模块最近一次复核声明及来源、文档的路径、SHA-256 和文件模式，Git 历史保留既往记录。配置本身也参与指纹校验，修改映射或策略不能继续沿用原记录。记录文件自身排除在指纹和变更覆盖之外，避免自指；它不能覆盖配置或知识页面，也不能写入 Git 元数据目录；新记录不能存放在 Git 忽略路径，否则无法进入提交候选。

需要排除确实不属于知识范围的未映射变化时，可显式配置 `freshness.ignore`，每项为 `{"path":"某文件或目录","reason":"不影响知识的具体理由"}`。这只处理未映射变化，不跳过已映射来源的指纹。新增路径仍需检查是否应纳入模块，不能用全仓排除掩盖映射缺口。

## 读取前

从技能安装目录定位脚本，再显式给出目标根和项目配置：

```bash
node /absolute/skill-directory/scripts/wiki.mjs freshness --root /absolute/project --config docs/wiki/wiki.config.json --module orders
```

跨模块使用可省略 module。结果按模块报告：

| state | 使用方式 |
|---|---|
| fresh | 指纹仍匹配该复核声明；在记录范围内继续阅读，关键结论仍保留来源 |
| stale | 来源、文档或配置已变化；核对差异后再将相关知识作为当前依据 |
| unknown | 缺少配置、来源覆盖或有效记录；交付已知部分并说明未知，不假装已核验 |
| blocked | 上次明确记录了未解决冲突；先核对该冲突，不能只刷新记录解除 |

检查只读。stale 或 unknown 不妨碍先理解历史背景，但不能据此作出依赖当前行为的确定结论。没有配置时不擅自初始化全库；可以直接核实本次问题所需的来源并说明覆盖缺口。

## 开发收尾

先读取实际 diff、对应版本的代码/配置与知识，判断是需要更新、无需更新还是未解决冲突。写入知识仍遵守本次用户授权。完成复核后显式保存声明：

```bash
node /absolute/skill-directory/scripts/wiki.mjs review --root /absolute/project --config docs/wiki/wiki.config.json --module orders --decision no-change --reason "仅调整内部实现，接口与有效规则未变，已核对对应知识" --reviewer "实际执行者" --evidence '["src/orders/service.ts","docs/wiki/orders.md"]'
```

decision 可为 updated、no-change、blocked。原因、实际执行者和证据必须明确；证据路径必须属于该模块所记录的来源或文档。updated 用于本次知识已更新；no-change 也必须经过核对；blocked 只保留确实影响必要技术结论或操作且项目策略要求阻断的问题，不因缺少产品批准、资料不同或未执行测试而自动阻断。命令不会自动判断哪种结论正确，不会改写业务文档，仅保存复核记录。

声明是人工或 Agent 的责任记录。内容指纹可以证明与声明时一致，不能证明复核者真正理解了材料；禁止将“命令成功”写成“语义已经自动验证”，禁止为过门机械批量签认。

复核期间文件发生变化时重新核对。记录生成后若修改来源、文档或配置，记录会再次失效；未涉及的核验日期不要刷新。记录只保存在目标项目，不写插件安装目录。

### 暂存区顺序

1. 完成知识复核与必要修改，将待提交的来源、Wiki 和配置暂存。
2. 使用相同 review 命令并加 `--scope staged`，按索引快照生成记录。命令只将记录写入工作区。
3. 再暂存记录文件，执行 `gate --scope staged`。

不能用工作区的新记录或新文档替代索引中的旧内容。普通 worktree 复核适合开发收尾；提交前仍按实际候选范围检查。

## 合并前检查

```bash
node /absolute/skill-directory/scripts/wiki.mjs gate --root /absolute/project --config docs/wiki/wiki.config.json --scope staged
node /absolute/skill-directory/scripts/wiki.mjs gate --root /absolute/project --config docs/wiki/wiki.config.json --scope range --base origin/main --head HEAD
```

gate 要求配置模块均有 fresh 记录，并核对本次变化的模块覆盖。未映射且没有明确排除理由的变化不能通过。range 比较 merge-base 到 head，配置、记录及指纹均取自 head 的 Git 树；staged 均取自索引。worktree 检查工作区相对索引及未跟踪文件，使用工作区快照；同一路径同时有暂存改动和未暂存改动时，索引内容不是工作区快照能代表的提交候选，gate 在 `divergent` 中列出这些路径并报告 partial，此时按 staged 检查或先对齐两层。即使工作区已补新记录，也不能让旧索引或旧提交通过。

gate 是同步状态检查，不能替代 `check` 的目录、模板和链接校验；CI 应对同一个候选同时运行两者。未知或映射不足报告 partial，已过期或 blocked 报告 issues，参数、记录损坏或执行失败报告 error；退出码继续使用 0、1、2。

AgentForge 自用入口为 `npm run wiki:freshness`、`wiki:review`、`wiki:check`、`wiki:gate`。PR 工作流检出明确 head，运行结构检查和 range gate。要在服务端禁止绕过失败检查，仓库管理员还需将对应检查设为分支保护的必需项；工作流文件本身不修改远端保护策略。
