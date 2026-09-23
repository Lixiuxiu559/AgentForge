# Python / radon + coverage.py 适配

## 项目识别

检查：

- `pyproject.toml`
- `setup.py`
- `requirements.txt`
- `coverage.ini` 或 `.coveragerc`

## 复杂度

优先复用项目已有的 radon 或 xenon 配置：

```bash
radon cc <目标目录或文件> -j
```

也可以使用 xenon 做阈值检查，但它通常提供模块/函数的复杂度告警，不一定提供可直接与覆盖率 join 的结构化结果。

## 覆盖率

优先使用项目已有 coverage.py 报告：

```bash
coverage json
```

如果报告只有文件级或行级数据，不能直接声称得到了函数级 CRAP。应降级为：

- `complexity-only`
- 或 `file-level-risk`

## 注意

- 不自动安装 radon、xenon 或 coverage。
- Python 装饰器、动态调用和生成代码可能影响函数映射。
- 对无法稳定匹配的函数，报告映射限制，不猜测覆盖率。
