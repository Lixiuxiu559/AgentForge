# Go / gocyclo + go cover 适配

## 项目识别

检查：

- `go.mod`
- `go.work`
- `*_test.go`
- 项目已有的复杂度分析脚本

## 复杂度

优先复用 gocyclo、gocognit 或项目现有工具：

```bash
gocyclo -over 10 ./...
```

目标范围明确时，优先传入具体 package 或源文件，不要默认扫描整个 workspace。

## 覆盖率

```bash
go test ./path/to/package/... -coverprofile=coverage.out
go tool cover -func=coverage.out
```

如果复杂度结果能按 package、receiver、function 与覆盖率稳定匹配，可以计算近似 CRAP；否则降级为 `complexity-only` 或 `file-level-risk`。

## 注意

- `go tool cover -func` 的覆盖率主要是函数/文件行覆盖汇总，需确认粒度后再计算。
- 不自动下载 gocyclo、gocognit 或其他工具。
- 先确认普通 `go test` 能正常运行。
