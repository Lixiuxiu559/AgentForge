# AntD 5 视觉基线

> 本文件的值取自项目实际配置，**不要凭记忆猜**。改视觉前先核对源文件：
> - `projects/frontend/kuavodatahubweb/apps/datahub/config/defaultSettings.js`
> - `projects/frontend/kuavodatahubweb/apps/datahub/src/features/antdConfig/AntdProvider.js`

**这是默认基线，不是硬约束。** token 与组件外形对齐项目事实（这样原型和最终实现长得一样，走查才有意义），但 CSS 类名清单、示例结构都可以按讨论调整。想换一种表达方式（比如单文件交付、不同的状态展示形式），和用户确认后照做即可。

## Token

| Token | 值 | 来源 |
|-------|-----|------|
| `colorPrimary` | `#1890ff` | defaultSettings.js |
| `fontSize` | `13.5px` | AntdProvider.js |
| `controlHeight` | `29px` | AntdProvider.js |
| `lineHeight` | `1.4` | AntdProvider.js |
| `paddingContentHorizontal` | `10px` | AntdProvider.js |
| `paddingContentVertical` | `4px` | AntdProvider.js |
| `borderRadius` | `6px`（AntD 5 默认） | — |

这些值已写进 `assets/prototype.css` 的 CSS 变量。**片段里直接用变量，不要写死颜色值**——将来项目换主色，原型跟着改一处即可。

## CSS 类名清单

`assets/prototype.css` 已提供以下类，覆盖项目常见页面形态。写片段时优先复用，不要自造。

### 页面骨架

| 类名 | 用途 |
|------|------|
| `.page-head` | 页面标题区，内含 `.crumb`（面包屑）、`h1`、`.desc`（说明） |
| `.proto-canvas` | 页面画布（脚本自动包裹，片段里不用写） |
| `.toolbar` | 操作栏，`.right` 推到右侧 |
| `.note` | 设计决策标注（蓝色左边框），**不属于产品 UI，是给评审者看的** |
| `.state-group` / `.state-block` | 多状态分组展示，每块配 `<h3>` 小标题 |

### 表单控件

| 类名 | 对应 AntD |
|------|----------|
| `.input` | `Input` / `InputNumber` / `DatePicker` |
| `.select` | `Select`（自带 ▾ 箭头） |
| `.textarea` | `Input.TextArea` |
| `.form-item` | `Form.Item`，内含 `label`、`.help`（helper text） |
| `.form-required` | 加在 label 上，显示红色 `*` |
| `.form-grid` | `ModalForm` 的 `grid` 布局（两列），`.full` 跨两列 |
| `.search-form` / `.search-row` / `.search-item` / `.search-actions` | ProTable 搜索区 |

### 按钮

| 类名 | 对应 |
|------|------|
| `.btn` | `Button` 默认 |
| `.btn-primary` | `Button type="primary"` |
| `.btn-text` | `Button type="link"`（蓝色文字按钮，用于操作列） |
| `.btn-danger-text` | 危险文字按钮（删除） |
| `.btn-sm` | 小尺寸 |
| `.btn[disabled]` | 禁用态 |

### 表格

| 类名 | 用途 |
|------|------|
| `.table-wrap` | 表格外框（圆角 + 边框） |
| `table.pro-table` | ProTable 主体 |
| `th.sortable` | 可排序列（带 ⇅ 图标） |
| `.cell-actions` | 操作列按钮容器 |
| `.num` | 数字列（`tabular-nums`，防抖动） |
| `.pagination` / `.page` / `.page.active` | 分页 |

### 标签与状态

| 类名 | 对应 |
|------|------|
| `.tag` | `Tag` 默认（蓝色） |
| `.tag.success` / `.tag.warning` / `.tag.error` / `.tag.default` | 其余色系 |
| `.status` + `.success`/`.processing`/`.warning`/`.error`/`.default` | `StatusView`（状态点 + 文字） |

### 容器

| 类名 | 对应 |
|------|------|
| `.modal-mask` / `.modal` / `.modal-head` / `.modal-body` / `.modal-foot` | `Modal` / `ModalForm`（宽 65%） |
| `.drawer-mask` / `.drawer` / `.drawer-head` / `.drawer-body` / `.drawer-foot` | `Drawer` / `DrawerForm`（宽 520px） |
| `.desc-table` | `Descriptions` |
| `.steps` / `.step` / `.step.done` / `.step.active` / `.dot` / `.line` | `Steps` |
| `.empty` | `Empty` 空态 |
| `.skeleton` | `Skeleton` 加载态 |

## 常见页面形态

### 列表页（ProTable）

```html
<div class="page-head">
  <div class="crumb">设备管理 / 末端手势</div>
  <h1>末端手势</h1>
</div>

<div class="toolbar">
  <button class="btn btn-primary">+ 新建手势</button>
  <div class="right">
    <button class="btn">导出</button>
  </div>
</div>

<div class="table-wrap">
  <table class="pro-table">
    <thead>
      <tr>
        <th class="sortable">名称</th>
        <th>手侧</th>
        <th>末端类型</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>抓取-握拳</td>
        <td>左手</td>
        <td><span class="tag">夸父-黑漫</span></td>
        <td><div class="cell-actions">
          <button class="btn-text btn-sm">编辑</button>
          <button class="btn-danger-text btn-sm">删除</button>
        </div></td>
      </tr>
    </tbody>
  </table>
</div>
<div class="pagination">
  <span>共 12 条</span>
  <span class="page active">1</span>
  <span class="page">2</span>
</div>
```

对应实现：`ProTable` + `useTable` + `useTableScroll`（见 `assets/docs/development/front/table.md`）。
参照页面：`projects/frontend/kuavodatahubweb/apps/datahub/src/pages/device/Gesture.jsx`。

### 带搜索区的列表页

搜索区放在表格上方，用 `.search-form` 包裹：

```html
<div class="search-form">
  <div class="search-row">
    <div class="search-item">
      <label>名称</label>
      <input class="input" placeholder="请输入" />
    </div>
    <div class="search-item">
      <label>手侧</label>
      <div class="select">全部</div>
    </div>
  </div>
  <div class="search-actions">
    <button class="btn">重置</button>
    <button class="btn btn-primary">查询</button>
  </div>
</div>
```

### 表单弹窗（ModalForm）

```html
<div class="modal-mask">
  <div class="modal">
    <div class="modal-head">新建手势 <span class="close">✕</span></div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-item">
          <label class="form-required">名称</label>
          <input class="input" placeholder="请输入" />
        </div>
        <div class="form-item">
          <label class="form-required">手侧</label>
          <div class="select">请选择</div>
        </div>
        <div class="form-item full">
          <label>描述</label>
          <textarea class="textarea"></textarea>
          <div class="help">最多 200 字</div>
        </div>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn">取消</button>
      <button class="btn btn-primary">确定</button>
    </div>
  </div>
</div>
```

对应实现：`ModalForm` + `grid` + `colProps={{ span: 12 }}`（见 `assets/docs/development/front/form.md`）。
参照页面：`projects/frontend/kuavodatahubweb/apps/datahub/src/pages/device/gesture/GestureFormModal.jsx`。

### 空态 / 加载态

```html
<div class="empty">
  <div class="icon">📭</div>
  <div>暂无手势，点击「新建手势」创建</div>
</div>

<!-- 加载态：用骨架屏，不要用转圈 -->
<div style="display:flex;flex-direction:column;gap:12px;padding:16px 0">
  <div class="skeleton" style="width:60%"></div>
  <div class="skeleton" style="width:80%"></div>
  <div class="skeleton" style="width:45%"></div>
</div>
```

## 图标

**不用 emoji 当图标**（`ui-ux-pro-max` 规则 `no-emoji-icons`）。项目用 `lucide-react`。

原型里需要图标时，用文字描述替代，例如 `<button class="btn">＋ 新建</button>`（全角加号不是图标）或直接写 `<span class="icon-slot">[search]</span>` 并在 `.note` 里说明用哪个 lucide 图标。不要引入图标库 CDN——原型要能离线打开。

## 不要做的事

- 不要改 `prototype.css` 里的 token 去"调好看"——颜色不是本次评审对象，偏离基线会让实现时对不上
- 不要引入 Tailwind CDN 或任何外部 CSS/JS
- 不要用 `!important` 覆盖基线样式
- 不要为了"更现代"改圆角、阴影、间距——项目视觉已经定了
