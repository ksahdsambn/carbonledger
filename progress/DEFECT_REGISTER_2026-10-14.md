# 缺陷登记册（全面审查与修复,2026-10-14 起）

> 依据 `AUDIT_FIX_PROMPT.md` 第 3.1 节建立。每条缺陷闭环后更新状态。
> 编号 D-01 起顺序递增;来源为附录 A 疑点编号或"阶段二新发现"。

---

## D-01

- **编号**:D-01
- **来源**:阶段一新发现(基线 B-4 失败)
- **严重度**:P1(验证基础设施在 README/任务书声明的支持环境 Git Bash 下不可用)
- **位置**:`scripts/smoke.sh:9,37-42`
- **描述**:`LOG_FILE=$(mktemp)` 在 Git Bash 下返回 MSYS 虚拟路径(如 `/tmp/tmp.zU5LxVRQlA`),而验证日志用的 `python -c "open(r'$LOG_FILE'…)"` 调用的是原生 Windows Python,无法解析 MSYS 路径,`open()` 抛 `FileNotFoundError`,脚本以 "SMOKE FAIL: first log line is not a structured server_started event" 失败。失败消息本身也与断言内容不符(断言只要求 `server_started` 在事件列表中,不要求首行)。触发条件:在 Windows Git Bash 下执行 `npm run smoke`。
- **核实证据**:2026-10-14 执行 `npm run smoke` 失败;单独复现 `LOG_FILE=$(mktemp); python -c "open(r'$LOG_FILE')"` 抛 `FileNotFoundError: '/tmp/tmp.zU5LxVRQlA'`,而日志文件确实存在且包含合法 `server_started` 事件(server_started 为第二行,首行为 factor_library_loaded,断言本身应通过)。
- **修复方案**:让 Python 从 stdin 读取日志内容(`cat "$LOG_FILE" | python -c "…sys.stdin…"`,cat 是 MSYS 工具能解析 /tmp 路径),避免把 MSYS 路径传给原生 Python;同时把失败消息改为与断言一致的表述。
- **验证方式**:A-3(`npm run smoke` 输出 SMOKE OK)。
- **状态**:待修复

---

## D-02

- **编号**:D-02
- **来源**:阶段一新发现(基线 B-6 失败)
- **严重度**:P1(NFR-504 预算违约,验收 A-5 直接不通过)
- **位置**:全仓库(口径 B 统计范围:backend/src + frontend/src + eval + scripts/**/*.js,含 backend/test)
- **描述**:口径 B 实测 7,110 行,超上限 7,000 共 110 行;任务书声称基线 6,976,实测已超,说明近期提交(T-044…T-050 批次)在无对冲情况下净增了行数。当前状态 `count_lines.sh` 判定 FAIL,验收项 A-5 无法通过。
- **核实证据**:2026-10-14 执行 `bash scripts/count_lines.sh`,输出 `B. … 7110`、`NFR-504: FAIL (figure B 7110 <= 7000 …)`。
- **修复方案**:本次审查修复全程以"新增行数 ≤ 回收行数 - 110"为约束;回收候选按 6.3.4:未被服务端使用的队列抽象(R-17)、报告服务空循环与死分支(R-31)、追踪服务死代码、其他阶段二确认的死代码;严禁修改统计脚本口径。
- **验证方式**:A-5(`count_lines.sh` 判定 PASS,口径 B ≤ 7,000)。
- **状态**:待修复

---

## D-03

- **编号**:D-03
- **来源**:阶段一新发现(B-3 与文档对账)
- **严重度**:P3(文档口径不清)
- **位置**:`README.md`(测试数量表述处)
- **描述**:测试数量存在两个口径:backend/test 内 33 个 `test(` 用例;`npm test` 运行时合计 34(33 + upload 脚本套件按 1 个聚合用例计入,见 `scripts/test.sh:31-46`)。README 若只写单一数字而不说明构成,读者无法对账。
- **核实证据**:B-3 运行输出 `[suite] backend: pass=33 fail=0`、`[suite] upload: pass=1 fail=0`、`TOTAL passed=34`;grep 统计 backend/test/*.test.js 共 33 处 `test(`。
- **修复方案**:README 的测试数量表述改为"34(33 个 node:test 用例 + 1 个 upload 聚合脚本套件)"式的明确口径。
- **验证方式**:V-13(文档对账)。
- **状态**:待修复
