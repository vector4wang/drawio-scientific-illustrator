---
name: drawio-live
description: Draw diagrams live inside the visible draw.io desktop canvas from a text description or requirements, using draw.io's own graph API through a localhost-only MCP server. Use when the user wants to watch an architecture diagram, flowchart, network diagram, or any visualization appear shape by shape in draw.io, explicitly rejects XML-first generation or operating-system mouse/screen control, requests targeted live changes, or needs final .drawio/PNG/SVG/PDF/JPG deliverables.
---

# Draw Diagrams Live in draw.io

Draw diagrams live in the visible draw.io desktop canvas from the user's description or requirements. Each shape and edge appears in real time through draw.io's own graph API, so the user watches the diagram being built step by step.

Use the plugin's live MCP tools: `drawio_live_launch`, `drawio_live_status`, `drawio_live_screenshot`, `drawio_live_add_shape`, `drawio_live_add_edge`, `drawio_live_update_cell`, `drawio_live_draw_sequence`, `drawio_live_fit`, `drawio_live_inspect`, `drawio_live_save_snapshot`, `drawio_live_search_shapes`. Use file tools `drawio_validate` and `drawio_export` only after the visible drawing has been saved.

## When to use

- User wants to watch a diagram being drawn step by step in draw.io
- User requests architecture diagrams, flowcharts, network diagrams, sequence/process diagrams, or any visualization drawn directly in draw.io from a description
- User provides requirements, a spec, or a textual outline of what the diagram should contain

## Hard boundary

- Control only draw.io's internal graph/model API through the live MCP server.
- Never use operating-system mouse, keyboard, window, or full-screen automation for this workflow.
- Never pre-build XML and then open it as the drawing method. Serialize `.drawio` only after live shapes and edges already exist on the visible canvas.
- Renderer screenshots are allowed only to inspect the draw.io canvas itself; they are not general computer-screen control.

## Shape Selection Strategy (CRITICAL for professional output)

**Always prefer specialized draw.io shapes over generic rectangles.** A diagram full of colored rectangles looks amateur; one with proper icons (AWS/Azure/GCP/BPMN/UML/Cisco) looks professional.

### Mandatory search-before-draw rule

For **every** element you add to the canvas:
1. Identify its semantic role (user, database, API, process, decision, cloud service, etc.)
2. Call `drawio_live_search_shapes` with 2-3 relevant keywords
3. If a matching specialized shape is found → **use it**
4. Only if NO match is found after searching → fall back to a basic shape (rounded/diamond/ellipse)

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

### Anti-patterns to avoid

- **NEVER** use a `rounded` rectangle with a "Database" label when a cylinder/database shape exists.
- **NEVER** use a `rounded` rectangle with a "User" label when `shape=umlActor` exists.
- **NEVER** use a `rounded` rectangle for "AWS Lambda" when `mxgraph.aws4.lambda_function` exists.
- **NEVER** batch all elements with the same basic shape — vary shapes by semantic role.
- A diagram where every node is a rounded rectangle (just with different colors) is a failed diagram.

### Decision priority (highest → lowest)

1. **Exact cloud service match** (AWS/Azure/GCP stencil shape)
2. **Semantic icon** (actor, database cylinder, server, API gateway, router)
3. **BPMN/flowchart shape** (task, gateway, document, parallelogram)
4. **Basic shape with semantic meaning** (diamond for decisions, ellipse for start/end)
5. **Generic rounded rectangle** (only as absolute last resort)

## Workflow

1. **Plan from the request**: Turn the user's description/requirements into a list of elements and relationships. For each element, determine the most semantically appropriate draw.io shape (see Shape Selection Strategy). Call `drawio_live_search_shapes` as needed to find the right shape names.
2. **Launch**: Call `drawio_live_launch` with a visible per-step delay, normally 400–1000 ms. Call `drawio_live_status` and require `graph_ready=true` before drawing.
3. **Page management**: After launch, check `vertices` from `drawio_live_status`. If `vertices > 0`, call `drawio_live_add_page` then `drawio_live_switch_page` to a fresh page. **Never call `drawio_live_clear` on a canvas that has existing content.** Only draw directly on the current page if `vertices === 0`.
4. **Add geometry** directly to the live canvas:
   - Use `drawio_live_add_shape` with **specialized shape names** (e.g. `mxgraph.aws4.lambda_function`, `mxgraph.cisco.routers.router`) discovered via `drawio_live_search_shapes`.
   - Use `drawio_live_add_edge` for connectors between visible cells.
   - Use `drawio_live_draw_sequence` only with a nonzero `step_delay_ms`; each operation must remain a separate draw.io model update so the user can watch it appear.
   - Use stable semantic cell ids from the beginning so later edges and edits can target exact elements.
5. **Review sections**: Call `drawio_live_screenshot` after each logical section, not after every trivial cell. Inspect the draw.io renderer and compare it with the intended design.
6. **Iterate**: Use `drawio_live_inspect` followed by `drawio_live_update_cell` for labels, styles, position, and size. Use `drawio_live_fit` to keep progress visible.
7. **Save**: After the visible diagram is complete, call `drawio_live_save_snapshot`. This is the first point at which `.drawio` XML should be serialized.
8. **Validate**: Call `drawio_validate`. Fix structural errors through the live graph when possible, then save again.
9. **Export deliverables**: Export the requested deliverables. Default to an editable `.drawio` plus a PNG. Use `width=2000` for a review PNG; use `embed=true` for final PNG/SVG/PDF so draw.io XML remains embedded where supported.

## Quality rules

- Get the meaning right before decoration: labels, relationships, directionality, grouping, and layout structure must be correct.
- Create text as text and arrows as connectors; never flatten them into a screenshot.
- Keep coordinates on a 10 px grid unless the design requires finer placement.
- Use consistent fonts, stroke widths, arrowheads, corner radii, and semantic colors.
- Route connectors around unrelated shapes. Pin entry/exit points where multiple edges share a node.
- If the request is ambiguous, state the assumptions you made instead of inventing unstated requirements.

## Delivery

Return clickable paths for the `.drawio` source and each export. State validation status.
