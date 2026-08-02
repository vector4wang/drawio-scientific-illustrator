# Draw.io Scientific Illustrator

[中文说明](#中文说明) · [English guide](#english-guide) · [MIT License](LICENSE)

> **Forked from** [icebird1998/drawio-scientific-illustrator](https://github.com/icebird1998/drawio-scientific-illustrator) — original author: icebird1998.

An MCP plugin for **Codex** and **Claude Code** that lets an AI agent draw diagrams **live inside the visible draw.io desktop canvas** from your description or requirements. You can watch shapes, labels, arrows, styling, and layout appear step by step. The live workflow calls draw.io's own graph API through a localhost-only MCP server; it does not automate the operating-system mouse or keyboard and does not create XML first and merely open it afterward.

> Status: Windows is tested. macOS and Linux executable discovery is included, but live behavior can vary with draw.io/Electron packaging. Reports and pull requests are welcome.

## English guide

### What this repository contains

- `drawio-live` MCP server: launches/connects to the visible draw.io desktop editor and edits its active graph model in real time.
- `drawio-file-utils` MCP server: validates saved `.drawio` documents and exports PNG, SVG, PDF, or JPG deliverables.
- **Skills**: teach the agent to plan a diagram from your description, decompose it into editable primitives, draw with pacing, visually review sections, refine the live graph, and save only after the visible drawing exists. Available for both Codex and Claude Code:
  - `drawio-live` — draw diagrams from a description via `/drawio-live`
- A repository-local Codex marketplace so the complete plugin can be installed as one unit.
- A root `.mcp.json` so Claude Code can auto-detect the MCP servers when the repository is opened as a project.

This is therefore both an **MCP implementation** and a **multi-host plugin**. MCP provides the callable tools; the plugin is the installable package containing the MCP servers, skill, and presentation metadata.

### What's new in 1.2.0

- Refocused on **drawing from a description** (via the `drawio-live` skill). The old "recreate from a reference image" skill has been removed.
- Added a production-ready template at [`templates/01-aws-3tier-webapp/`](templates/01-aws-3tier-webapp/template.drawio) — a multi-AZ AWS reference architecture that demonstrates the design system (AWS stencils, category color blocks, dashed boundaries, no in-card text).
- Sample outputs from prior sessions are kept under [`examples/`](examples/) for reference.

### Requirements

1. Codex desktop app or Codex CLI with plugin support; **and/or** Claude Code CLI.
2. [draw.io desktop](https://www.drawio.com/) installed locally.
3. Git.
4. Node.js available as `node` when running the MCP servers outside the bundled Codex runtime. Node.js 22 or newer is recommended.

The plugin auto-detects common draw.io locations on Windows, macOS, and Linux. For a custom installation, set `DRAWIO_PATH` to the executable before starting Codex.

### Install — easiest methods

#### Ask Codex to install it

Paste this into a Codex task that has terminal access:

```text
Install the public Codex plugin from https://github.com/vector4wang/drawio-scientific-illustrator.
Clone it locally, register its repository root as a Codex marketplace, install
drawio-scientific-illustrator@drawio-scientific-tools, then tell me when to restart Codex.
```

#### Windows one-command installer

Review [`install.ps1`](install.ps1), then run:

```powershell
$p="$env:TEMP\drawio-scientific-install.ps1"; Invoke-WebRequest https://raw.githubusercontent.com/vector4wang/drawio-scientific-illustrator/main/install.ps1 -OutFile $p; powershell -ExecutionPolicy Bypass -File $p
```

#### macOS/Linux one-command installer

Review [`install.sh`](install.sh), then run:

```bash
curl -fsSL https://raw.githubusercontent.com/vector4wang/drawio-scientific-illustrator/main/install.sh | bash
```

Restart Codex and start a new task after installation so the new skill and MCP tools are loaded. For Claude Code, open the cloned repository directory as your project.

### Install — manual and auditable

```bash
git clone https://github.com/vector4wang/drawio-scientific-illustrator.git
cd drawio-scientific-illustrator
codex plugin marketplace add "$(pwd)"
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

On PowerShell, replace `"$(pwd)"` with `(Get-Location).Path`:

```powershell
git clone https://github.com/vector4wang/drawio-scientific-illustrator.git
Set-Location drawio-scientific-illustrator
codex plugin marketplace add (Get-Location).Path
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

### Install for Claude Code

The one-command installers above detect Claude Code automatically. If `claude` is on your `$PATH`, the installer copies the skill to `~/.claude/skills/` and the `.mcp.json` at the project root is auto-detected.

#### Manual Claude Code setup

```bash
git clone https://github.com/vector4wang/drawio-scientific-illustrator.git
cd drawio-scientific-illustrator

# Install the skill globally:
mkdir -p ~/.claude/skills/drawio-live
cp claude-code/skills/drawio-live/SKILL.md \
   ~/.claude/skills/drawio-live/SKILL.md

# The .mcp.json at the project root is auto-detected by Claude Code.
```

Then open the cloned repository directory as your Claude Code project.

### How to use it

1. Restart Codex after installation and create a new task (for Claude Code, open the project directory).
2. Describe the diagram you want (architecture, flowchart, network, process, etc.).
3. Mention **Draw.io Scientific Illustrator** or use `/drawio-live` (Claude Code).
4. State the desired pacing and output formats.

> **Recommended Codex configuration for complex diagrams:** choose **GPT-5.6 Sol** and set reasoning effort to **Max**. In Codex settings, enable the six-level reasoning selector first; the default five-level selector does not show the Max option. This setting can increase response time and token use.

Recommended prompt:

```text
Use Draw.io Scientific Illustrator. Launch the live draw.io canvas and draw the
diagram I describe step by step with a 100 ms delay. Control only draw.io's
own graph API; do not use OS mouse/keyboard automation and do not generate XML first.
Keep all labels, arrows, panels, and legends editable. Visually inspect and refine each
section, then save the final .drawio file and export a 2000 px PNG preview.
```

### Using a template

1. Open the template's `.drawio` file in draw.io (for example, `templates/01-aws-3tier-webapp/template.drawio`).
2. From Claude Code: `/drawio-live extend this template with a Lambda function for image resizing between CloudFront and the ALB`.
3. From Codex: select **Draw.io Scientific Illustrator** and describe the change.
4. The agent will launch the live canvas, add the requested shape with the same fill / stroke / icon conventions, and prompt you before saving. See [`templates/README.md`](templates/README.md) for the full design system used by the templates.

Chinese prompts work equally well:

```text
使用 Draw.io Scientific Illustrator。启动实时 draw.io，以 100 ms 的步骤间隔逐步绘制
我描述的图。必须直接控制 draw.io 画布，不要使用系统鼠标键盘控制，也不要先生成
XML。文字、箭头、分区和图例都要可编辑；完成后保存 .drawio 并导出 2000 px PNG。
```

### How to use it with Claude Code

1. Open the cloned repository directory as your Claude Code project.
2. Describe the diagram you want (architecture, flowchart, network, process, etc.).
3. All MCP tools (`drawio_live_*`, `drawio_validate`, `drawio_export`, etc.) and the `drawio-live` skill are available automatically.

```text
Launch the live draw.io canvas and draw the diagram I describe step
by step with a 400 ms delay. Control only draw.io's own graph API; do not use OS
mouse/keyboard automation and do not generate XML first. Keep all labels, arrows,
panels, and legends editable. Visually inspect and refine each section, then save
the final .drawio file and export a 2000 px PNG preview.
```

### Live tool workflow

The agent normally uses the tools in this order:

1. `drawio_live_search_shapes` — search for specialized stencil shapes (AWS, Azure, GCP, Network, BPMN, etc.).
2. `drawio_live_launch` — launch or connect to a visible draw.io editor.
3. `drawio_live_status` — confirm that the graph is ready.
4. `drawio_live_add_shape`, `drawio_live_add_edge`, or paced `drawio_live_draw_sequence` — construct editable content visibly.
5. `drawio_live_screenshot` — inspect the draw.io renderer after logical sections.
6. `drawio_live_inspect` and `drawio_live_update_cell` — correct labels, styles, positions, and sizes.
7. `drawio_live_delete_cells` — remove specific cells by id (with safety confirmation).
8. `drawio_live_undo` / `drawio_live_redo` — undo/redo editing operations.
9. `drawio_live_list_pages` / `drawio_live_add_page` / `drawio_live_switch_page` — multi-page document support.
10. `drawio_live_fit` — keep the evolving figure in view.
11. `drawio_live_save_snapshot` — serialize the already-visible graph to `.drawio`.
12. `drawio_validate` and `drawio_export` — validate and export deliverables.

### Configuration

Optional environment variables:

| Variable | Purpose | Default |
|---|---|---|
| `DRAWIO_PATH` | Explicit draw.io executable path | Auto-detected |
| `DRAWIO_LIVE_PORT` | Preferred localhost debugging port | `9333`; a nearby free port is selected when needed |
| `DRAWIO_LIVE_PROFILE` | Dedicated draw.io/Electron profile directory | `~/.drawio-live-mcp/<port>` |

Example on Windows:

```powershell
$env:DRAWIO_PATH = "D:\Apps\draw.io\draw.io.exe"
```

### Update

Run the same installer again. It performs a fast-forward `git pull` and reinstalls the plugin. Restart Codex and start a new task afterward. For Claude Code, re-open the project directory so the updated `.mcp.json` and skill are picked up.

### Troubleshooting

- **`node` not found**: install Node.js 22+ or make sure the Codex runtime exposes Node to plugin MCP servers.
- **draw.io not found**: install the desktop app or set `DRAWIO_PATH`.
- **Port already in use**: omit an explicit port and the server will select a nearby localhost port, or set `DRAWIO_LIVE_PORT` to a free port.
- **Graph not ready**: close stale draw.io windows launched by the plugin, retry, and ensure the desktop app accepts Electron remote-debugging flags.
- **Plugin not visible**: restart Codex and create a new task after installation.
- **MCP tools not visible in Claude Code**: make sure you opened the cloned repository directory as your Claude Code project. The `.mcp.json` must be at the project root.
- **Export fails**: confirm that draw.io desktop can export the same file manually and that the output directory is writable.

### Security and privacy

- The live debugging endpoint binds to `127.0.0.1`, not a public network interface.
- Target discovery accepts only pages identified as draw.io/diagrams.net; it does not attach to arbitrary browser pages.
- The plugin does not use OS-level mouse or keyboard automation.
- No telemetry or hosted backend is included. See [PRIVACY.md](PRIVACY.md).
- Only install software from repositories and revisions you trust. Review the installer scripts before executing them.

### Known limitations

- The live API currently emphasizes editable draw.io primitives. Dense microscopy images, photographs, heatmaps, and complex plots may need a future dedicated live image-insertion operation.
- Visual fidelity depends on how well the requested content can be represented by draw.io primitives.
- Windows is the tested platform; macOS/Linux support is best effort until community testing expands.

---

## 中文说明

### 这是什么

> **Fork 自** [icebird1998/drawio-scientific-illustrator](https://github.com/icebird1998/drawio-scientific-illustrator) — 原始作者：icebird1998。

Draw.io Scientific Illustrator 是一个 MCP 插件，同时支持 Codex 和 Claude Code。它会启动桌面版 draw.io，根据你的描述或需求，通过仅限本机的 MCP 通道直接调用 draw.io 自身的图模型 API 绘制图。你可以亲眼看到形状、文字、箭头、配色和布局按步骤出现在画布上。

它不会模拟系统鼠标或键盘，也不会先生成一个 XML 文件再让 draw.io 打开。只有当可见画布中的图已经绘制完成后，才会把当前图模型保存为 `.drawio` 文件。

这个仓库同时包含：

- 实时控制 draw.io 画布的 `drawio-live` MCP；
- 校验和导出的 `drawio-file-utils` MCP；
- 指导 AI 根据描述绘制、检查和迭代图的 Skill（同时提供 Codex 和 Claude Code 版本）：
  - `drawio-live` — 根据你的描述逐步绘制
- 可供 Codex 安装的自定义插件市场配置；
- 项目根目录的 `.mcp.json`，供 Claude Code 自动发现 MCP 服务器。

所以它既”属于 MCP”，也属于更上层的”多宿主插件”：MCP 是实际工具接口，插件是把 MCP、Skill 和界面元数据打包分享的安装单位。

### 安装要求

1. 支持插件的 Codex 桌面应用或 Codex CLI；**和/或** Claude Code CLI；
2. 本机已安装 [draw.io 桌面版](https://www.drawio.com/)；
3. Git；
4. 如果脱离 Codex 自带运行环境单独启动 MCP，需要可用的 Node.js，推荐 Node.js 22 或更高版本。

插件会自动检测 Windows、macOS 和 Linux 的常见 draw.io 安装位置。若安装在自定义目录，请在启动 Codex 前设置 `DRAWIO_PATH`。

### 最省事的安装方式

在一个具备终端权限的 Codex 任务里直接粘贴：

```text
请安装这个公开 Codex 插件：https://github.com/vector4wang/drawio-scientific-illustrator。
把仓库克隆到本地，将仓库根目录注册为 Codex Marketplace，然后安装
drawio-scientific-illustrator@drawio-scientific-tools。完成后告诉我何时重启 Codex。
```

Windows 用户也可以先检查 [`install.ps1`](install.ps1)，然后运行：

```powershell
$p="$env:TEMP\drawio-scientific-install.ps1"; Invoke-WebRequest https://raw.githubusercontent.com/vector4wang/drawio-scientific-illustrator/main/install.ps1 -OutFile $p; powershell -ExecutionPolicy Bypass -File $p
```

macOS/Linux 用户先检查 [`install.sh`](install.sh)，然后运行：

```bash
curl -fsSL https://raw.githubusercontent.com/vector4wang/drawio-scientific-illustrator/main/install.sh | bash
```

安装完成后必须重启 Codex 并新建一个任务，使新的 Skill 和 MCP 工具被载入。对于 Claude Code，将克隆目录作为项目打开即可。

### 手动安装

PowerShell：

```powershell
git clone https://github.com/vector4wang/drawio-scientific-illustrator.git
Set-Location drawio-scientific-illustrator
codex plugin marketplace add (Get-Location).Path
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

macOS/Linux：

```bash
git clone https://github.com/vector4wang/drawio-scientific-illustrator.git
cd drawio-scientific-illustrator
codex plugin marketplace add "$(pwd)"
codex plugin add drawio-scientific-illustrator@drawio-scientific-tools
```

### Claude Code 安装方式

上述一键安装脚本会自动检测 Claude Code。如果 `claude` 命令可用，安装脚本会将 Skill 复制到 `~/.claude/skills/`，项目根目录的 `.mcp.json` 会被自动识别。

#### 手动安装（Claude Code）

```bash
git clone https://github.com/vector4wang/drawio-scientific-illustrator.git
cd drawio-scientific-illustrator

# 安装 Skill 到全局目录：
mkdir -p ~/.claude/skills/drawio-live
cp claude-code/skills/drawio-live/SKILL.md \
   ~/.claude/skills/drawio-live/SKILL.md

# 项目根目录的 .mcp.json 会被 Claude Code 自动发现。
```

然后将克隆目录作为 Claude Code 项目打开。

### 使用方法

1. 重启 Codex 并新建任务（Claude Code 则将克隆目录作为项目打开）；
2. 描述你想要的图（架构图、流程图、网络图、时序/流程图等）；
3. 在输入框选择或提到 **Draw.io Scientific Illustrator**，或使用 `/drawio-live`（Claude Code）；
4. 说明绘制步进间隔、画面尺寸和希望导出的格式。

> **复杂图绘制建议的 Codex 设置：**选择 **GPT-5.6 Sol**，并将推理等级设为 **“最高（Max）”**。需要先在 Codex 设置中开启 **6 档推理等级**；默认的 **5 档**选择器不会显示“最高”选项。该设置可能增加响应时间和 token 用量。

推荐提示词：

```text
使用 Draw.io Scientific Illustrator。启动实时 draw.io，以 100 ms 的步骤间隔逐步绘制
我描述的图。必须直接控制 draw.io 自己的画布 API，不要控制系统鼠标键盘，也不要先
生成 XML。所有文字、箭头、分区、图例都要保持可编辑。每完成一个逻辑区域就检查并
修正，最后保存 .drawio，并导出宽度为 2000 px 的 PNG 预览图。
```

### 使用模板

1. 在 draw.io 中打开模板文件，例如 `templates/01-aws-3tier-webapp/template.drawio`。
2. Claude Code：`/drawio-live 在 CloudFront 和 ALB 之间增加一个用于图片缩放的 Lambda 函数`。
3. Codex：选择 **Draw.io Scientific Illustrator**，用自然语言描述修改。
4. Agent 会启动实时画布，按统一的填色 / 描边 / 图标规则新增形状，并在保存前与你确认。完整设计规范见 [`templates/README.md`](templates/README.md)。

### Claude Code 使用方式

1. 将克隆的仓库目录作为 Claude Code 项目打开。
2. 描述你想要的图（架构图、流程图、网络图、时序/流程图等）。
3. 所有 MCP 工具（`drawio_live_*`、`drawio_validate`、`drawio_export` 等）和 `drawio-live` Skill 会自动可用。

```text
启动实时 draw.io，以 400 ms 的步骤间隔绘制我描述的图。必须直接控制 draw.io 画布，
不要使用系统鼠标键盘控制，也不要先生成 XML。文字、箭头、分区和图例都要可编辑；
完成后保存 .drawio 并导出 2000 px PNG。
```

### 工作过程

正常情况下，AI 代理会依次完成：

1. 启动可见的 draw.io；
2. 确认内部 graph 已就绪；
3. 逐个或按设定间隔添加可编辑形状和连线；
4. 每完成一个逻辑区域截取 draw.io 渲染区域进行检查；
5. 直接在实时画布中修改文字、样式、位置和大小；
6. 完成后才保存 `.drawio` 快照；
7. 校验文件结构并导出 PNG、SVG、PDF 或 JPG。

### 可选配置

| 环境变量 | 作用 | 默认值 |
|---|---|---|
| `DRAWIO_PATH` | 指定 draw.io 可执行文件 | 自动检测 |
| `DRAWIO_LIVE_PORT` | 首选本机调试端口 | `9333`，冲突时自动寻找附近端口 |
| `DRAWIO_LIVE_PROFILE` | draw.io/Electron 独立用户目录 | `~/.drawio-live-mcp/<端口>` |

Windows 示例：

```powershell
$env:DRAWIO_PATH = "D:\Apps\draw.io\draw.io.exe"
```

### 更新

再次运行安装脚本即可。脚本会执行安全的快进更新并重新安装插件。随后重启 Codex、新建任务。对于 Claude Code，重新打开项目目录即可加载更新后的 `.mcp.json` 和 Skill。

### 常见问题

- **找不到 Node**：安装 Node.js 22+，或确认 Codex 插件运行环境能够调用 `node`。
- **找不到 draw.io**：安装桌面版，或者设置 `DRAWIO_PATH`。
- **端口被占用**：不要强制指定端口，让插件自动选择；也可以修改 `DRAWIO_LIVE_PORT`。
- **图模型没有就绪**：关闭插件此前启动但已失效的 draw.io 窗口后重试。
- **安装后看不到插件**：重启 Codex，并新建任务。
- **Claude Code 中看不到 MCP 工具**：确认已将克隆目录作为 Claude Code 项目打开，且 `.mcp.json` 在项目根目录。
- **导出失败**：确认 draw.io 桌面版可以手工导出该文件，并检查输出目录写权限。

### 安全与隐私

- 实时调试端口仅绑定 `127.0.0.1`；
- 只接受可识别为 draw.io/diagrams.net 的页面，不会连接任意浏览器页面；
- 不使用系统级鼠标键盘自动化；
- 不包含遥测或云端服务，详见 [PRIVACY.md](PRIVACY.md)；
- 执行远程安装脚本前，请先检查脚本内容和版本。

### 当前限制

- 实时工具目前主要面向可编辑的 draw.io 图元。显微照片、热图和复杂数据图可能需要后续增加专门的实时图片插入工具；
- 最终呈现效果取决于所需内容是否适合用 draw.io 图元表达；
- 当前已在 Windows 上测试，macOS/Linux 暂为尽力支持，欢迎提交测试反馈。

## Contributing / 参与贡献

Issues and pull requests are welcome. Please include operating system, draw.io version, Codex or Claude Code version, reproduction steps, and relevant MCP error text. Do not upload confidential reference images.

欢迎提交 Issue 和 Pull Request。请注明操作系统、draw.io 版本、Codex 或 Claude Code 版本、复现步骤及相关 MCP 错误；不要上传保密的参考图片。

## License

MIT © 2026 [vector4wang](https://github.com/vector4wang)
