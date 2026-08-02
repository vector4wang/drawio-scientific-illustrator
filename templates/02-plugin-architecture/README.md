# 02 - Plugin Architecture (v1.2.0)

Draw.io Scientific Illustrator 自身的架构图。重点展示 1.2.0 重构后的精简版结构。

## 五层架构（自上而下）

| 层 | 内容 | 颜色 |
|---|---|---|
| ① USER | 用户 / 开发者 (umlActor) | 深色 |
| ② AI HOST | Codex Desktop + Claude Code CLI | 紫 |
| ③ PLUGIN SKILL | drawio-live (Codex + Claude Code 两版) | 绿 |
| ④ MCP SERVERS | drawio-live (20 工具) + drawio-file-utils (5 工具) | 橙 |
| ⑤ DRAW.IO DESKTOP | Electron app + localhost:9333 | 红 |
| ⑥ LIVE LOOP | search → launch → add → screenshot → save → export | 中性 |

## 重构前后的对比

| 维度 | 1.0.0 / 1.1.0 | 1.2.0 (本图) |
|---|---|---|
| file-utils 工具数 | 9 | **5** (status / validate / inspect / update_cells / export) |
| install 脚本 | 4 个 | **2 个** (install.sh / install.ps1, 各自检测双 host) |
| Skill 数量 | 2 (drawio-live + recreate) | **1** (drawio-live, 双宿主共享内容) |
| 仓库总行数 | ~3,141 | **~2,788** (-11%) |

## 使用

- 看图：直接打开 `template.drawio` 在 draw.io 中查看完整效果
- 用作模板：把整图作为新项目的"项目结构讲解图"使用
- 修改：用 `/drawio-live` 加上"在 MCP 服务器层加一个 monitoring 工具"等指令即可

## 文件

- `template.drawio` — 完整可编辑源文件 (59 cells, 0 errors)
- `template.png` — 2000×1500 嵌入式预览图 (598 KB)
