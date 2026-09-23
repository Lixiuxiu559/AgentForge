# Python / mutmut 适配

## 项目识别

检查：

- `pyproject.toml`
- `setup.py`
- `requirements.txt`
- `mutmut` 配置或脚本

## 执行

优先使用项目已有配置。常见命令：

```bash
mutmut run
```

如果项目已经配置了目标模块或 `paths_to_mutate`，不要覆盖它。若需要限制范围，先读取项目配置和 mutmut 版本支持的参数。

## 查看结果

```bash
mutmut results
mutmut show <突变体编号>
```

重点关注：

- survived：测试没有捕获变化
- no tests / not covered：没有有效测试覆盖
- timeout / error：执行结果不完整，不得当成通过

## 注意

- 不自动安装 mutmut。
- 不要默认对整个 Python 仓库运行。
- 解释器、虚拟环境和测试命令以项目现有配置为准。
