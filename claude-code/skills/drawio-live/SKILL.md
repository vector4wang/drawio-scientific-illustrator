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

**Always use specialized draw.io shapes over generic rectangles.** Professional diagrams with AWS/Azure/GCP/network/BPMN icons look significantly more impressive.

### Search for shapes before drawing

1. **Identify the domain**: cloud services, network, databases, processes, actors, etc.
2. **Call `drawio_live_search_shapes`** with relevant keywords BEFORE adding shapes
3. **Use the returned shape names** directly in `drawio_live_add_shape`

### Shape library quick reference

| Domain | Example shapes | Search keywords |
|--------|---------------|-----------------|
| **AWS** | Lambda, EC2, S3, RDS, API Gateway | `aws`, `lambda`, `ec2`, `s3`, `api` |
| **Azure** | Functions, Cosmos DB, Blob Storage | `azure`, `functions`, `cosmos`, `blob` |
| **GCP** | Cloud Functions, BigQuery, GKE | `gcp`, `bigquery`, `gke` |
| **Network** | Router, Switch, Firewall, Server | `router`, `switch`, `firewall`, `server`, `cisco` |
| **Database** | Cylinder DB, Network DB | `database`, `cylinder`, `storage` |
| **BPMN** | Task, Gateway, Start/End Event | `bpmn`, `task`, `gateway` |
| **UML** | Class, Actor, Note | `uml`, `class`, `actor` |
| **Flowchart** | Process, Decision, Document | `flowchart`, `process`, `decision` |
| **Icons** | User, Lock, Key, Gear, Shield | `user`, `lock`, `key`, `gear`, `shield` |
| **Kubernetes** | Pod, Deployment, Service | `kubernetes`, `pod`, `deployment` |

### Decision rules

1. **Recognizable cloud service** → use AWS/Azure/GCP shape, not a labeled rectangle
2. **Network equipment** → use Cisco/network shapes
3. **Flowchart/process** → use BPMN or flowchart shapes with proper semantics
4. **People/users** → use actor or user icon shapes
5. **Only use basic shapes** (rectangle, ellipse) when no specialized shape matches
6. **When in doubt**, call `drawio_live_search_shapes`

## Workflow

1. **Search shapes**: Call `drawio_live_search_shapes` to find appropriate stencil shapes for each element
2. **Launch**: Call `drawio_live_launch` with `step_delay_ms=400-1000`. Call `drawio_live_status` and require `graph_ready=true`
3. **Draw**: Use `drawio_live_add_shape` with specialized shape names (e.g., `mxgraph.aws4.lambda_function`). Use `drawio_live_add_edge` for connectors
4. **Review**: Call `drawio_live_screenshot` after each logical section to inspect progress
5. **Iterate**: Use `drawio_live_update_cell` for adjustments. Use `drawio_live_fit` to keep progress visible
6. **Save**: Call `drawio_live_save_snapshot` when complete
7. **Export**: Use `drawio_export` to generate PNG/SVG/PDF deliverables

## Example usage

```
/drawio-live 画一个电商平台的微服务架构图
/drawio-live create a flowchart for user registration
/drawio-live 画一个 K8s 集群部署图
```
