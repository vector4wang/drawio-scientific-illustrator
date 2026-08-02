---
name: drawio-live
description: Draw diagrams live in the visible draw.io desktop canvas from a text description, using draw.io's own graph API through a localhost-only MCP server. Use when the user wants to watch an architecture diagram, flowchart, network diagram, sequence/process diagram, or any visualization appear shape by shape in draw.io. Trigger phrases: "draw a diagram", "create a flowchart", "画出", "绘制", "用 draw.io", "architecture diagram", "/drawio-live". Output: editable .drawio + PNG/SVG/PDF.
version: 1.2.0
allowed-tools: mcp__drawio-live__*,mcp__drawio-file-utils__*
---

# Draw Diagrams Live in draw.io

Shapes, labels, connectors, and styling appear in the visible canvas in real time. Save as `.drawio` only when the live drawing is complete.

## Hard boundary (NEVER violate)

- Control only draw.io's internal graph API through the live MCP server.
- Never use OS mouse / keyboard / screen automation.
- Never pre-generate XML and then "open" it as the drawing method.
- Renderer screenshots are allowed only to inspect the draw.io canvas itself.

## Design tokens (mandatory constants)

```yaml
canvas_width: 1700              # standard page width
grid_unit: 8                    # all coordinates snap to multiples of 8
stroke_width: 1.5               # default edge/card stroke
stroke_thin: 1                  # dashed / secondary edges
stroke_bold: 2.5                # emphasis edges (data flow into draw.io)
corner_radius: 8                # all rounded cards
font_title: 22px Bold           # title
font_section: 11px SemiBold     # layer / section labels
font_card: 14px Bold            # card title
font_desc: 11px Regular         # card description
font_meta: 10px Regular         # metadata / category list
font_footer: 9px Italic         # footer line
```

## Pre-drawing analysis (DO THIS FIRST, in your head, before any tool call)

1. **Identify 3-6 layers** in the request (e.g. Edge → VPC → Subnets → Cross-cutting).
2. **For every component, pick a category** from the 7 below — this drives its color and shape.
3. **Decide if a cloud-specific stencil exists** (search for `aws`, `azure`, `gcp`, `kubernetes`, `bpmn`, `cisco` in `drawio_live_search_shapes`). If yes → use it. If no → fall back to a semantic basic shape (cylinder / diamond / cloud / rounded).
4. **Plan canvas height** = `200 + 180 × layers + 100` (cap at 2200). Width is always 1700.

## Color → category mapping (the only 7 colors you may use)

| Category | Fill (12 % tint) | Stroke (full) | Stripe (full) | When |
|---|---|---|---|---|
| Network / Edge | `#F3EBFF` | `#8C4FFF` | `#8C4FFF` | CDN, DNS, LB, gateway, API |
| Compute | `#FFF1E5` | `#ED7100` | `#ED7100` | EC2, ECS, EKS, Lambda, VM |
| Data | `#E8EBFD` | `#3B48CC` | `#3B48CC` | RDS, ElastiCache, S3, DB, queue |
| Storage | `#F2F3F3` | `#7D8998` | `#7D8998` | Object storage, backup, archive |
| Security | `#FCE8EB` | `#DD344C` | `#DD344C` | WAF, Shield, IAM, Vault, Cognito |
| Operations | `#E6F8F4` | `#01A88D` | `#01A88D` | CloudWatch, monitoring, logging |
| Integration | `#FCE4F0` | `#E7157B` | `#E7157B` | SES, SQS, SNS, EventBridge, API GW |

**Layer backgrounds** (sub-bands inside a dashed parent) may use the same fill at lower opacity or none.

## Shape → semantic role mapping (in priority order)

1. **Exact cloud stencil** (AWS / Azure / GCP / Cisco / Kubernetes) — search first, use immediately.
2. **Semantic icon** — `shape=umlActor` (user), `shape=cylinder3` (DB), `shape=cloud` (external system), `mxgraph.bootstrap.user` (person).
3. **BPMN/flowchart** — `bpmn.task`, `bpmn.gateway`, `shape=diamond` (decision), `shape=parallelogram` (I/O), `shape=ellipse` (start/end).
4. **Generic rounded** — last resort only.

**Cloud stencil naming**: `mxgraph.aws4.cloudfront`, `mxgraph.aws4.rds`, `mxgraph.azure.sql_database`, `mxgraph.gcp.cloud_run`, `mxgraph.kubernetes.pod`, `mxgraph.cisco.routers.router`.

## Stencil usage rules (AWS / Azure / GCP)

Always include these style keys together:

```yaml
sketch: 0           # no sketchy hand-drawn look
outlineConnect: 0   # don't connect icon outline to label
html: 1
dashed: 0
fillColor: <brand>   # full color, e.g. #FF9900 for CloudFront
strokeColor: #232F3E # dark neutral outline
verticalLabelPosition: bottom
labelPosition: center
align: center
verticalAlign: top
fontSize: 12
fontStyle: 1         # bold
```

**Do NOT add a separate text cell** describing the icon — the stencil shows the name itself. Adding text next to the icon causes the "ALBApplication Load Balancer" truncation bug.

## Layout grammar

- **Title** at y=40, **subtitle** at y=78, single left-aligned line each.
- **Layer band**: 22-px label at top-left inside a dashed border (e.g. `② VPC · 10.0.0.0/16`). Band height = `180 × cards_in_band + 40`.
- **Card sizes** (use these, not ad-hoc):
  - Standard: 240 × 80
  - Wide (single-service per row): 480 × 80
  - Tall (data tier, three-card row): 200 × 120
  - Edge services: 280 × 100
- **Card top stripe**: solid 4 px, full card width, category color.
- **Card icon cell**: positioned 8 px below the stripe, 220 × 60 inside a 240 × 80 card, centered.
- **Footer**: one line at y = pageHeight − 60, 9 px italic gray, centered.

## Edge rules

- **Default**: stroke matches the source category color, 1.5 px, solid, arrow classic.
- **Emphasis** (e.g. → draw.io desktop): 2.5 px solid.
- **Secondary / monitoring / replication**: dashed `6 3`, 1.5 px.
- **Label**: 10 px, fontColor = source category, labelBackgroundColor = `#FFFFFF`.
- **Always orthogonal** (`edgeStyle=orthogonalEdgeStyle`).
- **Do not add protocol labels** ("HTTPS:443", "SQL:3306") on every edge — they clutter. Reserve labels for cross-section crossings.

## Work sequence (the actual tool call order)

```
1. drawio_live_launch      file_path=<user's .drawio or new>, step_delay_ms=350
2. drawio_live_status      require graph_ready=true
3. if vertices > 0:
     drawio_live_add_page  name="Figure N"
     drawio_live_switch_page
4. drawio_live_search_shapes  for every distinct component (1 call per category keyword)
5. drawio_live_draw_sequence  title + subtitle
6. drawio_live_draw_sequence  layer band: label + dashed outer
7. drawio_live_draw_sequence  cards in this band (box + stripe + icon, 1 call each)
8. drawio_live_screenshot     # review the rendered band
9. drawio_live_draw_sequence  edges between bands
10. drawio_live_fit            # keep the evolving figure in view
11. drawio_live_save_snapshot  output_path=<absolute .drawio path>
12. drawio_validate           # check the saved file
13. drawio_export              format=png, width=2000, embed=true
14. drawio_export              format=svg, embed=true   # optional deliverable
```

Run steps 5-9 in paced `draw_sequence` calls (each op a separate model update, with `step_delay_ms` ≥ 280). Run `screenshot` after each logical band, not after every cell.

## Anti-patterns (NEVER do these)

- ❌ Text + AWS stencil side by side → label is duplicated and truncated. Set `label=""` on the icon cell and let the stencil show its own name.
- ❌ `fillColor="#FFFFFF"` on every service card → defeats the category color system. Use the 12 % category tint.
- ❌ 5-10 lines of "spec" text crammed inside a card → unreadable. Keep cards to icon + 1 optional line.
- ❌ Random stroke widths (1, 1.5, 2, 2.5, 3 mixed) → commit to 1.5 / 2.5 / dashed.
- ❌ Mixed fonts and sizes → use the scale above; nothing else.
- ❌ Dashed edges where solid is meant (or vice versa) → data flow = solid, monitoring / replication = dashed.
- ❌ `drawio_live_clear` on a canvas that already has user content → use `add_page` + `switch_page` instead.
- ❌ Pre-building XML and opening it as the deliverable → `save_snapshot` must serialize the *visible* graph.
- ❌ Saving over an existing file the user did not explicitly authorize → prompt first, or write to `<filename>-v2.drawio`.
- ❌ Using `drawio_create_diagram` or `drawio_write_xml` — those tools were removed in 1.2.0. Use the live MCP.

## Validation checklist (run before reporting done)

- [ ] All cards use one of the 7 category fills, never pure white.
- [ ] All text uses one of: 22 / 14 / 11 / 10 / 9 px.
- [ ] Stencil labels are not duplicated by a separate text cell.
- [ ] No `fillColor="#FFFFFF"` on service cards.
- [ ] All edges are either solid 1.5 / 2.5 or dashed `6 3` 1.5.
- [ ] Page is wider than 1600 and under 2200 tall.
- [ ] Footer line is present and centered.
- [ ] `drawio_validate` reports 0 errors, 0 warnings.

## Example prompts

```
/drawio-live 画一个 AWS 三层 Web 架构,VPC 双 AZ,标注 EC2 / ECS / RDS / ElastiCache
/drawio-live create a flowchart for user signup: form → email verify → welcome
/drawio-live draw a Kubernetes deployment: ingress → service → 3 pods → PVC
```
