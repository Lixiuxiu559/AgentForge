# Go / go-mutesting 适配

## 项目识别

检查：

- `go.mod`
- `go.work`
- `*_test.go`
- 项目已有的 mutation testing 脚本或 CI 配置

## 执行

首选项目已经安装或明确配置的 `go-mutesting`：

```bash
go-mutesting ./path/to/package/...
```

实际参数以当前工具版本和项目配置为准。若项目使用 gremlins 等其他 Go 突变工具，优先复用现有配置，不要另起工具链。

## 范围

优先从用户指定文件或最近改动文件推导 package/function 范围。若工具只能按 package 运行，报告实际扩大后的范围。

## 结果

重点关注：

- survived：测试没有捕获突变
- killed：测试捕获突变
- timeout、build failure、test failure：结果不完整

## 注意

- 不自动下载或安装 Go 工具。
- 不默认运行 `./...` 全仓库突变测试。
- 先确认普通 `go test` 能正常运行，再执行突变测试。
