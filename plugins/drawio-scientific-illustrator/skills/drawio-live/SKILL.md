---
name: drawio-live
description: Draw diagrams live in the visible draw.io desktop canvas from a text description, using draw.io's own graph API through a localhost-only MCP server. Use when the user wants to watch an architecture diagram, flowchart, network diagram, sequence/process diagram, or any visualization appear shape by shape in draw.io. Trigger phrases: "draw a diagram", "create a flowchart", "画出", "绘制", "用 draw.io", "architecture diagram", "/drawio-live". Output: editable .drawio + PNG/SVG/PDF.
version: 1.3.0
allowed-tools: mcp__drawio-live__*,mcp__drawio-file-utils__*
---

# Draw Diagrams Live in draw.io

Each shape, label, and connector appears in the visible canvas in real time. Adapt the layout, color palette, and density to the project — do not force a fixed template.

## Hard boundary (NEVER violate)

- Control only draw.io's internal graph API through the live MCP server.
- Never use OS mouse / keyboard / screen automation.
- Never pre-generate XML and then "open" it as the drawing method.
- Renderer screenshots are allowed only to inspect the draw.io canvas itself.

## Step 1: Choose a layout (BEFORE any tool call)

Pick the layout that fits the project. Use the first one that matches.

| Project shape | Layout | When |
|---|---|---|
| Multi-tier system (5-7 layers) | **Vertical stack** with banded sections | Microservices, MCP, layered apps |
| Pipeline / data flow / user journey | **Horizontal flow** left → right | CI/CD, ETL, request lifecycle |
| Central service with N dependents | **Hub-and-spoke** | API gateway, plugin host, message broker |
| Comparison / matrix | **2-D matrix** with axes | A vs B, before/after, options |
| Hierarchy / org / taxonomy | **Tree** top-down | Org chart, classification, file tree |
| Time-based / sequence | **Timeline** horizontal | Release roadmap, evolution, phases |
| Business process | **BPMN pool + lanes** | Workflow approvals, incident response |

If two layouts fit, prefer the one that matches the project's natural reading direction (top-to-bottom for stacks, left-to-right for flows).

## Step 2: Choose a palette

Default palette (7 semantic categories, generic projects):

| Category | Fill | Stroke | When |
|---|---|---|---|
| Edge / Network | `#F3EBFF` | `#8C4FFF` | CDN, DNS, LB, gateway |
| Compute | `#FFF1E5` | `#ED7100` | EC2, ECS, Lambda, VM |
| Data | `#E8EBFD` | `#3B48CC` | RDS, cache, DB, queue |
| Storage | `#F2F3F3` | `#7D8998` | Object storage, backup |
| Security | `#FCE8EB` | `#DD344C` | WAF, IAM, vault |
| Operations | `#E6F8F4` | `#01A88D` | Monitoring, logging |
| Integration | `#FCE4F0` | `#E7157B` | SES, SQS, SNS, EventBridge |

**Override when the project implies a theme**:
- AWS-heavy → use AWS official colors (`#FF9900` for compute, `#7D8998` for storage, etc.) plus the AWS stencil library.
- GCP-heavy → use GCP blues (`#4285F4`, `#34A853`).
- Azure-heavy → use Azure blues (`#0078D4`, `#50E6FF`).
- Kubernetes-heavy → use `#326CE5` as the primary brand color.
- User supplies a brand color → derive: 12% tint of brand for fill, brand for stroke.
- Editorial / scientific / academic → drop the 7-category palette entirely; use 1-2 neutral grays + 1 accent.

## Step 3: Pick a density

| Component count | Card size | Spacing | Edge label |
|---|---|---|---|
| ≤ 8 | 280 × 100 (large) | 40 px gaps | Every edge |
| 9-20 | 240 × 80 (standard) | 24 px gaps | Only cross-section edges |
| 21-40 | 200 × 80 (compact) | 16 px gaps | None |
| > 40 | 160 × 60 + matrix layout | 8 px gaps | None |

If the project mixes 2-3 scales, use the medium density for the body and group large components (e.g. central service) as oversized anchors.

## Step 4: Default tokens (override when the project needs something else)

```yaml
canvas_width: 1700            # reduce to 1400 for narrow projects (e.g. single-tier)
grid_unit: 8                  # all coordinates snap to multiples of 8
stroke_default: 1.5
stroke_emphasis: 2.5
stroke_thin: 1
corner_radius: 8
font_title: 22px Bold
font_section: 11px SemiBold
font_card: 14px Bold
font_desc: 11px Regular
font_meta: 10px Regular
font_footer: 9px Italic
```

**Adjustments** (apply when warranted):
- For dense diagrams (> 30 components), drop `font_card` to 12 px and `font_desc` to 10 px.
- For one-page summary diagrams, bump `font_title` to 28 px.
- For technical / spec diagrams, switch `font_title` to a monospace family.
- For dark-mode exports, swap to a dark background and use lighter fills.

## Step 5: Shape → semantic role

Decision priority (highest → lowest):

1. **Exact cloud stencil** (AWS / Azure / GCP / Cisco / Kubernetes / BPMN) — search first, use immediately.
2. **Semantic icon** — `shape=umlActor` (user), `shape=cylinder3` (DB), `shape=cloud` (external system).
3. **Flowchart shape** — `shape=diamond` (decision), `shape=parallelogram` (I/O), `shape=ellipse` (start/end).
4. **BPMN** — `bpmn.task`, `bpmn.gateway`, `bpmn.pool`, `bpmn.lane`.
5. **Generic rounded** — last resort only.

Cloud stencil naming: `mxgraph.aws4.cloudfront`, `mxgraph.azure.sql_database`, `mxgraph.gcp.cloud_run`, `mxgraph.kubernetes.pod`, `mxgraph.cisco.routers.router`.

## Step 6: Stencil usage (AWS / Azure / GCP)

Apply these style keys together:

```yaml
sketch: 0
outlineConnect: 0
html: 1
dashed: 0
fillColor: <brand>
strokeColor: #232F3E
verticalLabelPosition: bottom
labelPosition: center
align: center
verticalAlign: top
fontSize: 12
fontStyle: 1
```

**Do NOT add a separate text cell** describing the icon — the stencil shows the name itself. Adding text next to the icon causes the "ALBApplication Load Balancer" truncation bug.

## Step 7: Edge rules

- **Default**: stroke matches the source category color, 1.5 px, solid, arrow classic.
- **Emphasis** (e.g. → central service): 2.5 px solid.
- **Secondary / monitoring / replication**: dashed `6 3`, 1.5 px.
- **Label**: 10 px, fontColor = source category, labelBackgroundColor = `#FFFFFF`.
- **Orthogonal** for stack and matrix layouts, **curved** for hub-and-spoke, **straight** for timelines.
- **Skip protocol labels** ("HTTPS:443", "SQL:3306") unless the user explicitly asks for them.

## Step 8: Work sequence (the actual tool call order)

```
1. drawio_live_launch      file_path=<user's .drawio or new>, step_delay_ms=350
2. drawio_live_status      require graph_ready=true
3. if vertices > 0:
     drawio_live_add_page  name="Figure N"
     drawio_live_switch_page
4. drawio_live_search_shapes  for every distinct component (1 call per category keyword)
5. drawio_live_draw_sequence  title + subtitle
6. drawio_live_draw_sequence  outer skeleton (band, hub, lanes, or matrix frame)
7. drawio_live_draw_sequence  components (box + stripe + icon, 1 call each)
8. drawio_live_screenshot     # review the rendered layer
9. drawio_live_draw_sequence  edges
10. drawio_live_fit            # keep the evolving figure in view
11. drawio_live_save_snapshot  output_path=<absolute .drawio path>
12. drawio_validate           # check the saved file
13. drawio_export              format=png, width=2000, embed=true
14. drawio_export              format=svg, embed=true   # optional deliverable
```

## Anti-patterns (NEVER do these)

- ❌ Text + AWS stencil side by side → label is duplicated and truncated. Set `label=""` on the icon cell and let the stencil show its own name.
- ❌ `fillColor="#FFFFFF"` on every service card → use a category tint, or omit (transparent) when the project calls for minimal styling.
- ❌ 5-10 lines of "spec" text crammed inside a card → keep cards to icon + 1 optional line.
- ❌ One fixed layout for every project → choose the layout in Step 1.
- ❌ One fixed palette for every project → choose the palette in Step 2.
- ❌ `drawio_live_clear` on a canvas that already has user content → use `add_page` + `switch_page` instead.
- ❌ Pre-building XML and opening it as the deliverable → `save_snapshot` must serialize the *visible* graph.
- ❌ Saving over an existing file the user did not explicitly authorize → prompt first, or write to `<filename>-v2.drawio`.
- ❌ Using `drawio_create_diagram` or `drawio_write_xml` — those tools were removed in 1.2.0. Use the live MCP.

## Validation checklist (before reporting done)

- [ ] Layout matches the project shape (Step 1 was applied).
- [ ] Palette matches the project theme (Step 2 was applied).
- [ ] Density matches the component count (Step 3 was applied).
- [ ] Stencil labels are not duplicated by a separate text cell.
- [ ] No protocol labels on edges unless the user asked.
- [ ] `drawio_validate` reports 0 errors, 0 warnings.

## Example prompts

```
/drawio-live 画一个 AWS 三层 Web 架构,VPC 双 AZ (vertical stack, AWS palette, density=medium)
/drawio-live 画一个 CI/CD 流水线,代码 push → test → build → deploy (horizontal flow, single accent)
/drawio-live 画一个 API Gateway + 6 个下游服务 (hub-and-spoke, blue palette)
/drawio-live 画 RAG 系统对比 3 种方案 (matrix 2D, editorial palette)
/drawio-live 画 SLO 演进路线 2024 → 2025 → 2026 (timeline, brand color)
```
