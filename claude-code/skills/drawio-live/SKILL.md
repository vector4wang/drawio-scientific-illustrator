---
name: drawio-live
description: "Live draw.io drawing through MCP — real-time shape-by-shape visualization on the visible canvas. Use when user types /drawio-live or asks to draw a diagram in real-time in draw.io."
trigger: /drawio-live
---

# draw.io Live Drawing

Draw diagrams live in the visible draw.io desktop canvas using MCP tools. Each shape and edge appears in real-time so you can watch the diagram being built step by step.

## When to use

- User explicitly types `/drawio-live` to request live drawing
- User wants to watch a diagram being drawn step by step
- User requests architecture diagrams, flowcharts, network diagrams, or any visualization drawn directly in draw.io

## When NOT to use

- User asks to recreate a scientific figure from a reference image → use `recreate-scientific-figure-in-drawio`
- User wants to generate a .drawio file from code → use `codegen-diagram`
- User wants C4 architecture diagrams → use `c4-architecture`

## Hard boundary

- Control only draw.io's internal graph/model API through the live MCP server
- Never use operating-system mouse, keyboard, window, or full-screen automation
- Never pre-build XML and open it as the drawing method — shapes must appear live on the canvas

## Tools

- `drawio_live_launch` — Start a new live drawing session
- `drawio_live_status` — Check if the graph is ready
- `drawio_live_add_shape` — Add a shape to the visible canvas
- `drawio_live_add_edge` — Connect two shapes with an edge
- `drawio_live_update_cell` — Update a shape's label, style, or position
- `drawio_live_draw_sequence` — Add multiple shapes/edges with delay between each
- `drawio_live_search_shapes` — Search for available draw.io stencil shapes
- `drawio_live_screenshot` — Take a screenshot of the current canvas
- `drawio_live_fit` — Fit the view to show all content
- `drawio_live_inspect` — Inspect the current graph model
- `drawio_live_save_snapshot` — Save the current state to a .drawio file
- `drawio_validate` — Validate the .drawio file structure
- `drawio_export` — Export to PNG/SVG/PDF/JPG

## Shape Selection Strategy

**CRITICAL: Never default to basic rounded rectangles.** Every element must use the most semantically appropriate specialized shape available. A diagram full of colored rectangles looks amateur; one with proper icons looks professional.

### Mandatory search-before-draw rule

For **every** element you add to the canvas:
1. Identify its semantic role (user, database, API, process, decision, cloud service, etc.)
2. Call `drawio_live_search_shapes` with 2-3 relevant keywords
3. If a matching specialized shape is found → **use it**
4. Only if NO match is found after searching → fall back to a basic shape (rounded/diamond/ellipse)

### Built-in basic shapes (draw.io primitives)

| Shape name | When to use |
|------------|-------------|
| `rounded` | Generic process step (last resort) |
| `rectangle` | Simple box (rarely preferred over rounded) |
| `ellipse` | Start/End nodes in flowcharts |
| `diamond` | Decision / routing nodes |
| `cylinder3` | Database / storage (use over `rounded` for any data store) |
| `parallelogram` | Input/Output in flowcharts |
| `hexagon` | Preparation / setup steps |
| `cloud` | Cloud / external system boundary |
| `text` | Labels, titles, annotations (no border) |
| `hexagon` | State / condition |

### Stencil shape quick reference (use these over basic shapes!)

| Semantic concept | Shape to search | Example returned shape names |
|-----------------|-----------------|------------------------------|
| **User / Person** | `actor`, `user` | `shape=umlActor`, `shape=actor`, `mxgraph.bootstrap.user` |
| **Database** | `database`, `cylinder` | `shape=cylinder3`, `mxgraph.network.database`, `mxgraph.bootstrap.database` |
| **API / Gateway** | `api`, `gateway` | `mxgraph.aws4.api_gateway` |
| **Server** | `server`, `application` | `mxgraph.network.server` |
| **Cloud service (AWS)** | `lambda`, `ec2`, `s3`, `rds` | `mxgraph.aws4.lambda_function`, `mxgraph.aws4.ec2`, `mxgraph.aws4.s3` |
| **Cloud service (Azure)** | `azure`, `functions` | `mxgraph.azure.function_app`, `mxgraph.azure.sql_database` |
| **Cloud service (GCP)** | `gcp`, `bigquery` | `mxgraph.gcp.cloud_functions`, `mxgraph.gcp.bigquery` |
| **Network device** | `router`, `switch`, `firewall` | `mxgraph.network.router`, `mxgraph.network.switch` |
| **Kubernetes** | `kubernetes`, `pod` | `mxgraph.kubernetes.pod`, `mxgraph.kubernetes.service` |
| **BPMN process** | `bpmn`, `task` | `bpmn.task`, `bpmn.gateway` |
| **Bootstrap icons** | `bootstrap` | `mxgraph.bootstrap.globe`, `mxgraph.bootstrap.search` |

### Anti-patterns to avoid

- **NEVER** use a `rounded` rectangle with a "Database" label when `shape=cylinder3` exists
- **NEVER** use a `rounded` rectangle with a "User" label when `shape=umlActor` exists
- **NEVER** use a `rounded` rectangle for "AWS Lambda" when `mxgraph.aws4.lambda_function` exists
- **NEVER** batch all elements with the same basic shape — vary shapes by semantic role
- A diagram where every node is a rounded rectangle (just with different colors) is a failed diagram

### Decision priority (highest → lowest)

1. **Exact cloud service match** (AWS/Azure/GCP stencil shape)
2. **Semantic icon** (actor, database cylinder, server, API gateway, router)
3. **BPMN/flowchart shape** (task, gateway, document, parallelogram)
4. **Basic shape with semantic meaning** (diamond for decisions, ellipse for start/end)
5. **Generic rounded rectangle** (only as absolute last resort)

## Workflow

1. **Search shapes**: Call `drawio_live_search_shapes` to find appropriate stencil shapes for each element
2. **Launch**: Call `drawio_live_launch` with `step_delay_ms=400-1000`. Call `drawio_live_status` and require `graph_ready=true`
3. **Page management**: After launch, check `vertices` count from `drawio_live_status`. If `vertices > 0`, call `drawio_live_add_page` to create a new page, then `drawio_live_switch_page` to switch to it. **Never call `drawio_live_clear` on a canvas that has existing content.** Only draw directly on the current page if `vertices === 0`.
4. **Draw**: Use `drawio_live_add_shape` with specialized shape names (e.g., `mxgraph.aws4.lambda_function`). Use `drawio_live_add_edge` for connectors
5. **Review**: Call `drawio_live_screenshot` after each logical section to inspect progress
5. **Iterate**: Use `drawio_live_update_cell` for adjustments. Use `drawio_live_fit` to keep progress visible
6. **Save**: Call `drawio_live_save_snapshot` when complete
7. **Export**: Use `drawio_export` to generate PNG/SVG/PDF deliverables

## Example usage

```
/drawio-live 画一个电商平台的微服务架构图
/drawio-live create a flowchart for user registration
/drawio-live 画一个 K8s 集群部署图
```
