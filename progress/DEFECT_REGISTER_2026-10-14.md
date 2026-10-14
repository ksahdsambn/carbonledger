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
- **状态**:已修复(A-3 冒烟通过)

---

## D-02

- **编号**:D-02
- **来源**:阶段一新发现(基线 B-6 失败)
- **严重度**:P1(NFR-504 预算违约,验收 A-5 直接不通过)
- **位置**:全仓库(口径 B 统计范围:backend/src + frontend/src + eval + scripts/**/*.js,含 backend/test)
- **描述**:口径 B 实测 7,110 行,超上限 7,000 共 110 行;任务书声称基线 6,976,实测已超,说明近期提交(T-044…T-050 批次)在无对冲情况下净增了行数。当前状态 `count_lines.sh` 判定 FAIL,验收项 A-5 无法通过。
- **核实证据**:2026-10-14 执行 `bash scripts/count_lines.sh`,输出 `B. … 7110`、`NFR-504: FAIL (figure B 7110 <= 7000 …)`。
- **修复方案**:本次审查修复全程以"新增行数 ≤ 回收行数 - 110"为约束;回收候选按 6.3.4:未被服务端使用的队列抽象(R-17)、报告服务空循环与死分支(R-31)、追踪服务死代码、其他阶段二确认的死代码;严禁修改统计脚本口径。
- **验证方式**:A-5(`count_lines.sh`;口径 B 判定见下方最终账)。
- **状态**:已按 2.6.2 条款处理(书面记录超支 + 口径 C 达标)

### D-02 最终账(2026-10-14 阶段四)

| 项 | 行数 |
|---|---|
| 审查前实测口径 B(基线) | 7,110 |
| 回收:queue/index.js + queue.test.js(D-22 死代码移除) | −124 |
| 回收:报告空循环、traceability 死分支、P3 死函数、taskRuns 死导出、calculation 死分支、BASE_UNITS 死导出(D-36 等) | −15 |
| 新增:强制回归电池 `backend/test/regression.test.js`(V-01/02/03/04/05/06/07/12 必须自动化,任务书 7.2 明文要求) | +330 |
| 新增:安全与正确性修复(属主中间件、CORS/限流重写、运行串行化、候选接口、上传限制与错误映射、追踪脱敏、嵌入防线、补丁校验、pdf-lib 计数、存储包含性、配置校验、任务字段校验、CSV 中和、报告锚点/Share 修正、脚本密钥守卫) | +305 |
| **审查后实测口径 B** | **7,606**(目标 7,000,超支 606) |
| 第二轮回收:死导出 FACTOR_LIBRARY_FILE / STORE_COLLECTIONS / currentIdToken + 不可达分类规则(D-64) | −8 |
| 第二轮新增:D-60/61/62/63/65/66 修复实现 | +12 |
| 第二轮新增:回归断言(D-60/D-62/D-63/D-65/D-66) | +63 |
| 第二轮新增:D-67 修复(空产出保护) | +11 |
| 第二轮新增:D-67 回归断言 | +20 |
| **第二轮复核后实测口径 B(最终)** | **7,705**(目标 7,000,超支 705) |
| 口径 C(含 Python 工具链) | 9,500(硬上限 10,000,达标) |

**超支理由与接受结论(按 2.6.2)**:
1. 审查前基线即为 7,110,已超目标 110 行——超支并非本次修复单独造成。
2. 本次净增 496 行中,330 行是任务书第七章明文要求"必须固化为自动化回归测试"的验收场景;其余 166 行为 P0/P1 安全与正确性修复的最小实现。二者均不可删减。
3. 若强行压到 ≤7,000,只能删除强制回归测试或回退安全修复——违反铁律 3 与红线 3,不可接受。
4. 已按 2.6.2 全文回收可确认无引用的死代码(139 行);未发现更多可回收项(全库导出引用扫描:仅 BASE_UNITS 零引用,已移除)。
5. 口径 C 9,401 ≤ 10,000,满足 2.6.2 的硬性要求。
6. **严禁修改统计脚本口径**(红线 4)——`count_lines.sh` 一字未改,超支如实呈现。

**结论**:A-5 依 2.6.2 逃逸条款判定为"已记录并接受",`count_lines.sh` 本身仍打印 FAIL,该事实如实记录,不作粉饰。

**第二轮追加(2026-10-14)**:第二轮独立复核新增 7 项修复与 6 组回归断言,并回收 8 行死代码,口径 B 由 7,606 变为 **7,705**(超支 705),口径 C 9,500 仍 < 10,000。超支性质与第一轮相同(强制回归测试 + 安全/正确性修复),接受结论不变。全库死导出扫描(按导出名出现次数统计)在本轮仅命中 4 处,已全部回收,未发现更多可回收项。

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
- **状态**:已修复(V-13 README 对账;测试数按实测 44 写明构成)

---

## D-04(R-01)

- **编号**:D-04
- **来源**:R-01
- **严重度**:P0
- **位置**:`backend/src/services/pipeline.js:85`(修复前行号);`backend/src/services/fileService.js:117-125`
- **描述**:多单元(多页 PDF)文档处理时,`setDocumentStatus(...,'extracting')` 在单元循环内逐单元调用;转换表 `extracting` 无自环,第二单元处理时第二次设置抛 ERR_ENUM_INVALID,withStatus 将整文档置 failed,全部页面记录丢失。演示集与测试恰为单页文档故未暴露。
- **核实证据**:代码推演 + 阶段四 V-01 将以 GD-09(4 页)实测复现;转换表 `extracting: ['matching','failed','needs_review']` 不含 extracting。
- **修复方案**:按任务书 6.3.3,将 extracting 状态设置移出单元循环(进入循环前设置一次);多次重跑幂等(completed 跳过)、失败态可从 queued 重试、复核重算不触发该路径,均不受影响。
- **验证方式**:V-01 + 新增多页文档回归测试(固化于 backend/test/pipeline.e2e.test.js)。
- **状态**:已修复(V-01 + 回归测试)

---

## D-05(R-02)

- **编号**:D-05
- **来源**:R-02
- **严重度**:P0
- **位置**:`backend/src/services/scenarios.js:15-18`;`backend/src/services/calculation.js:36-89`
- **描述**:情景重算 rerunWithFactor 复用会持久化的 computeEmission,以 `calc_<record_id>` 同主键覆盖正式账本核算记录与核算审计记录;此后导出路由与 generateReportForTask(懒生成/复核后重建)读取落库核算时把情景值当基线值。
- **核实证据**:代码推演(calculation.js:79 `store.put('calculations', calcId, calc)`);V-04 将实测:跑基线→跑情景→比对存储核算与报告。
- **修复方案**:按任务书 6.3.2,computeEmission 增加 `persist = true` 可选参,情景路径传 persist:false(只算不落库、不写审计);正式路径(流水线、仪表盘重算)行为不变。被情景污染过的历史数据不迁移(演示环境可重建),在修复报告写明。
- **验证方式**:V-04 + 新增情景隔离回归测试。
- **状态**:已修复(V-04 + 回归测试)

---

## D-06(R-03)

- **编号**:D-06
- **来源**:R-03
- **严重度**:P0
- **位置**:`backend/src/server.js` 任务级全部路由(139-304,除 161-171 文件下载已有属主判断)
- **描述**:任务详情、文档列表、上传、重复决议、状态修改、触发运行、仪表盘、报告读取、报告导出、复核全部动作、审计查看、AI 追踪查询均不校验任务属主;有属主任务对任何匿名/错误身份请求开放,违背 README 隐私承诺(NFR-301)。
- **核实证据**:server.js 逐路由核对(仅 /file 有 `task.owner !== req.uid` 判断);V-02 矩阵将实测三种身份 × 全部任务级接口。
- **修复方案**:按任务书 6.3.1 条件强制口径:新增可替换的令牌校验器注入点与 `requireTaskOwner` 中间件——任务存在属主时,req.uid 不属主(无 token/错 token)一律 403 ERR_FORBIDDEN;无属主任务保持开放(脚本/离线/演示语义)。复核四动作同时获得"记录属于该任务"(D-14)与属主双重校验。令牌校验组件以依赖注入方式实现,单元测试注入模拟身份;本地无凭证"校验失败降级匿名"保留,其与条件强制的组合语义(有属主任务对匿名拒绝)纳入测试。
- **验证方式**:V-02 + 新增越权矩阵回归测试;一键演示(progress/evidence 公开任务标识)保持可用为直接检验。
- **状态**:已修复(V-02 + 回归测试)
- **关联决策(D-45)**:errors.js 新增 `ERR_FORBIDDEN`(http 403)与 `ERR_RATE_LIMITED`(http 429,收编 server 手写响应,消息文本保持不变)。契约新增(非变更),无既有消费方受影响。

---

## D-07(R-04)

- **编号**:D-07
- **来源**:R-04
- **严重度**:P0
- **位置**:`backend/src/services/fileService.js:76`;`backend/src/storage/index.js:12-25`
- **描述**:上传文件名未规范化即拼入存储键(`${taskId}/${id}_${filename}`);本地适配器 put/get 仅 join 无包含性校验;`../../evil.pdf` 等穿越片段可逃逸存储根目录写文件(反斜杠变体在 Windows 生效;绝对路径片段同理)。
- **核实证据**:代码推演 + V-03 将以穿越/反斜杠/绝对路径文件名上传并对比存储根目录树。
- **修复方案**:双层防御:(1) fileService 存储键构造前对 filename 规范化——取 basename、剔除路径分隔符与空字节、字符白名单 [A-Za-z0-9._-() ]、超长截断;(2) LocalFileStorage put/get 做 resolve 后包含性校验,越界即抛 ERR_STORAGE_ACCESS。
- **验证方式**:V-03 + 新增路径遍历回归测试(目录树前后对比断言)。
- **状态**:已修复(V-03 + 回归测试)

---

## D-08(R-05)

- **编号**:D-08
- **来源**:R-05
- **严重度**:P1
- **位置**:`backend/src/ai/client.js:61-68,105-131,210,248-250`
- **描述**:追踪记录 input_summary 为 parts 的 JSON 前 300 字符,抽取阶段 parts 含 inline_data base64 文档片段;失败追踪的 error 字段含上游响应体(dispatch `HTTP <status>: <body>`;embedTexts 的 AppError details 直接携带 body)。叠加 R-03 等于向任何人公开原始文档片段;D-06 收口后仍对属主可见,属最小化原则违背。
- **核实证据**:代码推演(summarize(parts) 未过滤 inline_data;err.message 含 body.slice)。
- **修复方案**:summarize 对 parts 数组先脱敏——inline_data 项替换为 `[<mime> omitted]`;dispatch 错误消息仅保留 `HTTP <status>` 与分类,不再内嵌响应体(embedTexts 同)。
- **验证方式**:新增脱敏回归测试(构造含 inline_data 的调用,断言追踪记录不含 base64 特征与响应体)。
- **状态**:已修复(回归测试:追踪无 base64/上游体)

---

## D-09(R-06)

- **编号**:D-09
- **来源**:R-06
- **严重度**:P1
- **位置**:`frontend/src/pages.jsx:156-168(P3),215-223(P4)`;对照 `backend/src/server.js:139-143`
- **描述**:P3/P4 从任务详情接口读 `task.records` 字段,该接口只返回 `{...task, documents}`,两页永远为空;匹配查看器与审计入口因此不可达;pages.jsx:156-159 的 loadRecords(实现正确)是从未被调用的死代码。
- **核实证据**:代码对照(接口无 records 字段);V-10 界面走查直接暴露。
- **修复方案**:P3/P4 改用仪表盘接口(`api.dashboard` 返回 records,后端契约不变);删除死函数 loadRecords(D-36 一并回收)。
- **验证方式**:V-10(P3 非空、P4 可进入并完成手动指定因子)。
- **状态**:已修复(V-10 P3/P4)

---

## D-10(R-07)

- **编号**:D-10
- **来源**:R-07
- **严重度**:P1
- **位置**:`backend/src/services/reportService.js:94`
- **描述**:范围分解锚点 `anchor(s.value * 1000, ...)`:s.value 为千克聚合值,anchor 内部执行 t3(kg)=kg/1000,传入前再乘 1000 导致锚点吨值=千克数值(放大一千倍);逐条记录锚点与总量锚点均正确,仅该处错。
- **核实证据**:代码推演 + V-05 将实测锚点值与仪表盘聚合值逐项比对(不相等即暴露)。
- **修复方案**:改为 `anchor(s.value, 'aggregation', taskId, s.key, ...)`(千克入参,anchor 内统一换算),与仪表盘 t3 舍入一致。
- **验证方式**:V-05 + 新增锚点数值回归测试。
- **状态**:已修复(V-05 + 回归测试)

---

## D-11(R-08)

- **编号**:D-11
- **来源**:R-08
- **严重度**:P1
- **位置**:`backend/src/services/exportService.js:8-11`
- **描述**:csvEscape 仅处理含 `"`、`,`、换行的值;以 =、+、-、@、制表符、回车开头的单元格原样输出,品名等用户/模型可控文本可在表格软件中执行公式(CSV 公式注入)。
- **核实证据**:代码推演 + V-06 将以 `=SUM(1+1)*cmd|'` 等恶意品名导出并检查。
- **修复方案**:csvEscape 对以 [=+\-@\t\r] 开头的值前置单引号 `'` 中和(OASIS 通用做法),其余转义规则不变;两处 CSV 导出同享。
- **验证方式**:V-06 + 新增公式注入回归测试。
- **状态**:已修复(V-06 + 回归测试)

---

## D-12(R-09)

- **编号**:D-12
- **来源**:R-09
- **严重度**:P1
- **位置**:`backend/src/server.js:25,145`
- **描述**:上传中间件 `multer({ storage: multer.memoryStorage() })` 无 limits(单文件大小、请求数);10MB 校验发生在 ingestFile( multer 已全量缓冲进内存后),构成内存耗尽攻击面(单请求 50×任意大文件全量驻留)。
- **核实证据**:配置核对 + V-11 将实测超限行为。
- **修复方案**:multer 增加 `limits: { fileSize: 10MB, files: 50 }`;错误中间件将 MulterError LIMIT_FILE_SIZE 映射为 ERR_FILE_TOO_LARGE(413)、LIMIT_UNEXPECTED_FILE 映射为 ERR_ENUM_INVALID(422,附文件数上限提示)。**配套决策**:verify_upload.js 的 11MB 用例当前断言服务层逐文件错误(results[0].code);中间件生效后该请求在进入服务前即被拒(HTTP 413 错误封套)。这是任务书 V-11 明确要求的更强行为(超限不完整进入内存),同步把该用例断言更新为 413+ERR_FILE_TOO_LARGE+消息含 10 MB——断言是加强(更早拒绝)而非弱化,登记为测试契约适配。既有其余断言不动。
- **验证方式**:V-11 + upload 套件回归。
- **状态**:已修复(V-11;verify_upload 断言同步加强)

---

## D-13(R-10)

- **编号**:D-13
- **来源**:R-10
- **严重度**:P1
- **位置**:`backend/src/server.js:85-95(CORS),98-113(限流)`
- **描述**:(1) 限流键取 x-forwarded-for 首段,客户端可伪造头每次变换即重置桶;(2) rateBuckets Map 无上限增长(内存泄漏/DoS 面);(3) `new URL(origin)` 对畸形 Origin 抛 TypeError→500(V-09 "畸形来源头不导致服务器错误"不满足);(4) 见 D-37 白名单过宽。
- **核实证据**:代码核对 + V-09 将实测(伪造头、超阈值频率、畸形头)。
- **修复方案**:(1) 默认以 `req.socket.remoteAddress` 为键,仅当显式设置 `TRUST_PROXY=1` 时才采信 x-forwarded-for(生产经代理部署时设置);(2) 桶数量上限(如 10,000),超限清理最旧桶;(3) URL 解析包 try/catch,畸形 Origin 视为非白名单直接 next();(4) 限流阈值 RATE_LIMIT_PER_MIN 解析非法值时回退默认 60 而非 NaN。
- **验证方式**:V-09 + 新增限流/畸形头回归测试。
- **状态**:已修复(V-09 + 回归测试)

---

## D-14(R-11)

- **编号**:D-14
- **来源**:R-11
- **严重度**:P1
- **位置**:`backend/src/services/reviewQueue.js:78-108`
- **描述**:assignFactorManually、excludeRecord 未校验 record.task_id === taskId(跨任务改写他任务记录与匹配);editRecordFields 补丁值无类型/范围/长度校验(与 R-12 交汇);路由层属主校验由 D-06 收口。
- **核实证据**:代码核对(assignFactorManually:81-82 仅判存在性);V-02/V-07 实测。
- **修复方案**:三个动作函数统一补 record.task_id 校验(不匹配抛 AppError ERR_TASK_NOT_FOUND,与 editRecordFields 现口径一致);editRecordFields 补丁校验:quantity 有限数>0、amount 有限数≥0、unit/transport_mode/currency 闭集、字符串字段长度上限 500、activity_date 字符串≤40。
- **验证方式**:V-02(跨任务标识)、V-07(非法补丁)+ 新增跨任务与非法补丁回归测试。
- **状态**:已修复(V-02/V-07 + 回归测试)

---

## D-15(R-12)

- **编号**:D-15
- **来源**:R-12
- **严重度**:P1
- **位置**:`backend/src/services/pipelineModelCalls.js:52-65`;`normalization.js:47-51`;`calculation.js:9-29`;复核编辑路径(并入 D-14)
- **描述**:数量全链路缺有限数值校验:validateExtraction 对 quantity 的 `NaN<=0` 为 false、Infinity 为合法 number 均放行;amount 仅查 `<0`(类型不限,字符串/Infinity 放行);gross_weight_kg/distance_km 完全无校验;convertUnit 乘法与 activityBasis 对非有限值无防御;一旦进入即污染聚合(求和 NaN)、排序(topEmitters NaN 比较失效)与报告。
- **核实证据**:代码推演 + V-07 将经复核编辑与 mock 抽取两路注入非数字/无穷/零/负数实测。
- **修复方案**:validateExtraction 全数值字段(quantity/amount/gross_weight_kg/distance_km/passengers 若有)统一 `Number.isFinite && 类型 number` 校验,quantity 同时 >0;convertUnit 入参加 Number.isFinite 守卫(非有限返回 null 不换算);activityBasis 对 basis.value 非有限抛错(既有 unbridgeable 路径接管为复核)。复核编辑路径校验由 D-14 承担。
- **验证方式**:V-07 + 新增数值防线回归测试(mock 抽取注入 + 复核编辑注入)。
- **状态**:已修复(V-07 + 回归测试)

---

## D-16(R-13a)

- **编号**:D-16
- **来源**:R-13
- **严重度**:P1
- **位置**:`backend/src/config.js:85-89`;`backend/src/services/pipeline.js:209`
- **描述**:配置数值项无校验:AI_RETRY_COUNT=abc → attempts=NaN,callModel 循环不执行直接 throw null;BATCH_SIZE/阈值/超时 NaN 或负数直接生效;PIPELINE_CONCURRENCY=abc → Math.max(1,NaN)=NaN → worker 数组长度 NaN→空→流水线静默空跑(文档全不动、无报错)。
- **核实证据**:代码推演;阶段四将以非法环境变量实测复跑。
- **修复方案**:loadConfig 对 int/float 项做"解析失败或越界回退默认值并 log.warn"处理(范围:AI_RETRY_COUNT≥0、AI_TIMEOUT_SECONDS>0、BATCH_SIZE>0、阈值∈[0,1]);pipeline 并发数额外 `Number.isFinite` 守卫非法回退 4。
- **验证方式**:新增配置校验回归测试(config.test.js 扩展);A-2 全量回归。
- **状态**:已修复(回归测试:非法配置回退默认)

---

## D-17(R-13b)

- **编号**:D-17
- **来源**:R-13(检查点 5.5.1)
- **严重度**:P1
- **位置**:`backend/src/ai/client.js:90-142`
- **描述**:callModel 重试循环不区分错误类别:dispatch 已标注 kind:'fatal'(4xx 非 429),但循环仍对致命错误(鉴权失败、请求非法)无谓重试到底,拉高时延与成本;重试间无退避。
- **核实证据**:代码核对(catch 分支未读 err.kind)。
- **修复方案**:catch 中 kind==='fatal' 直接终止循环按现有映射抛错(不再消耗重试);重试间加入指数退避+抖动(200ms×2^n ± 抖动,仅 mock 外生效,测试用极小值不受影响——退避仅真实适配器路径,mock 不经过)。
- **验证方式**:aiRetry.test.js 扩展(fatal 不重试断言)。
- **状态**:已修复(aiRetry 回归:fatal 不重试)

---

## D-18(R-18)

- **编号**:D-18
- **来源**:R-18
- **严重度**:P2
- **位置**:`backend/src/ai/client.js:192-225(embedTexts)`
- **描述**:嵌入批量调用无超时无重试;响应 embeddings 数量少于请求数时静默接受,recall.buildSemanticIndex 按 `vectors[i]` 错位写入,坏索引静默存在。
- **核实证据**:V-12 将以模拟短响应实测。
- **修复方案**:批量调用加 AbortController 超时(复用 AI_TIMEOUT_SECONDS);响应向量数与 chunk 长度严格校验,不足即抛 ERR_MODEL_CALL_FAILED(可重试一次);embedText 同样补超时。
- **验证方式**:V-12 + 新增短响应回归测试(注入 mock fetch)。
- **状态**:已修复(V-12 + 回归测试)

---

## D-19(R-14)

- **编号**:D-19
- **来源**:R-14
- **严重度**:P2
- **位置**:`backend/src/services/reportService.js:270`
- **描述**:引用扫描对情景锚点 `scenarios.has(ref) || String(ref).includes('_S-')`——后半句使任何含 `_S-` 片段的 ref_id 免存在性校验,削弱"无效引用一票否决"治理。
- **核实证据**:代码核对;构造含伪情景锚点的报告扫描即可证(测试将固化)。
- **修复方案**:删除 `|| includes('_S-')` 旁路,情景锚点一律走 scenarios.has 存在性校验(存储侧 id 即 `${taskId}_${scenario_id}`,合法锚点本就命中)。
- **验证方式**:新增伪情景锚点回归测试(合法锚点通过、伪锚点计 invalid)。
- **状态**:已修复(回归测试:伪情景锚点计 invalid)

---

## D-20(R-15)

- **编号**:D-20
- **来源**:R-15
- **严重度**:P2
- **位置**:`backend/src/store/index.js:37-52`
- **描述**:集合文件 JSON 解析失败被 catch 后静默重置为空 Map——存量数据视同不存在,无任何告警,且下一次 put 会以空集覆写全文件(数据丢失固化);#persist 整文件 writeFileSync 非原子(写一半崩溃即损坏)。
- **核实证据**:代码核对;损坏一个集合文件重启服务即可证(阶段四手工验证留证)。
- **修复方案**:解析失败时 log.error(带文件名)再降级空集(告警不静默);#persist 改为"写临时文件+renameSync 原子替换"。并发整文件重写最后赢为单进程语义,保持现状(生产为 Firestore)。
- **验证方式**:新增存储健壮性测试(坏 JSON 文件构造 + 原子写断言);手工损坏文件重启留证。
- **状态**:已修复(回归:坏 JSON 告警 + 原子写)

---

## D-21(R-16)

- **编号**:D-21
- **来源**:R-16
- **严重度**:P2
- **位置**:`backend/src/services/pipeline.js:137`;`backend/src/services/uncertainty.js:123-127`
- **描述**:召回候选置信度被硬编码 0.5(< 阈值 0.65),assessRecord 的 allBelowThreshold 恒真 → 全部含候选记录被标 no_high_confidence_factor 并开复核项,该信号零区分度;levelDistribution 对缺失等级产生 `undefined: NaN` 键(仪表盘渲染 NaN 行)。
- **核实证据**:代码核对;修复后以演示任务实测标记比例与分布键集合。
- **修复方案**:候选传真实召回得分(pipeline 传 `match_confidence: c.score`,assessRecord 已支持 match_confidence 优先);levelDistribution 缺省并入 medium(`r.uncertainty_level ?? 'medium'`,与报告侧口径一致)。修复后必须实测:演示任务复核队列仍非空(V-10 P8 依赖)、评估指标不回归(A-6)。
- **验证方式**:A-6 + V-10 + 新增分布键纯度测试(low/medium/high 三键)。
- **状态**:已修复(回归:分布三键;V-10 P5)

---

## D-22(R-17)

- **编号**:D-22
- **来源**:R-17;任务书 5.4.3
- **严重度**:P2
- **位置**:`backend/src/queue/index.js`(全文);`backend/test/queue.test.js`
- **描述**:队列抽象未被服务端任何代码引用(全库仅自身测试引用),且存在运行期 setImmediate 派发不移出 pending 导致 stop/start 重复消费的双派发缺陷;服务端实际内联执行流水线。
- **核实证据**:全库引用搜索(grep queue/index 与 createQueue/InProcessQueue):仅 backend/test/queue.test.js。
- **修复方案**:**移除**(任务书 5.4.3 授权二选一决策):删除 backend/src/queue/index.js 与 backend/test/queue.test.js,回收行数对冲 D-02 超支;README 中"async task-queue abstraction"表述同步修订(D-46)。不选"修复"理由:无调用方的修复是纯支出,而行数预算已超支 110 行。
- **验证方式**:A-2(用例总数因新增回归测试保持 ≥ 基线)+ A-5(口径 B 回到 ≤7000)+ 全量构建/测试。
- **状态**:已修复(A-2/A-5)
- **红线对照说明**:红线 3 禁止"为让测试通过而删除/弱化断言";本项为死代码清理(该测试当前本就通过),且任务书 5.4.3 明确授权移除选项;总用例数不降低(见验证方式)。

---

## D-24(R-19)

- **编号**:D-24
- **来源**:R-19
- **严重度**:P2
- **位置**:`backend/src/services/normalization.js:101-110`
- **描述**:币种识别表 CNY 行(含 `¥`)先于 JPY 行,`¥jp` 标记永不可达,裸 `¥` 恒判 CNY;歧义符号无上下文消歧。
- **核实证据**:正则顺序推演;将针对全部币种符号写用例测试。
- **修复方案**:重排识别顺序——显式代码/无歧义符号优先(USD/$/dollars、EUR/€、JPY/円/yen/¥jp、HKD/港币、CNY/人民币/RMB),裸 `¥` 最后且仅判 CNY(中文语境默认,与现有行为兼容)。
- **验证方式**:normalization.test.js 扩展全部符号用例。
- **状态**:已修复(回归:全币种符号用例)

---

## D-25(R-20)

- **编号**:D-25
- **来源**:R-20
- **严重度**:P2
- **位置**:`backend/src/services/fileService.js:58-63`
- **描述**:XLSX 校验仅为压缩包内 `xl/workbook` 子串存在性,无解压放大防线。
- **核实证据**:全库检索确认不存在任何本地解压路径(XLSX 以 inline_data 原样交模型,本地不解压);压缩体受 10MB 上限约束;放大发生在模型侧而非本服务。
- **修复方案**:**有意保留 + 文档化**——本服务不解压 XLSX,压缩炸弹的本地资源消耗面不存在;10MB 上限(中间件强制,D-12)约束输入规模。在 README 安全说明与修复报告中记录该评估。
- **验证方式**:登记留证(本条即处置结论);V-11 覆盖超限行为。
- **状态**:有意保留(附评估理由)

---

## D-26(R-21)

- **编号**:D-26
- **来源**:R-21
- **严重度**:P2
- **位置**:`backend/src/services/fileService.js:33-37,54-57`
- **描述**:PDF 页数用原始字节正则 `/\/Type\s*\/Page[^s]/g` 统计:对压缩对象流(ObjStm)PDF 欠计(页面字典不出现在明文),0 页误判损坏、N>0 页静默少拆单元,影响页单元拆分与引用追踪页上限。
- **核实证据**:golden 9 份 PDF 实测 0 偏差(工具生成未压缩);缺陷为对真实世界压缩 PDF 的健壮性缺口,非当前数据错误。
- **修复方案**:ingestFile 的 PDF 分支改用 pdf-lib(既有依赖)加载取 getPageCount:天然解析对象流、附带真损坏检测(load 抛错→ERR_FILE_CORRUPT);正则版 countPdfPages 导出随之无引用(仅本文件使用),删除回收行数。
- **验证方式**:新增多页 PDF 页数回归测试(含 GD-09 四页)+ 既有 upload 套件回归。
- **状态**:已修复(回归:多页计数 + 损坏 PDF 拒绝)

---

## D-27(R-22)

- **编号**:D-27
- **来源**:R-22
- **严重度**:P2
- **位置**:`backend/src/services/exportService.js:34-41,103-118`;`reportService 空表头传导`
- **描述**:reportPdf 的 Promise 仅在 'end' resolve,PDFDocument 异常时无 'error' 处理→请求悬挂;renderTable 空 header → 495/0=NaN 宽度;categorySummaryCsv `b.header[0].startsWith` 空 header 数组→TypeError 500。("表格截断无披露"子点不成立:117 行已有 `… N more rows` 披露。)
- **核实证据**:代码核对;异常路径以坏报告对象实测。
- **修复方案**:reportPdf 增加 `doc.on('error', reject)`;renderTable 空 header 时跳过渲染(防御);categorySummaryCsv 空表头守卫返回仅表头行 CSV。
- **验证方式**:新增导出健壮性回归测试(reportPdf 拒绝而非悬挂、空表头不炸)。
- **状态**:已修复(回归:PDF 拒绝而非悬挂、空表头守卫)

---

## D-28(R-23)

- **编号**:D-28
- **来源**:R-23;检查点 5.7.1
- **严重度**:P2
- **位置**:`scripts/verify_extraction_real.js`、`verify_boundary_real.js`、`verify_selection_real.js`、`verify_report_real.js`(均无守卫);`eval/collectors.js:24-29`
- **描述**:五个真实适配器验证脚本仅 classification 有"无 GEMINI_API_KEY 即 exit 2"守卫;其余四个无密钥运行会以 mock 结果覆写正式指标证据文件;收集器对结果文件的 pass 字段盲信、不校验适配器来源。
- **核实证据**:grep GEMINI_API_KEY 五脚本仅一处命中;collectors.js 仅读 measured/pass。
- **修复方案**:四个脚本头部补齐同款守卫(exit 2,与分类脚本一致);collectors 在结果文件含 adapter 字段且值为 'mock' 时,对真实指标按"未测量"处理(pass=false,evidence 标注 mock 证据不可用)——mock 演示结果文件不受影响(其收集项本就不依赖 adapter 字段时保持原状,仅当字段存在且为 mock 才拦)。
- **验证方式**:无密钥环境运行四脚本断言 exit 2 且不写结果文件(阶段四留证);eval/run.js 回归(A-6)。
- **状态**:已修复(四脚本守卫 + 收集器拒 mock + 结果盖 adapter)

---

## D-29(R-24)

- **编号**:D-29
- **来源**:R-24
- **严重度**:P2
- **位置**:`Dockerfile`;`firebase.json`
- **描述**:容器无 HEALTHCHECK 指令(平台重启策略失去健康信号);Firebase Hosting 无安全响应头(CSP、HSTS、X-Frame-Options、X-Content-Type-Options、Referrer-Policy)。
- **核实证据**:配置文件核对。
- **修复方案**:Dockerfile 增加 `HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`(slim 镜像无 curl,用 node);firebase.json headers 增加全域安全头(CSP 允许 self+Firebase 认证域需要的连接目标、HSTS、DENY 帧保护、nosniff)。仅配置变更,本地等效头以 V-09 联动核验(dev 服务器由后端中间件补发同款头过轻量验证——不加运行时代码,以配置评审留证)。
- **验证方式**:配置 diff 留证 + docker build 本地不执行(红线:不执行部署命令;HEALTHCHECK 语法以文档核对)。
- **状态**:已修复(Dockerfile HEALTHCHECK + firebase.json 安全头)

---

## D-30(R-25)

- **编号**:D-30
- **来源**:R-25
- **严重度**:P3
- **位置**:`frontend/src/pages.jsx:281-302(P6)`
- **描述**:替换比例滑块的 ratio 只进 state,失焦回调仅 `api.runPipeline(taskId)` 未传比例——死滑块 + 昂贵副作用(整条流水线重跑)并存。
- **核实证据**:代码核对;V-10 P6 将实测网络请求。
- **修复方案**:run 请求体透传 `ratio`(可选数值,缺省 1.0),server /run 接收后传入 runPipeline → computeScenarios(ratio 参数本已存在);滑块失焦发送当前 ratio 后刷新报告。流水线重跑为既有设计("recompute at the selected ratio"),保持。
- **验证方式**:V-10(P6 滑块行为)+ 手工核对 run 请求体含 ratio。
- **状态**:已修复(V-10 P6:比例真实生效)

---

## D-31(R-26)

- **编号**:D-31
- **来源**:R-26
- **严重度**:P3
- **位置**:`frontend/vite.config.js:6-11`;`frontend/src/pages.jsx:221(P4 挂载)`
- **描述**:开发代理未覆盖 /factors(本地开发因子查询 404);P4 挂载即发起 `api.factors('')` 空查询,必然 400。
- **核实证据**:配置核对 + 请求路径推演。
- **修复方案**:vite proxy 增加 `'/factors': 'http://localhost:8080'`;删除 P4 挂载时的空查询调用(候选列表本就由 factorSearch(record) 驱动)。
- **验证方式**:V-10(本地开发全流程,因子候选可见)。
- **状态**:已修复(V-10 P4)

---

## D-32(R-27)

- **编号**:D-32
- **来源**:R-27
- **严重度**:P3
- **位置**:`backend/src/services/reviewQueue.js:45-54(audit id)`;查重时机;线性查找
- **描述**:审计记录 id `aud_rev_<recordId>_<Date.now()>` 毫秒时间戳,同记录同毫秒两次动作碰撞互相覆盖;查重在归一化前(子点不成立:设计即字节级 sha256,语义重复由 markSuspectedDuplicates 记录级兜底);多处 O(n²) 线性查找(子点有意保留:任务级 n 小,无实测瓶颈)。
- **核实证据**:代码核对。
- **修复方案**:审计 id 加随机后缀(对齐 ai_traces 既有模式 `Date.now()+random`);其余两子点登记结论不改码。
- **验证方式**:代码评审留证;review 相关回归测试不回归。
- **状态**:已修复(审计 ID 加随机后缀)

---

## D-33(R-28)

- **编号**:D-33
- **来源**:R-28;检查点 5.5.3(并发)
- **严重度**:P1(直接影响 V-08 验收)
- **位置**:`backend/src/services/pipeline.js:60`;`backend/src/services/taskRuns.js`;`backend/src/server.js:191-203`
- **描述**:已完成文档重跑被跳过但返回空累积——重跑任务报告缺已完成文档的记录与核算(completed 文档的陈旧核算同时残留在库);taskRuns 仅单飞等待不排队——同任务并发第二次触发的运行在首跑完成后处理剩余文档,其 assembleReport 仅含第二跑处理的记录,报告与账本不一致(V-08 必挂)。
- **核实证据**:代码推演 + V-08 将以连续两次触发实测。
- **修复方案**:(1) processDocument 对 completed 文档改为从存储加载其既有 records/calcs/matches 入累积(不再返回空),重跑报告完整且复核改动经仪表盘重算后即为最新;(2) /run 与 /api/demo/load 触发前若该任务已有在跑运行,先 await 再启动(经 taskRuns 链式排队),保证同任务运行串行。复核排除记录的陈旧核算残留:recalculateTask 与 generateReportForTask 均按 excluded_from_calc 过滤,读取侧已免疫(登记确认,不另改)。
- **验证方式**:V-08(PUBLIC_BASE 指本地跑 verify_consistency.js)+ 新增重跑完整性回归测试。
- **状态**:已修复(V-08 + 回归:重跑完整)

---

## D-34(R-29)

- **编号**:D-34
- **来源**:R-29
- **严重度**:P3
- **位置**:`backend/src/services/taskService.js:7-13`
- **描述**:任务创建仅真值浅校验:entity_name 可为任意结构(对象/数组/超长串);period_from/to 无类型与先后顺序校验,坏数据进报告与 PDF。
- **核实证据**:代码核对;以非法字段创建任务实测。
- **修复方案**:entity_name 必须非空字符串且 ≤200 字符;period_from/to 必须为 YYYY-MM-DD 合法日期且 from ≤ to;不符抛 ERR_ENUM_INVALID(沿用现有码,详情附字段名)。
- **验证方式**:新增任务创建校验回归测试;P1 表单正常路径不受影响(表单本就发字符串)。
- **状态**:已修复(回归:任务字段校验)

---

## D-35(R-30)

- **编号**:D-35
- **来源**:R-30
- **严重度**:P3
- **位置**:`backend/src/store/index.js` vs `backend/src/store/firestore.js`
- **描述**:适配器行为差异——(1) 未定义值查询:local 返回 [],firestore `where(==, undefined)` 抛错;(2) 文档顺序:local 为插入序,firestore 无顺序保证(latestReport 按 generated_at 排序已免疫,lists 顺序敏感处:报告附录因子表顺序来自 listFactors→可能不同,仅展示顺序差异);(3) list 全量加载无分页(任务级数据量可控)。
- **核实证据**:两实现逐项对照。
- **修复方案**:**有意保留 + 差异表文档化**(本条即差异表):(1) 当前全部调用点均传定义值(逐一核对 query 调用),无触发路径;(2) 顺序敏感读取已有显式排序;(3) 分页缺失记为已知约束,单任务 20-200 记录量级可接受。README 部署注意事项提示。
- **验证方式**:登记留证;A-6 回归。
- **状态**:有意保留(附差异表)

---

## D-36(R-31)

- **编号**:D-36
- **来源**:R-31;6.3.4
- **严重度**:P3
- **位置**:`backend/src/services/reportService.js:95-97`;`backend/src/services/traceability.js:57-60`;`frontend/src/pages.jsx:156-159`
- **描述**:报告服务空循环(agg.scope 双层循环内层 slice(0,0) 恒空);traceability 内层 `/^Sheet/` 判断恒真死分支;前端 loadRecords 死函数。
- **核实证据**:全引用搜索确认无副作用依赖。
- **修复方案**:三处删除,行数回收对冲 D-02。
- **验证方式**:A-2/A-5;引用覆盖率不回归(A-6)。
- **状态**:已修复(A-2/A-5)

---

## D-37(R-32)

- **编号**:D-37
- **来源**:R-32
- **严重度**:P3
- **位置**:`backend/src/server.js:84-95`
- **描述**:来源白名单对任意 `*.web.app` / `*.firebaseapp.com` 域名通配放行跨域——任何 Firebase 项目(含他人的)都可跨域读响应。
- **核实证据**:正则核对(`/\.web\.app$|\.firebaseapp\.com$/`)。
- **修复方案**:收敛为显式清单:默认 `http://localhost:5173 http://127.0.0.1:5173 https://myproject-dc19d.web.app`,CORS_ORIGINS 环境变量仍可扩展(部署域名变化属配置变更);通配正则删除。
- **验证方式**:V-09(非白名单来源无跨域头)+ 既有联调不回归。
- **状态**:已修复(V-09 + 回归:CORS 严格白名单)

---

## D-38(R-33)

- **编号**:D-38
- **来源**:R-33
- **严重度**:P3
- **位置**:`frontend/src/auth.js`;`frontend/src/api.js`
- **描述**:(1) uploadFiles 不查 res.ok,服务端错误时 res.results 为 undefined→TypeError→UI 卡 busy 无反馈;(2) json() 中 `...opts` 在 headers 之后展开,opts.headers 会整体覆盖认证头(当前无调用方传,属潜伏);(3) 全部请求无超时;(4) 长期刷新令牌存 localStorage(XSS 后可劫持);(5) 刷新失败静默 signUp 新身份→"看似成功实为新身份",原属主任务不可达(会话错位)。
- **核实证据**:代码核对 + 异常路径推演。
- **修复方案**:(1) uploadFiles 检查 res.ok,非 ok 抛错误消息(调用方已有 note 显示通道);(2) headers 展开顺序调整为 opts 先、认证头后(认证头不可覆盖);(3) json/upload 增加 AbortSignal.timeout(60s) 默认超时;(4)(5) **有意保留并文档化**:匿名身份无 PII,令牌价值低;刷新失败换新身份是"尽力保持可用"的既定取舍,在 README 隐私节与修复报告记录风险与改进路径(后端会话/HttpOnly cookie 属架构变更,超出最小修复范围)。
- **验证方式**:V-10(上传错误可见性——用不支持扩展名文件触发);代码评审留证 (4)(5)。
- **状态**:已修复((1) 上传查 res.ok、(2) 认证头不可覆盖、(3) 60s 超时;V-10 复验);(4)(5) 有意保留(理由见修复方案)

---

## D-39(新发现)

- **编号**:D-39
- **来源**:阶段二新发现(域 C)
- **严重度**:P1(D-06 收口后成为功能回归)
- **位置**:`frontend/src/pages.jsx:137(AuditView)`
- **描述**:审计视图用裸 `fetch('/api/tasks/...')` 不带 Authorization 头;D-06 属主校验生效后,有属主任务的审计查看将 403,且错误未捕获。
- **核实证据**:代码核对。
- **修复方案**:改走 api 层(api.js 增加 audit(taskId, recordId) 带认证头)。
- **验证方式**:V-10(P3 展开审计可见)。
- **状态**:已修复(V-10 P3 审计可见)

---

## D-40(新发现)

- **编号**:D-40
- **来源**:阶段二新发现(域 C)
- **严重度**:P1(D-06 收口后成为功能回归)
- **位置**:`frontend/src/pages.jsx:197(源文档链接),315-317(P7 导出三链接)`
- **描述**:文档下载与三种导出为裸 `<a href>`,浏览器导航不带认证头;有属主任务将 403。
- **核实证据**:代码核对。
- **修复方案**:api.js 增加 `download(path)` 助手(fetch+认证头+blob+ObjectURL 触发下载,含文件名);P3/P7 链接改按钮调用助手。无属主任务行为不变。
- **验证方式**:V-10(P7 三个导出全部成功且内容正确)。
- **状态**:已修复(V-10 P7 三导出成功)

---

## D-41(新发现)

- **编号**:D-41
- **来源**:阶段二新发现(域 B)
- **严重度**:P2
- **位置**:`backend/src/services/pipeline.js:49`
- **描述**:文档过滤仅排除 discarded,pending_duplicate 文档进入流水线;转换表无 pending_duplicate 出边,首次 setDocumentStatus('parsing') 即抛,每次运行必产生 document_pipeline_failed 错误日志(状态本身未损,但错误风暴掩盖真实故障)。
- **核实证据**:代码核对 + 转换表推演。
- **修复方案**:过滤条件改为 `d.status !== 'discarded' && d.status !== 'pending_duplicate'`。
- **验证方式**:upload 套件(重复文档场景)回归 + 重复上传后触发运行无 failed 日志(阶段四留证)。
- **状态**:已修复(流水线过滤 pending_duplicate)

---

## D-42(新发现)

- **编号**:D-42
- **来源**:阶段二新发现(域 B)
- **严重度**:P2
- **位置**:`backend/src/services/pipeline.js:203`
- **描述**:needsReview 取自 perDocRecords(抽取原始对象,normalizeRecord 返回新对象,uncertainty_level 只写在后者)→原始对象永无该字段,文档级 needs_review 状态不可达(七态机缺一态;P2 状态图标永不出现 needs_review)。
- **核实证据**:对象身份推演 + 修复后实测演示任务文档状态分布。
- **修复方案**:needsReview 改基于归一化后的 recordsOut(该文档实际产出记录)判定;单条记录处理失败路径(processing_failed)同样置高不确定,一并纳入。
- **验证方式**:V-01/V-10(P2 状态呈现)+ A-6(演示端到端不回归)。
- **状态**:已修复(V-10 P2 状态分布)

---

## D-43(新发现)

- **编号**:D-43
- **来源**:阶段二新发现(域 C)
- **严重度**:P3
- **位置**:`frontend/src/pages.jsx:77-78(P2 refresh)`
- **描述**:轮询 refresh 无 catch;任务被清理(local-store 删除)后每 2.5s 一次未处理 Promise 拒绝,UI 停留 Documents(0) 无提示。
- **核实证据**:代码核对。
- **修复方案**:refresh 加 catch,失败时置空并显示一次错误提示(与本地存储指向已删任务时的各页表现一致化)。
- **验证方式**:V-10 走查 + 手工删除任务后 P2 表现留证。
- **状态**:已修复(P2 轮询加 catch)

---

## D-44(新发现)

- **编号**:D-44
- **来源**:阶段二新发现(域 A)
- **严重度**:P3
- **位置**:`backend/src/server.js:116-125`
- **描述**:/factors 空 q 返回 400 + ERR_INTERNAL——状态码 400 配内部错误码语义错位;前端修复(D-31 删除空调用)后无调用方。
- **修复方案**:**有意保留**——改码属对外契约变更(verify 脚本可能断言现状),收益低;在前端删除必 400 的调用后该路径仅手工误触达。
- **验证方式**:登记留证。
- **状态**:有意保留

---

## D-45(新发现,并入 D-06 关联决策)

- **编号**:D-45
- **来源**:阶段二新发现(域 A/G)
- **严重度**:P3
- **位置**:`backend/src/errors.js`
- **描述**:错误码注册表缺 ERR_RATE_LIMITED(server.js:107 手写内联响应)与授权拒绝码;README 错误码清单随之缺项。
- **修复方案**:注册表补 ERR_RATE_LIMITED(http 429,消息与现内联完全一致)与 ERR_FORBIDDEN(http 403,D-06 使用);server 限流改经 AppError(对外字节不变);README 清单同步(D-46)。
- **验证方式**:V-09(限流响应码) + V-02(403 码)+ errors.test.js 回归。
- **状态**:已修复(注册表补 ERR_FORBIDDEN/ERR_RATE_LIMITED)

---

## D-46(新发现)

- **编号**:D-46
- **来源**:阶段二新发现(域 H)
- **严重度**:P2(文档可信度)
- **位置**:`README.md`(多处)
- **描述**:README 与实际不符——(1) 行数 4,132/6,976/8,771 vs 实测 4,335/7,110/8,905(基线即超支);(2) "cross-task, cross-identity and forged-header access are all rejected" 与 R-03/R-10/R-11 现状不符(修复后恢复为真);(3) "async task-queue abstraction selects Cloud Tasks" 在 D-22 移除后不成立;(4) 错误码清单缺 ERR_RATE_LIMITED/ERR_FORBIDDEN;(5) 测试数 34 需注明构成并在修复后更新。
- **核实证据**:README 与实测/代码逐项对照。
- **修复方案**:交付阶段(V-13)按修复后的最终实测逐项修订:行数三口径实测值、安全能力描述与修复后行为对齐、队列表述改为内联执行、错误码补全、测试数注明构成。
- **验证方式**:V-13 文档对账。
- **状态**:已修复(V-13 README 全面修订)

---

## D-47(新发现)

- **编号**:D-47
- **来源**:阶段二新发现(域 F,任务书 5.6.5 点名)
- **严重度**:P3(仓库卫生)
- **位置**:`scripts/golden/__pycache__/`(3 个 .pyc)
- **描述**:编译缓存被 git 跟踪入库。
- **核实证据**:git ls-files 确认 3 个 .pyc 被跟踪。
- **修复方案**:`git rm --cached` 移除跟踪;.gitignore 增加 `__pycache__/` 规则(新增忽略规则,不属于"改忽略使文件入库"的反向违规)。
- **验证方式**:git status 干净 + A-4/A-7。
- **状态**:已修复(__pycache__ 移除跟踪 + 忽略)

---

## D-48(新发现)

- **编号**:D-48
- **来源**:阶段二新发现(域 H)
- **严重度**:P3
- **位置**:`progress/PROGRESS_SUMMARY.md`
- **描述**:进度摘要中的行数/测试数/能力表述将因本次修复变动;作为历史文档不回改结论,但需追加本次审查修复的增量记录,避免文档间矛盾。
- **修复方案**:交付阶段在 progress 目录新增本次修复报告(中文),并在 PROGRESS_SUMMARY 顶部追加一行指针(不重写历史)。
- **验证方式**:V-13/V-14。
- **状态**:已修复(修复报告 + PROGRESS_SUMMARY 指针)

---

## D-49(检查点 5.5.5:提示词注入面)

- **编号**:D-49
- **来源**:阶段二(域 E 检查点 5)
- **严重度**:P2(攻击面记录)
- **位置**:`backend/src/services/pipelineModelCalls.js:184(extraction 提示),211(boundary:JSON.stringify(record)),234(selection:candidateSummary)`;classification 输入为文件字节
- **描述**:用户与模型可控文本(品名、地点、供应商名、单据打印内容)直接拼入提示词;恶意单据可携带指令文本影响模型输出(如诱导边界误判或因子选择)。既有缓解:全部输出经结构化 schema+闭集校验+重试(枚举外值拒收),因子选择强制候选闭集(AI-204),数值校验(D-15 后)拒非有限值——注入可及范围被压缩到"从合法枚举中选错值",且每步留痕 ai_traces 可审计。
- **修复方案**:**有意保留(识别+文档化)**:本轮不加代码级隔离(如指令包裹标记/敏感指令过滤),因为任何提示词改动都需重跑真实适配器评估以证明抽取准确率不回归,超出最小修复范围;缓解建议(后续):输入文本加明确的"以下为不可信单据内容"包裹段与长度上限、对含指令关键词的单据加复核强制标记。记录于修复报告"未实施项"。
- **验证方式**:本条即处置;A-6 评估不回归。
- **状态**:有意保留(附缓解建议)

---

## D-50(检查点 5.7.2:提交前密钥防线)

- **编号**:D-50
- **来源**:阶段二(域 G 检查点 2)
- **严重度**:P3
- **位置**:`scripts/scan-secrets.sh`
- **描述**:密钥扫描只扫"已跟踪+未忽略"文件,方向正确(不误报本地合法 .env);但"误把 .env 加入暂存区"发生在 git add 时(.env 被 .gitignore 忽略时 add 会被拒,但 `git add -f` 或重命名副本无防线)。评估:.gitignore 已忽略 .env 与 .env.*,常规 add 不可入库,仅显式 -f 可绕过,属人为故意场景。
- **修复方案**:**有意保留 + 文档化**:不引入 pre-commit hook(新增钩子属新工具链依赖,收益边际);在 README 密钥纪律节写明"严禁 git add -f 忽略文件"操作红线;scan-secrets 维持现状(其 git ls-files --others --exclude-standard 已覆盖"未忽略的新文件",改名副本若含密钥形态即被扫出)。
- **验证方式**:A-4 + 登记留证。
- **状态**:有意保留

---

## 登记册状态汇总(阶段二收口)

- 待修复:P0×4(D-04/05/06/07)、P1×10(D-08/09/10/11/12/13/14/15/16/17/33/39/40,其中 D-33 升 P1)、P2×9(D-18/19/20/21/22/26/27/28/29/41/42/46)、P3 视预算执行。
- 不成立:R-20 子点(解压放大)、R-22 子点(截断披露)、R-27 子点(查重时机)。
- 有意保留:D-25、D-35、D-38(4)(5)、D-44、D-49、D-50、R-27 线性查找子点。
- 基线缺陷:D-01(冒烟)、D-02(行数)、D-03(测试数口径)。


---

## D-51(阶段四 V-10 新发现)

- **编号**:D-51
- **来源**:阶段四 V-10 界面走查
- **严重度**:P1(D-09 修复后暴露的第二层缺陷)
- **位置**:`frontend/src/pages.jsx`(P4 候选获取);`backend/src/server.js`(新增候选接口)
- **描述**:P4 标题为 "Candidates (recall channel output)",但实现用 `/factors?q=<前6个词逗号连接>`——该接口按 AND 语义要求每个词都命中,自由文本描述(如 "Refrigerant HFC-32 top-up for plant HVAC")必然返回 0 条,匹配查看器无候选可选、无法完成手动指定因子。原先 P4 读 `task.records` 完全不可达,掩盖了此问题。
- **核实证据**:`/factors?q=refrigerant` → 98 条;`/factors?q=refrigerant,HVAC` → 0 条;界面实测候选表为空。
- **修复方案**:新增 `GET /api/tasks/:taskId/records/:recordId/candidates`,走流水线同一 recall 通道(recallCandidates)返回该记录的真实候选;前端 P4 改用它。与页面自身标题一致。
- **验证方式**:V-10(P4 候选非空并完成一次手动指定因子)。
- **状态**:已修复

---

## D-52(阶段四 V-10 新发现)

- **编号**:D-52
- **来源**:阶段四 V-10 视觉核验(vision 子智能体)
- **严重度**:P1(交付报告中的事实性数值错误)
- **位置**:`backend/src/services/reportService.js:123`
- **描述**:报告第 2 章 "Share" 列算式 `s.value * 1000 / totalKg * 100`——s.value 与 totalKg 同为千克,多乘 1000,占比被放大一千倍(实测 Scope 1/2/3 显示 26240.4% / 34201.4% / 39558.2%,正确应为 26.24% / 34.20% / 39.56%)。与 R-07 同源(kg/t 混淆)但位置不同,故 R-07 修复未覆盖。
- **核实证据**:V-10 P7 界面实测 + 算式推演;`scripts/verify_consistency.js` 只核对因子与排放值、未覆盖该百分比列。
- **修复方案**:改为 `s.value / (totalKg || 1) * 100`(千克比千克)。
- **验证方式**:新增回归断言(各 Scope 占比之和 ≈100% 且每项 ∈[0,100]);V-10 P7 复验。
- **状态**:已修复

---

## D-53(阶段四 V-10 新发现)

- **编号**:D-53
- **来源**:阶段四 V-10 视觉核验
- **严重度**:P3(界面列名与实际内容不符,误导复核)
- **位置**:`frontend/src/pages.jsx`(P3 "Factor" 列)
- **描述**:P3 表 "Factor" 列渲染 `r.match_id.replace('match_','')`,即记录 id(如 rec_1c09b706),而非实际选用的因子 id(EF-D26-…),列名与实际内容不符。
- **核实证据**:V-10 P3 界面实测(该列显示 rec_1c09b706,而 P4 显示真实因子 id)。
- **修复方案**:用仪表盘返回的 calcs 建立 record_id→factor_id 映射,该列改显真实因子 id,缺失时显示 —。
- **验证方式**:V-10 P3 复验(该列显示 EF-D26-… 形态)。
- **状态**:已修复

---

## D-54(阶段四 V-10 新发现)

- **编号**:D-54
- **来源**:阶段四 V-10 视觉核验
- **严重度**:P3(界面显示原始 null)
- **位置**:`frontend/src/pages.jsx`(P3 记录详情逐字段表)
- **描述**:详情表渲染 `typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')`;因 `typeof null === 'object'`,空值字段(origin_location、transport_mode 等)显示字面量 "null" 而非占位符。
- **核实证据**:V-10 P3 界面实测显示 "null"。
- **修复方案**:先判 null 再判 object:`v === null ? '—' : …`。
- **验证方式**:V-10 P3 复验(空值显示 —)。
- **状态**:已修复

---

## D-55(阶段四 V-10 观察,mock 固有)

- **编号**:D-55
- **来源**:阶段四 V-10 视觉核验
- **严重度**:不成立(非缺陷)
- **位置**:`backend/src/services/pipelineModelCalls.js`(mockSelection)
- **描述**:视觉核验发现若干记录的因子与活动语义不符(如 "Factory grid electricity" → EF-D26-BUSINESSTRAVELAIR-018)。
- **核实证据**:该现象仅存在于 mock 适配器:mockSelection 为确定性关键词重叠启发式,按项目政策"accuracy metrics are only ever computed from real-adapter runs"、mock 仅用于离线开发与测试的管线连通性。真实适配器路径由模型+候选闭集校验(AI-204)决定,线上演示使用真实适配器。
- **修复方案**:**不改**——修改 mock 启发式无收益且可能扰动既有评估证据;属预期行为。已在修复报告"mock 模式说明"中记录。
- **状态**:不成立(附解释)

---

## D-56(阶段四 V-10 观察,外观)

- **编号**:D-56
- **来源**:阶段四 V-10 视觉核验
- **严重度**:P3(外观)
- **位置**:`backend/src/services/calculation.js`(aggregate 的 scope 分组顺序)→ 报告第 2/4 章表格行序
- **描述**:报告 Scope 表行序为 Scope 1、Scope 3、Scope 2(按记录处理顺序的插入序),非 1/2/3。
- **核实证据**:aggregate 用 Map 按记录顺序分组;worker 池按文档序回并,故结果确定但未排序。
- **修复方案**:**有意保留**——纯外观;排序会改变 displayConsistent 的最大余数分摊次序,可能扰动已通过验证的"聚合一致性"评估证据,收益不抵风险。记录为已知外观项。
- **验证方式**:登记留证;A-6 聚合一致性不回归。
- **状态**:有意保留(附理由)

---

## D-57(阶段四 V-10 观察,mock 固有)

- **编号**:D-57
- **来源**:阶段四 V-10 视觉核验
- **严重度**:不成立(非缺陷)
- **位置**:`frontend/src/pages.jsx`(P3 详情表第三列 = per-field confidence)
- **描述**:视觉核验指出 P3 "Fields & per-field confidence" 表未显示置信度数值。
- **核实证据**:该列读 `r.field_confidence?.[k]`,mock 抽取的记录来自 demo 的 expected_records.json,本身不含 field_confidence,故 extractRecords 回退为空对象;真实适配器路径由 EXTRACTION_SCHEMA 强制输出 field_confidence(校验器还要求每个值 ∈[0,1])。
- **修复方案**:**不改**——数据依赖,非代码缺陷;真实模式有值。记录为 mock 说明。
- **状态**:不成立(附解释)

---

## D-58(阶段四二次复查新发现)

- **编号**:D-58
- **来源**:阶段四二次复查
- **严重度**:P2(证据完整性,与 R-23/D-28 同类)
- **位置**:`scripts/verify_consistency.js`(证据写入处)
- **描述**:该一致性守卫始终写 `progress/evidence/T-050/consistency.json`。以 `PUBLIC_BASE` 指向本地服务运行时(任务书 V-08 明确允许的做法),会用本地单任务结果**覆盖公网 3 任务的正式证据**——本次审查中实际发生,已恢复。
- **核实证据**:`git diff progress/evidence/T-050/consistency.json` 显示 4 增 16 删;恢复后确认为公网 3 任务 PASS。
- **修复方案**:仅在未覆盖 `PUBLIC_BASE`(即对默认公网目标运行)时写正式文件名;本地运行改写 `consistency-local.json` 并打印实际路径。
- **验证方式**:本地运行确认 `consistency.json` 不再变动、`consistency-local.json` 生成;A-4/A-7 干净。
- **状态**:已修复

---

## D-59(阶段四自我回归,已修复)

- **编号**:D-59
- **来源**:阶段四 V-10 走查(P8 编辑失败)
- **严重度**:P1(修复引入的回归)
- **位置**:`backend/src/services/reviewQueue.js`(补丁校验)、`backend/test/regression.test.js`
- **描述**:D-14 的补丁校验最初要求 quantity/amount 必须是 `number`,而复核界面(P8)的输入框提交的是字符串,导致 P8 编辑一律 422 失败(ERR_ENUM_INVALID),复核闭环不可用。
- **核实证据**:V-10 P8 编辑实测 422;控制台 "Error: The model returned a value outside the allowed enumeration."
- **修复方案**:改为 `normalizePatch`:数值字段接受 number 或数字字符串并强制转数,非有限值/越界仍拒绝(如 'abc'、Infinity、NaN、0、-3);落库必为 number。既保住 D-15 数值防线又兼容界面。
- **验证方式**:回归断言(字符串 '5'→5 且 typeof number;'abc'/Infinity/NaN/0/-3 拒绝);V-10 P8 复验(quantity 21000 落库为 int,报告随之刷新)。
- **状态**:已修复

---

## 阶段四二次复查结论(7.4)

**方法**:换视角按文件复核(server.js → 服务层 → 前端 → 脚本),专找修复自身引入的新问题、修复间相互作用、登记册外同类遗漏。

**修复引入的新问题(已发现并闭环)**:
- 修复期间发现 D-51(P4 候选为空)、D-52(报告 Share 列 1000×)、D-53(P3 因子列)、D-54(P3 空值显示 null)、D-58(证据覆盖),均已登记并修复。
- **D-59(自我回归,已修复)**:D-14 的补丁校验最初要求 quantity/amount 为 `number`,而复核界面输入框提交字符串 → P8 编辑 422 失败。已改为"数字或数字字符串强制转数、非有限值拒绝",并加回归断言(字符串 '5' 转 5、'abc'/Infinity/0/-3 拒绝、落库为 number)。登记为 D-59。

**修复间相互作用核对**:
- D-06 属主校验 + 前端 D-39/D-40(审计与下载改带认证头):两者必须同批生效,否则有属主任务的审计/导出会失效——已同批修复并经 V-10 复验。
- D-33 运行串行化 + D-05 情景隔离 + D-04 状态机:并发重跑不再产生半写台账,情景值不落库,多页文档不再中断——三者叠加后 V-08 一致性 PASS。
- D-12 上传限制 + verify_upload.js 契约:超限从"逐文件错误"变为"中间件 413",属加强,已同步断言。
- D-21 真实召回分 + D-15 数值防线:候选分数可能 >1(关键词+语义叠加),阈值比较仍成立;账本无非有限值。
- D-26 pdf-lib 计数 + documentUnits 既有解析:ingest 与拆分各解析一次 PDF,存在重复解析的轻微开销,正确性优先,不视为缺陷。

**登记册外同类遗漏核对**:
- 逐一复查其余 verify_* 脚本的写入目标:`verify_public_faults.js`/`verify_public_perf.js`/`verify_acceptance.js` 面向公网目标,本轮未运行(红线:不对公网执行破坏性验证),其证据未被触碰。
- 复查前端全部 `<a href>` 与裸 fetch:仅剩品牌链接与 hash 路由链接,无遗留未带认证头的 API 访问。
- 复查后端全部 `store.put` 主键:情景路径已隔离;审计 ID 已加随机后缀;报告 ID 每任务唯一。
- 复查全库 `Number(` 与算术入口:config、pipeline 并发、限流阈值、补丁数值、抽取数值、换算、核算基数均已加有限性防线。

---

# 二次复查(第二轮):独立复核新发现(D-60 至 D-66)

> 阶段四收口后,由独立复核者以"按文件、逐断言"视角重跑一遍(7.4 要求"直至零新增")。
> 本轮**证伪了前一轮"零新增"的结论**:发现 7 项前一轮遗漏或未闭环的问题。
> 全部先登记后修复,并各自配套回归断言。第一轮结论中"零悬空条目"的表述因此被本轮修正。

## D-60(第二轮二次复查新发现)

- **编号**:D-60
- **来源**:二次复查(第二轮独立复核)
- **严重度**:P1(数据损毁 + 文档永久卡死;可由界面唯一运行入口触发)
- **位置**:`backend/src/services/pipeline.js:74-84`(非 completed 文档的旧记录清理)与 `backend/src/services/fileService.js:133`(`TRANSITIONS.failed = ['queued']`)
- **描述**:`processDocument` 对**所有非 completed 文档**先删除其既有 `activity_records`/`calculations`/`matches`/`review_items`,随后进入 `withStatus(...,'parsing',...)`,而该函数第一步就是 `setDocumentStatus(...,'parsing')`。转换表对 `failed` 只允许出边到 `queued`,故 `failed → parsing` 抛 `ERR_ENUM_INVALID`。后果有二:(1) **失败文档永不恢复**——全库无任何调用方会把 `failed` 重置为 `queued`(`POST /documents/:docId/status` 在 `frontend/src`、`scripts/`、`backend/test` 中零引用),该文档从此被静默排除出报告;(2) **数据损毁**——若该文档在失败前已落库过记录(如 `completed` 文档因复核重算失败转为 `failed`),重跑会先删掉这些记录、再抛错,记录不可恢复。触发条件:任一文档处于 `failed` 态时再次触发运行(界面唯一入口是 P6 情景页滑块)。违反任务书 6.3.3 明文要求"失败态可从队列态重试"。
- **核实证据**:独立复核者实测:(a) 将某任务单文档强制置 `failed` 后重跑 → `records=0`,存储内 0 条记录;(b) 删除某 unit representation 文件使 run 2 在 `withStatus` 内抛 ENOENT → 既有 1 记录 + 1 核算被删除、文档置 `failed`;run 3 及之后 `records=0`、`calculations=0`、报告第 5 章 0 行、`total_kgco2e=0`。本人复核代码路径:`pipeline.js:76-83` 先删、`:84` 再设 `parsing`;`fileService.js` 转换表 `failed: ['queued']`。
- **修复方案**:(1) `TRANSITIONS.failed` 增补 `'parsing'`(与既有注释"处理态可重入 parsing 以支持重跑"一致);(2) 把旧记录清理**移到重跑成功之后**执行,且只删除本次未重新产出的记录 id(记录 id 为每次随机生成 `rec_<uuid8>`,故该判据同时保证了不重复、不误删)。
- **验证方式**:回归断言(置 failed → 重跑 → 记录数>0 且终态非 failed;重跑两次记录数不翻倍)。
- **状态**:已修复

## D-61(第二轮二次复查新发现)

- **编号**:D-61
- **来源**:二次复查(第二轮独立复核)
- **严重度**:P3(测试断言空洞,削弱回归护栏)
- **位置**:`backend/test/regression.test.js:305`
- **描述**:`assert.equal(malformed.status, 429 < malformed.status ? malformed.status : malformed.status, …)` 把值与自身比较,恒真,不构成任何断言;该行本意是"畸形 Origin 头不导致服务器错误"。
- **核实证据**:表达式两侧恒等(三目分支返回同一变量)。
- **修复方案**:改为有意义的断言 `assert.ok(malformed.status < 500, 'malformed origin never causes a server error')`。
- **验证方式**:A-2(该断言在畸形头请求下可实际失败)。
- **状态**:已修复

## D-62(第二轮二次复查新发现)

- **编号**:D-62
- **来源**:二次复查(第二轮独立复核)
- **严重度**:P3(复核动作校验不齐;D-14 声明"全部动作"校验实为"三个动作")
- **位置**:`backend/src/services/reviewQueue.js:154-161`(`closeReviewItem`)
- **描述**:`editRecordFields`/`assignFactorManually`/`excludeRecord` 均以 `getTaskRecord` 校验"记录属于该任务",唯独 `closeReviewItem` 不校验:对未知或跨任务的 recordId 调用 `action=close` 会返回 200 并写入一条 `review_closed` 审计行(无跨任务数据改写,因内部循环过滤 `item.task_id !== taskId`)。
- **核实证据**:代码比对(三个动作调用 `getTaskRecord`,`close` 未调用)。
- **修复方案**:`closeReviewItem` 开头补 `await getTaskRecord(store, taskId, recordId)`。
- **验证方式**:回归断言(跨任务 recordId 调 close 抛 `ERR_TASK_NOT_FOUND`)。
- **状态**:已修复

## D-63(第二轮二次复查新发现)

- **编号**:D-63
- **来源**:二次复查(第二轮独立复核)
- **严重度**:P3(配置健壮性:非法值被静默截断而非回退)
- **位置**:`backend/src/config.js:97-101`(`coerce`)
- **描述**:`Number.parseInt`/`Number.parseFloat` 接受部分合法前缀,故 `AI_TIMEOUT_SECONDS='60abc'`→60、`BATCH_SIZE='1e3'`→1、`AI_RETRY_COUNT='2.9'`→2、`CLASSIFICATION_CONFIDENCE_THRESHOLD='0.7junk'`→0.7 被静默采用,而非按 5.6.1 的意图回退默认值。
- **核实证据**:以非法环境变量调用 `loadConfig` 实测上述四个值。
- **修复方案**:`coerce` 对 int/float 要求整串(去空白后)为有限数值,否则返回 `NaN` 交由既有 range 守卫回退默认值。
- **验证方式**:回归断言(`'60abc'`/`'1e3'`/`'2.9'` 分别回退默认 60/10/2)。
- **状态**:已修复

## D-64(第二轮二次复查新发现)

- **编号**:D-64
- **来源**:二次复查(第二轮独立复核)
- **严重度**:P3(死代码;行数预算对冲候选)
- **位置**:`backend/src/services/factorLibrary.js:84`、`backend/src/store/index.js:97`、`backend/src/services/classification.js:46`、`frontend/src/auth.js:74-78`
- **描述**:四处确认零引用/不可达:(1) `export const FACTOR_LIBRARY_FILE = FACTOR_FILE` 全库仅此一行;(2) `export const STORE_COLLECTIONS = COLLECTIONS` 全库仅此一行;(3) `mockClassification` 规则表 `[/blurry|blank/, null]` 的 `type` 为 null,而消费循环以 `if (re.test(n) && type)` 过滤,该条永不生效,且 `/blurry/` 已在其后单独处理;(4) `export async function currentIdToken()` 全库零调用(前端直接读 `window.__idToken`)。
- **核实证据**:`grep -rn` 全库引用扫描(两项导出仅命中定义行本身);规则表消费条件推演;对全部 `export function/const/class` 做了一次全库出现次数统计(唯一命中数为 1 的即死导出),结果仅 `currentIdToken` 一项。
- **修复方案**:移除上述四处死代码(不可达规则删除后行为等价,因 `blank` 本就落到默认 `other`/0.55 分支)。
- **验证方式**:A-2/A-6(行为不回归)。
- **状态**:已修复

## D-65(第二轮二次复查新发现)

- **编号**:D-65
- **来源**:二次复查(第二轮独立复核)
- **严重度**:P3(数值防线不对称;当前数据不可达,属纵深防御)
- **位置**:`backend/src/services/calculation.js:58,73`
- **描述**:`computeEmission` 对 `basis.value` 有有限性守卫(D-15),但对 `factorValue`(含 GWP 折算后的 `co2+ch4+n2o`)与乘积 `emissionKg` 未校验即落库;若因子文件被覆盖或存储行被手工改写为非数值,`NaN` 会经 `calculations` 进入 `aggregate` 与报告。
- **核实证据**:`data/factors/emission_factors.json` 743/743 因子 `value` 均为有限数值、`gas_breakdown` 无非法类型,故当前不可达;代码路径比对确认落库前无守卫。
- **修复方案**:在 `emissionKg` 计算后、构造 `calc` 前加 `Number.isFinite(emissionKg)` 守卫并抛出可被管线降级为复核的错误。
- **验证方式**:回归断言(非法 factorValue → 抛错;既有核算用例不回归)。
- **状态**:已修复

## D-66(第二轮二次复查新发现)

- **编号**:D-66
- **来源**:二次复查(第二轮独立复核)
- **严重度**:P3(嵌入响应形状校验不完整)
- **位置**:`backend/src/ai/client.js:238-239,251`
- **描述**:`embedTexts` 只校验 `parsed.embeddings.length === chunk.length`,不校验每个元素的 `values` 是否为非空数组;`recall.js:58` 按位置写入索引,`cosine` 对 `undefined` 会静默产出 NaN/-1 分数而非报错。
- **核实证据**:代码路径比对;D-18 回归仅覆盖"数量不足"一种响应。
- **修复方案**:在数量校验通过后,逐个校验 `values` 为非空数组,否则以 `ERR_MODEL_CALL_FAILED` 显式失败。
- **验证方式**:回归断言(元素缺失/空数组 → 显式失败)。
- **状态**:已修复

## D-67(第二轮二次复查新发现)

- **编号**:D-67
- **来源**:二次复查(第二轮独立复核,API 级端到端复验)
- **严重度**:P2(数据完整性:重跑可静默清空既有账本;mock 模式可由漏传标志的调用方直接触发,真实模式可由"软空抽取"触发)
- **位置**:`backend/src/services/pipeline.js:74-90`(非 completed 文档的重跑替换逻辑)、`backend/src/server.js:228-241`(`/run` 的 mock 目录构造)
- **描述**:重跑一个**非 completed** 文档时,流水线先按 `source_ref` 前缀找出该文档的既有记录并删除,再重新抽取。若本次重跑抽取产出为空(0 条),旧记录已被删除、新记录又没有 → 该文档的账本被清空,且任务终态仍报 `completed`、无任何错误。可触发路径有二:(1) **mock 模式**:`/run` 端点在请求体不含 `useMockCatalog` 时传入空 `Map`,mock 抽取器的唯一数据源即该目录,故必然产出 0 条;(2) **真实模式**:模型软性返回空记录集(不抛错)时同样触发。实测(本地 mock,一键演示 20 单据):重跑后存储内 `activity_records` 由 **20 条降为 2 条**、`calculations` 20→2、`matches` 20→2、`review_items` 18→0,报告随之只反映残存的 2 条,任务却显示成功。
- **核实证据**:(a) 本地服务 + 一键演示 + 无 `useMockCatalog` 的重跑,直接读取 `STORE_ROOT` 下的集合文件计数得 20→2;(b) **归因测试**:用 `git checkout 12f1286 -- backend/src/services/pipeline.js backend/src/services/fileService.js` 取回 D-60 之前的版本重跑同一场景,同样 20→2 → 证实为**既有缺陷,非本轮修复引入**;(c) 服务端日志显示第二次运行完全没有 `recall_started` 事件,证明抽取阶段产出为空、未进入匹配阶段。
- **影响面界定**:仓库内唯一调用方 `frontend/src/api.js:27` 已正确传 `useMockCatalog: !window.__REAL_AI__`,故界面路径不受影响;生产部署走真实适配器亦不受影响。但"重跑不得静默缩小账本"是 D-33/V-08 幂等重跑意图的底层不变式,且 V-08 的自动化证据(`verify_consistency.js` 只校验报告与**残存**账本自洽)对该情形存在盲区——本次记录该盲区。
- **修复方案**:采用最保守口径——**重跑产出为空而该文档原有记录非空时,保留原有记录与核算、不删除,并记 `document_reprocess_empty` 告警**,而不是清空账本;仅当重跑确有产出时才执行"替换旧记录"。
- **验证方式**:回归断言(D-67:无目录重跑后记录数仍为 2、存储计数为 2、总量 > 0)。
- **状态**:已修复

## 第二轮二次复查结论

- **本轮新增 8 条(D-60 至 D-67),全部已修复并配回归断言**;其中 D-60 为 P1(数据损毁 + 永久卡死)、D-67 为 P2(重跑静默清空账本),其余为 P3。
- **对第一轮结论的修正**:第一轮"零悬空条目/零新增"的表述不成立——D-60 属于第一轮遗漏的同类问题(D-04 状态机族的"失败态重试"分支未被验证),D-61 属于第一轮自建回归测试的断言空洞,D-67 属于 D-33 幂等重跑意图未被端到端验证。本登记册以本轮结论为准。
- **A-5 影响**:D-64 回收 3 行;其余修复净增行数,均并入 D-02 最终账(超支账目已按 2.6.2 记录并接受)。
