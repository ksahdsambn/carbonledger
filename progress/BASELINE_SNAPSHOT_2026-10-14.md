# 基线快照(阶段一,B-1 至 B-8)

- **执行日期**:2026-10-14
- **环境**:Windows 10 x64(Git Bash),Node v24.12.0,npm 11.6.2,Python 3.12.13(argus-venv)
- **形态**:mock 模式(未使用任何真实密钥;未查看 .env 内容)

| 序号 | 命令 | 结果 | 关键记录 |
|---|---|---|---|
| B-1 | `npm install` | ✅ 成功 | 0 漏洞;仅 59 包 funding 提示 |
| B-2 | `npm run build` | ✅ 成功 | 前端 32 模块,dist JS 168.46 kB(gzip 53.88 kB);后端语法检查通过,输出 BUILD OK |
| B-3 | `npm test` | ✅ 34 通过 / 0 失败 | backend 套件 33 个 node:test 用例 + upload 脚本套件按 1 个聚合用例计,合计 34。README 声称 34 与运行时一致;任务书"源码统计 33"为 backend/test 内 `test(` 计数,两口径并存→登记文档缺陷(D-03) |
| B-4 | `npm run smoke` | ❌ 失败 | SMOKE FAIL:首行日志断言分支执行;根因是 mktemp 返回 MSYS 路径,原生 Windows Python 无法 open→登记 D-01 |
| B-5 | `npm run scan-secrets` | ✅ 通过 | 0 命中,退出码 0 |
| B-6 | `bash scripts/count_lines.sh` | ❌ NFR-504 FAIL | 口径 A=4335,**口径 B=7110(>7000 上限,已超支 110 行)**,口径 C=8905(<10000 硬顶)。任务书所述基线 6,976 与实测不符→登记 D-02 |
| B-7 | `node backend/src/server.js` + 健康检查 | ✅(带备注) | 8080 端口 `/healthz` 返回 `{"status":"ok"}`;Git Bash 下 `kill $PID` 无法终止 node(Windows 信号语义),需 `taskkill //F`,干净退出项待 D-01 修复后经冒烟复验 |
| B-8 | `node eval/run.js` | ✅ 成功 | mock 模式 11 组指标全部收集,总评 PASS;产物 `eval/results/run/evaluation.{json,md}` |

## 基线失败项处置

- B-4 → 缺陷 D-01(冒烟脚本 Windows 可移植性)。
- B-6 → 缺陷 D-02(行数预算口径 B 已超支 110 行,状态为基线即 FAIL)。

## 后续"不回归"参照

- 用例数:34(33 + 1),全部通过。
- 行数:A=4335,B=7110,C=8905。
- 评估:11 组指标全 PASS,总评 PASS。
- 构建:BUILD OK;密钥扫描:0 命中。
