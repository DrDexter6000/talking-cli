# Talking CLI — Session Handoff

> ⚠️ **2026-04-18 更新**：本文件已被 [PRD.md](PRD.md) 取代作为 single source of truth。
> 保留在此仅作为历史快照与决策溯源。冷启动请直接读 PRD。

**最近一次讨论**：2026-04-18，在 `life-index` 项目 session 中完成初步定型
**当前阶段**：seed drafts 已落盘，PRD 已起草，品牌统一为 `talking-cli`

> 本文件**不对外**。它是写给下一次 session 的自己 / 自己的 AI 搭档的备忘，便于冷启动。

---

## 当前共识（不轻易动）

- **项目名**：**Talking CLI**（display name / 方法论 / 运动名）+ **`talking-cli`**（CLI 工具 & 包名）
  - 2026-04-18 决策翻转：原双名（Talking CLI + `talkback`）过度工程，已统一为单名 `talking-cli`
  - 类比：ESLint = `eslint`，方法论与工具共用一名，读者不需要建两个概念
- **核心主张**：`Prompt Surface = SKILL.md ∪ {tool_result.hints}`
  - 两半共用一个 token 预算；放错位置即错价
- **定位**：Context Engineering 下的一个**可命名、可复用的具体子模式**
  - 原创点在"双通道 + 预算"，**不**在"progressive disclosure"本身
  - 不要被 "Anthropic 已经做了 progressive disclosure" 这种质疑打退——他们只覆盖了 SKILL.md 这半边
- **理论锚点**：`docs/CN-001-tool-scoped-progressive-disclosure.md`
  - 学术化 / 可引用版本
  - 对外叙事（PHILOSOPHY.md）是它的 public-facing 包装
  - L1–L4 对外重命名为 C1–C4（Contract / Handshake / Voice / Judgment），层号保留用于引用
- **Hero tagline**：**"Your CLI is mute. That's half your prompt problem."**
- **项目口号**：**"Make your CLI talk back."**（暗含 agent autonomy 彩蛋，不显式解释）

---

## 已落盘文件

| 文件 | 受众 | 目的 |
|---|---|---|
| `README.md` | 划走党（30 秒判断是否继续读） | Hero tagline + 状态 + 指向 PHILOSOPHY |
| `PHILOSOPHY.md` | 认同党（愿意读 8 分钟的开发者） | 完整方法论：4 channels / 4 rules / budget / anti-patterns |
| `docs/CN-001-*.md` | 引用党（写博客 / 论文时要引用的人） | 学术化理论锚点，英文 + 去 Life-Index 化 |
| `HANDOFF.md` | 自己 / 搭档 | 本文件，冷启动备忘 |

---

## 未决问题（下一次 session 的起点候选）

### 叙事 / 文案层

1. **Hero 段落的最终打磨**：当前是 Version A 直接搬运，还可以再紧 1-2 轮
2. **§6 反模式的辛辣度**：写得偏学术，传播性会打折扣，需要加自嘲和狠话（参考 "Works on my machine" 这类 meme 的语气）
3. **§7 Related Work 的引用链接**：Anthropic skills progressive disclosure / MCP structuredContent 规范 / ReAct 原论文——都应加具体 URL
4. **Example 多样化**：PHILOSOPHY.md 目前只有 "journal search tool" 一个匿名例子，需要 1-2 个不同 domain 的例子（否则会被读者认为是某人的私货）
   - 候选：file-search CLI、API-call tool、code-review tool

### 工具层（`talking-cli` linter）

5. **Linter 规则映射**：§5 四条 heuristic 各自对应一个 lint 规则，但**具体检测逻辑**未设计
   - Heuristic 1 (`SKILL.md ≤ 150 lines`)：怎么算？含还是不含代码块、frontmatter？
   - Heuristic 2（error/zero-result 必须带 hint）：怎么静态检测？需要解析 tool source？还是跑测试看 response？
   - Heuristic 3（单次 response ≤ 3 hints）：看 schema 还是看实际运行？
   - Heuristic 4（SKILL.md 和 hint 不得重复）：字符串相似度？LLM 判断？
6. **Linter 输出格式**：类似 `eslint` 的行级 warning？还是整份评分报告？
   - 个人倾向：带分数的整份报告（有传播性），外加可选的 `--strict` CI 模式
7. **Linter 技术栈**：Python / Node / Go？考虑 agent skill 作者人群主要用什么
   - 目前直觉：Node（`npx talking-cli` 是低摩擦入口）
8. **Demo 项目**：为了 README 好看，需要一个"把某个真实 SKILL.md 从 400 行瘦到 80 行"的对照案例

### 战略层

9. **License**：MIT / Apache 2.0 / CC BY 4.0（如果只做文档）
10. **首发渠道**：
    - GitHub 单仓（当前路径）
    - 配一篇博客（往哪里发？Hacker News / Twitter / Anthropic 社区？）
    - 要不要提前发 RFC 给 Anthropic / MCP 社区？
11. **社区反馈循环**：GitHub Issues 开放讨论还是暂时关闭？
12. **作者身份**：用真名还是 handle？是否需要个人 landing page 配合？

### 理论 / 研究层

13. **"Prompt Surface Budget" 的量化研究**：有没有可能做一个实证 benchmark——同一个 agent，SKILL.md 重 vs tool hints 重，哪个 task success rate 更高？
    - 如果能做出来，这是 blog / paper 级别的杀手锏
14. **跨 agent framework 的适用性**：在 Cursor / Continue / Aider / OpenHands 这类 agent 上验证一遍，避免被指"只在 Claude Code 上成立"

---

## 关键决策记录

- **不在主文档首屏教 "agent-native vs agent-first"**
  - 该二分法语音 / 语义不够锋利；作为内部脚手架保留，不作为对外主承重梁
- **"Make your CLI talk back." 作为全项目口号**
  - 同时暗示"回话"和"反驳"，后者是 agent autonomy 彩蛋
- **漏斗结构**：README → PHILOSOPHY → CN-001，分别对应三类读者
- **~~哲学命名 vs 工具命名分层~~**：原方案 Talking CLI（运动）+ `talkback`（CLI）已于 2026-04-18 推翻，统一为 `talking-cli`

---

## 下一次 session 建议第一件事

**不要先改文档。**

先做两件事里的一件：

A. **用 Version A + Version B 两套 tagline 做小范围 A/B 测试**
   - 找 2-3 个 agent skill 开发者朋友（不要 AI 研究员），让他们读两版
   - 问："哪一版让你更想继续看下去？"
   - 哪版胜就以哪版为 README 首屏

B. **动手做 linter MVP**
   - 只实现 Heuristic 1（`SKILL.md ≤ 150 lines`）+ Heuristic 2（zero-result 路径检测）
   - 跑在 Anthropic 官方 skill 样例上，看能不能立刻输出有料的 warnings
   - 如果跑出来第一条报告让你自己笑出声，就说明这个工具会传播

**避免的陷阱**：
- 命名焦虑——名字命中率由 demo 决定，不由名字本身决定（这也是放弃 `talkback` 改用 `talking-cli` 的底层逻辑）
- 文档完美主义（"PHILOSOPHY.md 要不要再加两节？"）——当前版本已经"够用于对话"，继续雕琢边际收益递减
- 无限 related work 搜索——已经列了四项关键对手术语，够了，更多只会拖延发布

---

## 来源追溯

这套想法起源于 `D:\Loster AI\Projects\life-index` 的 Round 10 终审（`.strategy/cli/Round_10_Final_Review.md`）。那一轮的结论是："搜索质量不再只是 retrieval tuning 的问题，而是需要一个新的 agent/tool 协作边界。"

CN-001 是对那个结论的概念化。Talking CLI 是 CN-001 的对外叙事。`talking-cli` CLI 是 Talking CLI 的落地载体。

原 session 中关于 "agent-native vs agent-first" 的讨论最终没有进入主叙事——结论是该二分法不够锋利，作为内部理解保留即可。

原 session 中关于 "prompt loop" 的命名候选被否决——"prompt loop" 描述了机制，没描述痛；"Talking CLI" 描述了姿态，承载了 "mute" 的反面，更具传播力。
