---
name: recreate-scientific-figure-in-drawio
description: Recreate, trace, revise, inspect, or export static scientific figures and schematic illustrations live inside the visible draw.io desktop canvas through draw.io's own graph API. Use when the user wants to watch an MCP draw a reference figure step by step in draw.io, explicitly rejects XML-first generation or operating-system mouse/screen control, provides a PNG/JPEG/SVG/PDF reference to rebuild as editable draw.io geometry, requests targeted live changes, or needs final .drawio/PNG/SVG/PDF/JPG deliverables.
---

# Recreate Scientific Figures in draw.io

Use the plugin's live MCP tools: `drawio_live_launch`, `drawio_live_status`, `drawio_live_screenshot`, `drawio_live_add_shape`, `drawio_live_add_edge`, `drawio_live_update_cell`, `drawio_live_draw_sequence`, `drawio_live_fit`, `drawio_live_inspect`, `drawio_live_save_snapshot`, `drawio_live_search_shapes`. Use file tools `drawio_validate` and `drawio_export` only after the visible drawing has been saved.

## Hard boundary

- Control only draw.io's internal graph/model API through the live MCP server.
- Never use operating-system mouse, keyboard, window, or full-screen automation for this workflow.
- Never pre-build XML and then open it as the drawing method. Serialize `.drawio` only after live shapes and edges already exist on the visible canvas.
- Renderer screenshots are allowed only to inspect the draw.io canvas itself; they are not general computer-screen control.

## Shape Selection Strategy (CRITICAL for professional output)

**Always prefer specialized draw.io shapes over generic rectangles.** Professional diagrams using AWS/Azure/GCP/BPMN/UML/Cisco icons are significantly more visually impressive and convincing than basic shapes.

### Before drawing, search for the right shapes

1. **Identify the domain** of each element in the reference figure: cloud services, network equipment, databases, processes, actors, etc.
2. **Call `drawio_live_search_shapes`** with relevant keywords BEFORE adding shapes. Examples:
   - Cloud architecture: search "lambda", "s3", "ec2", "api gateway", "kubernetes"
   - Network diagrams: search "router", "switch", "firewall", "server"
   - Databases: search "database", "sql", "nosql", "storage"
   - Flowcharts: search "process", "decision", "terminator", "data"
   - People/Users: search "user", "actor", "people"
3. **Use the returned shape names** directly as the `shape` parameter in `drawio_live_add_shape`.

### Shape library quick reference

| Domain | Example shapes | Search keywords |
|--------|---------------|-----------------|
| **AWS** | Lambda, EC2, S3, RDS, API Gateway, ECS, EKS | `aws`, `lambda`, `ec2`, `s3`, `api`, `ecs`, `kubernetes` |
| **Azure** | Functions, Cosmos DB, Blob Storage, AKS | `azure`, `functions`, `cosmos`, `blob`, `aks` |
| **GCP** | Cloud Functions, BigQuery, GKE, Cloud Run | `gcp`, `bigquery`, `gke`, `cloud run` |
| **Network** | Router, Switch, Firewall, Server | `router`, `switch`, `firewall`, `server`, `cisco` |
| **Database** | Cylinder DB, Network DB | `database`, `cylinder`, `storage` |
| **BPMN** | Task, Gateway, Start/End Event, Pool | `bpmn`, `task`, `gateway`, `process` |
| **UML** | Class, Actor, Note | `uml`, `class`, `actor` |
| **Flowchart** | Process, Decision, Document, Data IO | `flowchart`, `process`, `decision`, `document` |
| **Icons** | User, Lock, Key, Gear, Shield | `user`, `lock`, `key`, `gear`, `shield` |
| **Kubernetes** | Pod, Deployment, Service, Cluster | `kubernetes`, `pod`, `deployment`, `k8s` |

### Decision rules

1. **If the reference shows a recognizable cloud service** → use the corresponding AWS/Azure/GCP shape, not a labeled rectangle.
2. **If the reference shows network equipment** → use Cisco/network shapes, not generic boxes.
3. **If the reference shows a flowchart/process** → use BPMN or flowchart shapes with proper semantics (decision = diamond, process = rectangle with rounded corners, etc.).
4. **If the reference shows people/users** → use actor or user icon shapes.
5. **Only use basic shapes** (rectangle, ellipse, etc.) when no specialized shape matches the content.
6. **When in doubt**, call `drawio_live_search_shapes` with a descriptive keyword.

## Workflow

1. **Inspect reference**: Analyze every provided reference image with vision before creating XML. For a PDF, render the relevant page first. Do not merely embed the raster image and call it recreated.
2. **Decompose and plan shapes**: Decompose the figure into editable primitives. For each element, determine if a specialized draw.io shape exists (see Shape Selection Strategy above). Call `drawio_live_search_shapes` as needed to find the right shape names.
3. **Launch**: Call `drawio_live_launch` with a visible per-step delay, normally 400–1000 ms. Call `drawio_live_status` and require `graph_ready=true` before drawing.
4. **Add geometry** directly to the live canvas:
   - Use `drawio_live_add_shape` with **specialized shape names** (e.g. `mxgraph.aws4.lambda_function`, `mxgraph.cisco.routers.router`) discovered via `drawio_live_search_shapes`.
   - Use `drawio_live_add_edge` for connectors between visible cells.
   - Use `drawio_live_draw_sequence` only with a nonzero `step_delay_ms`; each operation must remain a separate draw.io model update so the user can watch it appear.
   - Use stable semantic cell ids from the beginning so later edges and edits can target exact elements.
5. **Review sections**: Call `drawio_live_screenshot` after each logical section, not after every trivial cell. Inspect only the draw.io renderer and compare it with the reference.
6. **Iterate**: Use `drawio_live_inspect` followed by `drawio_live_update_cell` for labels, styles, position, and size. Use `drawio_live_fit` to keep progress visible.
7. **Save**: After the visible figure is complete, call `drawio_live_save_snapshot`. This is the first point at which `.drawio` XML should be serialized.
8. **Validate**: Call `drawio_validate`. Fix structural errors through the live graph when possible, then save again.
9. **Export review**: Export a review PNG with `embed=false` and `width=2000`. Check element count, wording, topology, alignment, overlap, clipping, arrow direction, color, whitespace, and correspondence to the reference.
10. **Export deliverables**: After approval, export the requested deliverables. Default to an editable `.drawio` plus PNG. Use `embed=true` for final PNG/SVG/PDF so draw.io XML remains embedded where supported.

## Fidelity rules

- Match scientific meaning before decoration: labels, relationships, directionality, grouping, and panel structure must be correct.
- Recreate text as text and arrows as connectors; do not flatten them into a screenshot.
- Keep coordinates on a 10 px grid unless matching the reference requires finer placement.
- Use consistent fonts, stroke widths, arrowheads, corner radii, and semantic colors.
- Route connectors around unrelated shapes. Pin entry/exit points where multiple edges share a node.
- For microscopy, photographs, heatmaps, molecular renderings, or dense plotted data, explain that the live API currently focuses on editable draw.io primitives. Add a dedicated live image-insertion operation before attempting hybrid figures; do not silently fall back to XML-first construction.
- If a reference is ambiguous or too low-resolution to read, state the uncertain labels/elements instead of inventing them.

## Delivery

Return clickable paths for the `.drawio` source and each export. State validation status and briefly identify any intentionally rasterized portions.
