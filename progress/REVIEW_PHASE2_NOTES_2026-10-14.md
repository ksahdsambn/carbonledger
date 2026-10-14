# 阶段二分域审查记录(2026-10-14)

> 方法:按任务书第五章八域顺序,逐文件通读 + 检查点核对 + 附录 A 疑点逐条核实(代码推理 + 可执行复现)。全部结论进入 `DEFECT_REGISTER_2026-10-14.md`。
> 本文件保留审查过程的关键证据与疑点核实结论汇总,便于追溯。

## 疑点核实结论速览(R-01 至 R-33)

| 疑点 | 结论 | 登记为 | 关键证据 |
|---|---|---|---|
| R-01 | **成立(P0)** | D-04 | pipeline.js:85 在 `for (const unit of units)` 循环内 `setDocumentStatus(...,'extracting')`;fileService TRANSITIONS.extracting 无自环;第二单元必抛 ERR_ENUM_INVALID→withStatus 置 failed |
| R-02 | **成立(P0)** | D-05 | scenarios.js rerunWithFactor→computeEmission(calculation.js:79 store.put('calculations', calc_<record_id>)) 同主键覆盖基线;exportService 路由与 generateReportForTask 均读落库核算 |
| R-03 | **成立(P0)** | D-06 | server.js 除文件下载(165 行有属主判断)外全部任务级路由无属主校验;getTask 仅 404 判断 |
| R-04 | **成立(P0)** | D-07 | fileService.js:76 存储键直接拼 filename;storage/index.js #path 仅 join 无包含性校验 |
| R-05 | **成立(P1)** | D-08 | ai/client.js input_summary=summarize(parts)(含 inline_data base64);err.message 含上游 body(dispatch:167);叠加 R-03 公开 |
| R-06 | **成立(P1)** | D-09 | pages.jsx P3:168/P4:222 读 `t.records`,任务详情接口仅返回 `{...task, documents}`;pages.jsx:156 loadRecords 为从未调用的死代码 |
| R-07 | **成立(P1)** | D-10 | reportService.js:94 `anchor(s.value * 1000)`,s.value 已是 kg,anchor 内部再 /1000 → 锚点吨值=千克原值,放大千倍 |
| R-08 | **成立(P1)** | D-11 | exportService.js csvEscape 仅处理 `",\n`;`=SUM(...)`、`@cmd`、`+1`、`-1` 原样输出 |
| R-09 | **成立(P1)** | D-12 | server.js:25 multer 无 limits;大小校验在 ingestFile(全量入内存后);与 verify_upload.js 11MB 用例的交互见登记册 D-12 决策 |
| R-10 | **成立(P1)** | D-13 | server.js:102 限流键取 x-forwarded-for;rateBuckets Map 无上限;:87 `new URL(origin)` 畸形值抛 TypeError→500 |
| R-11 | **成立(P1)** | D-14 | reviewQueue.js assignFactorManually(:81)/excludeRecord(:102) 无 record.task_id 校验;editRecordFields 补丁值无类型/范围校验 |
| R-12 | **成立(P1)** | D-15 | pipelineModelCalls validateExtraction:quantity `NaN<=0`为 false、Infinity 为 number 均通过;amount 仅 `<0`;gross_weight_kg/distance_km 零校验;convertUnit/activityBasis 无有限性防御;复核编辑同 |
| R-13 | **成立(P1)** | D-16/D-17 | config.js coerce 无校验(NaN/负数生效);pipeline.js:209 Math.max(1,Number(...)) 对 NaN 得 NaN→worker 数组空→静默空跑;ai/client attempts=NaN+1→循环不执行→throw null;callModel 对 kind:'fatal' 仍重试 |
| R-14 | **成立(P2)** | D-19 | reportService.js:270 `scenarios.has(ref) || String(ref).includes('_S-')` 后半句免存在性校验 |
| R-15 | **成立(P2)** | D-20 | store/index.js:40 解析失败静默置空 Map;#persist writeFileSync 非原子 |
| R-16 | **成立(P2)** | D-21 | pipeline.js:137 候选置信度硬编码 0.5(阈值 0.65)→no_high_confidence_factor 恒真(有候选时);uncertainty levelDistribution 对缺失等级产生 `undefined:NaN` 键 |
| R-17 | **成立(P2)** | D-22 | queue/index.js 仅被 backend/test/queue.test.js 引用,服务端零引用;enqueue 运行期 setImmediate 派发不移出 pending→重复 start 双派发。决策:按任务书 5.4.3 授权移除(回收行数) |
| R-18 | **成立(P2)** | D-18 | embedTexts 真实模式无 AbortController/重试;`for (const e of data.embeddings ?? [])` 向量数不足时静默错位写入索引 |
| R-19 | **成立(P2)** | D-24 | normalization identifyCurrency:CNY 行 `¥` 在 JPY 行之前,`¥jp` 永不可达,裸 `¥` 恒判 CNY |
| R-20 | **部分不成立(P2)** | D-25 | 全库无解压路径:xlsx 以 inline_data 原样发给模型,本地不解压;10MB 上限约束压缩体。登记"有意保留+攻击面文档化" |
| R-21 | **风险成立(P2)** | D-26 | 实测 golden 9 份 PDF 正则计数与 manifest 0 偏差;但对压缩对象流(ObjStm)PDF 会欠计→页单元缺失。处置:改用 pdf-lib 精确计数(既有依赖) |
| R-22 | **成立(P2)** | D-27 | reportPdf 无 doc.on('error')→生成异常请求悬挂;renderTable header 空→495/0=NaN;categorySummaryCsv `b.header[0].startsWith` 空表头 TypeError。"截断无披露"子点**不成立**(:117 已有 `… N more rows` 披露) |
| R-23 | **成立(P2)** | D-28 | 实测仅 verify_classification_real.js 有密钥守卫(:20),extraction/boundary/selection/report 四个无;collectors.js:27 盲信 data.pass |
| R-24 | **成立(P2)** | D-29 | Dockerfile 无 HEALTHCHECK;firebase.json headers 仅缓存,无 CSP/HSTS/X-Frame-Options/X-Content-Type-Options |
| R-25 | **成立(P3)** | D-30 | pages.jsx P6 ratio 仅入 state,onBlur 只调 runPipeline(taskId) 未传 ratio |
| R-26 | **成立(P3)** | D-31 | vite.config.js 代理仅 /api;P4 挂载即调 api.factors('')→/factors?q= 缺失→400(且 dev 404) |
| R-27 | **部分成立(P3)** | D-32 | 审计 ID 毫秒时间戳可碰撞(aud_rev_<rec>_<ms>)成立→加随机后缀;"查重在归一化前"子点**不成立**(设计即字节级 sha256 查重,语义重复由记录级 markSuspectedDuplicates 兜底);平方复杂度线性查找 n 小,**有意保留** |
| R-28 | **成立(P3→P1 影响验收)** | D-33 | pipeline.js:60 completed 文档跳过返回空累积→重跑报告缺该文档记录;taskRuns 不排队→并发双跑第二跑报告不完整(V-08 必挂);generateReportForTask 已按 excluded 过滤(该子点无恙) |
| R-29 | **成立(P3)** | D-34 | taskService 仅真值判断;entity_name 可为任意结构;日期无类型/顺序校验 |
| R-30 | **差异确认(P3)** | D-35 | 未定义值查询:local 返回 [],firestore where==undefined 抛错(当前无此调用点);文档顺序:local 插入序,firestore 不保证;list 全量无分页。产出差异表,**有意保留**并文档化 |
| R-31 | **成立(P3)** | D-36 | reportService.js:95-97 空循环(slice(0,0));traceability.js:57-60 内层 if 恒真死分支;pages.jsx:156 loadRecords 死函数。移除回收行数 |
| R-32 | **成立(P3)** | D-37 | server.js:87 `\.web\.app$\|\.firebaseapp\.com$` 任意 Firebase 项目域名放行 |
| R-33 | **成立(P3)** | D-38 | api.js uploadFiles 不查 res.ok;json() opts 在 headers 之后展开可覆盖头;全程无超时;auth.js 刷新令牌 localStorage+失败静默换身份(会话错位) |

## 阶段二新发现(登记册 D-39 起)

- **D-39**:pages.jsx AuditView(:137)裸 fetch 无认证头→D-06 收口后有属主任务审计查看 403。
- **D-40**:P7 导出三链接与 P3 源文档链接为裸 `<a>` 无认证头→D-06 后有属主任务导出失效;需 fetch+blob 下载助手。
- **D-41**:pipeline.js:49 仅过滤 discarded,pending_duplicate 文档进流水线→首状态转换即抛(转换表无该态)→每次运行必产生 document_pipeline_failed 噪音日志。
- **D-42**:pipeline.js:203 needsReview 取自 perDocRecords(归一化前原始对象,永无 uncertainty_level)→文档级 needs_review 状态不可达;应基于归一化后 recordsOut 判定。
- **D-43**:pages.jsx P2 refresh 轮询无 catch→任务被清后每 2.5s 一次未处理 Promise 拒绝,UI 永久 Documents(0)。
- **D-44**:server.js /factors 空 q 返回 400+ERR_INTERNAL(语义错位),前端修复后无调用方;**有意保留**(改码属契约变更,收益低)。
- **D-45**:errors.js 注册表缺 ERR_RATE_LIMITED(server 手写内联)与授权拒绝码;D-06 需新增 ERR_FORBIDDEN(登记为独立契约新增决策)。
- **D-46**:README 陈旧:行数(4,132/6,976/8,771 vs 实测 4,335/7,110/8,905)、"cross-identity rejected"声称与 R-03 现状不符、队列抽象描述(R-17 移除后需改)、错误码清单缺 ERR_RATE_LIMITED/ERR_FORBIDDEN。
- **D-47**:仓库卫生:`scripts/golden/__pycache__/*.pyc` 3 个编译缓存被 git 跟踪(任务书 5.6.5 点名)。
- **D-48**:PROGRESS_SUMMARY 的行数/测试数表述将随修复更新(交付阶段同步)。
- 提示词注入面(任务书 5.5.5,要求识别+文档化):品名/地点/供应商名等用户与模型可控文本直接拼入 extraction/boundary/selection 提示词(pipelineModelCalls.js:211/234);document 分类输入为文件字节。攻击面与缓解建议记录于登记册 D-49,**有意保留**(代码缓解需保持抽取准确率不回归,最小改动原则下本轮不实施)。

## 各域检查点完成情况

- 域 A(安全):9 检查点全过 → D-05/D-06/D-07/D-08/D-11/D-12/D-13/D-14/D-37/D-39/D-40/D-44/D-45;`/config` 仅回非密配置确认未被破坏;无动态求值/命令执行;前端无直接注入 DOM 路径(全部经 React 文本节点)。
- 域 B(业务):12 检查点全过 → D-04/D-05/D-10/D-15/D-19/D-21/D-24/D-26/D-27/D-28/D-33/D-34/D-36/D-41/D-42;聚合舍入 displayConsistent 边界(空集/单元素/负值)推演无缺陷。
- 域 C(前端):6 检查点全过 → D-09/D-30/D-31/D-38/D-39/D-40/D-43;本地存储键 cl_task/cl_anon_session 生命周期确认。
- 域 D(存储):4 检查点全过 → D-20/D-22/D-35;存储键合法字符集与包含性校验并入 D-07。
- 域 E(并发容错 AI):6 检查点全过 → D-16/D-17/D-18/D-15/D-33/D-49;后台失败落盘可读状态(withStatus 置 failed)现状成立。
- 域 F(配置部署):6 检查点全过 → D-16/D-25/D-29/D-47;镜像内 data/golden 运行时零引用(可移除),data/demo 为一键演示运行时必需(保留);.gcloudignore/.gitignore 覆盖核对无漏洞(除 __pycache__ 未忽略→D-47);deploy/README 占位与实际部署方式一致(仅说明,不执行)。
- 域 G(测试验证):5 检查点全过 → D-22/D-28/D-01/D-12(verify_upload 交互);密钥扫描对"误入暂存区"无防线→D-50(守卫式改进:预提交钩子或扫描增强,保守取扫描脚本增强+文档);回归测试缺口清单(多页/情景隔离/属主/遍历/公式注入/锚点/非有限数值/嵌入短响应)随各修复补齐。
- 域 H(文档卫生):3 检查点全过 → D-03(README 34 与实测一致,任务书预判的差异不存在,保留对账记录)/D-46/D-47/D-48;DEFECT_REPORT_T050 的修复(确定性报告 ID+单飞)在 R-02/D-05 修复后仍成立且被加强。
