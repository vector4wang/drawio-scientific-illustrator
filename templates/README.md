# Templates

Production-ready starting points for common diagram types. Each template is an editable `.drawio` file plus a 2000 px preview PNG, designed against the `drawio-live` design system so any agent producing a new diagram follows the same conventions.

## Available templates

| ID | Description | File |
|----|-------------|------|
| `01-aws-3tier-webapp` | Production AWS 3-tier web app with edge, VPC (dual AZ), and cross-cutting services | `01-aws-3tier-webapp/template.drawio` |

## Design system (used by every template)

- **Icon-first** — every service is rendered with the official AWS / Azure / GCP stencil, not a labeled rounded rectangle.
- **Label-below-icon** — AWS stencils set `verticalLabelPosition=bottom;labelPosition=center` so the service name sits below the icon, never clipped by the card.
- **Category fills** — each service card has a light-tint fill at ~12 % opacity of its AWS category color, plus a 1.5 px colored stroke and a 3 px top stripe in the full color.
- **No in-card text** — the icon stencil shows the name; descriptions and configurations are intentionally omitted so the diagram reads at a glance.
- **Dashed boundaries** — VPC and AZ are dashed outlines, not solid boxes; subnet labels are 9 px gray text in the upper-left of each band.
- **Step delay 350 ms** during live drawing for a comfortable watch-pace.

## Using a template with `/drawio-live`

1. Open the template's `.drawio` file in draw.io.
2. From Claude Code: `/drawio-live extend this AWS 3-tier template with a Lambda function for image resizing between CloudFront and the ALB`.
3. From Codex: select **Draw.io Scientific Illustrator** and describe the change.
4. The agent will launch the live canvas, add the requested shape with the same fill / stroke / icon conventions, and prompt you before saving.

## Adding a new template

Each template lives in its own folder with the same shape:

```
templates/
  NN-short-name/
    template.drawio   # uncompressed .drawio source
    template.png      # 2000 px embedded preview
```

Conventions:

- Use the AWS / Azure / GCP / Cisco / Kubernetes / BPMN / UML stencil libraries when a specialized shape exists.
- Keep the page width ≤ 2000 px so the export renders crisply at standard preview sizes.
- Validate the file with `drawio_validate` (the file-utils MCP) before committing.

## License

Same MIT terms as the rest of the repository.
