# 后端技术方案: {功能名称}

## 1. 执行摘要
简要概述方案和关键技术决策（3-5 句话）。若有架构约束（"必须复用 X，否则 Y"），在此点明。

## 2. 架构概览
- 文字描述服务/模块划分、数据流向、关键交互
- 必要时附 Mermaid/PlantUML 序列图 或 调用链

## 3. 服务/模块定义
| 服务/模块 | 职责 | 关键依赖 | 部署单元 |
|-----------|------|----------|----------|
| ... | ... | ... | ... |

## 4. API 契约
### 接口清单
| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/v1/xxx | ... | JWT |

### 关键接口示例
```json
POST /api/v1/xxx
Request:  { ... }
Response: { ... }  // 200
Error:    { ... }  // 400/401/500
```

## 5. 数据模型
```sql
-- 核心表结构（含主键、外键、关键索引）
CREATE TABLE xxx (
    id          BIGINT PRIMARY KEY,
    ...
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_xxx_on_yyy ON xxx(yyy);
```

## 6. 技术栈说明
| 层面 | 选择 | 理由 | 备选方案 |
|------|------|------|----------|
| 语言/框架 | ... | ... | ... |
| 数据库 | ... | ... | ... |
| 缓存 | ... | ... | ... |
| 消息队列 | ... | ... | ... |

每个选择必须说明理由并至少比较一个备选方案。

## 7. 关键考量
- **可扩展性**：如何应对 10 倍负载？
- **安全性**：主要威胁及缓解措施
- **可观测性**：如何监控健康状态和排查问题？
- **部署与 CI/CD**：部署方式简述
- **实现思路/防坑**：有认知门槛的技术决策（如特殊 SQL 的 NULL 处理、并发注意点）在此说明约束和思路——**不贴完整可运行的方法体/XML/类**

## 8. 量化预估
| 指标 | 预估值 | 推算依据 |
|------|--------|----------|
| 日均请求量 | ... | ... |
| 峰值 QPS | ... | ... |
| 存储容量(年) | ... | ... |
| 95分位延迟 | ... | ... |

## 9. 风险与缓解
| 风险 | 影响 | 缓解措施 |
|------|------|----------|

## 10. 数据库变更（如涉及）
```sql
-- 完整迁移 SQL（建表/改字段/加索引），coder 不得自行编造 DDL
-- 标注：先于代码执行，dev 环境先行
ALTER TABLE kuavo_xxx ADD COLUMN yyy ...;
```
无数据库变更时写"本次无数据库变更"。

## 11. 防误改清单
明确列出本次**绝对不动**的文件/字段/接口，防止实施时过度改动：
| 不动项 | 原因 |
|--------|------|
| `XxxService.foo()` | 与本次无关，改动有回归风险 |

## 12. 验收标准
| 验收项 | 验证方式 |
|--------|----------|
| ... | `mvn test` 全绿 / kuavotest {模块} 场景通过 / 指定接口返回符合契约 |

## 13. 适用规范
本次设计涉及的编码规范（来自 `.claude/rules/`）+ 新建文件起手模板：

| 规则文件 | 涉及内容 | 说明 |
|---------|---------|------|
| controller.md | 新建 XxxController | @RestController + extends BladeController + @AllArgsConstructor |
| service.md | 新建 XxxServiceImpl | extends BaseServiceImpl + @Resource 注入 + @Transactional |
| entity.md | 新建 Xxx.java | @TableName("kuavo_xxx") + extends BaseEntity + @TableId 雪花 ID |
| javadoc.md | 所有新建类 | Entity/Controller/ServiceImpl 必须加 @wiki |
| exception.md | 错误处理 | 统一抛 ServiceException，不吞异常 |
| sql-coding-rules.md | 查询/建表 | #{} 参数化，禁止 ${}，批量操作用 saveBatch |
| security.md | 参数校验/凭证 | @Validated 校验，禁止硬编码密钥 |

起手模板（涉及新建文件时标注）：Controller → `assets/templates/backend/controller-template.java`；Entity → `assets/templates/backend/entity-template.java`（含 @wiki + @table）；ServiceImpl → `assets/templates/backend/service-template.java`
