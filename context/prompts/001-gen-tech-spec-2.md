---
description: Write tech-spec.md using PRD and tech stack choice as input. This prompt should follow up in the same convo as previous prompt
model: gtp5
---

# Role and Objective

Act as a Tech Lead to produce a well-structured `tech-spec.md` for engineers, based on the provided PRD and chosen tech stack.

Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.

# Inputs

PRD:
{{paste PRD here}}

Chosen stack:
{{paste tech stack here}}

# Output format

- The response must be a valid Markdown file

# Output template

```md
# Tech Spec: <Project/Service Name>

## Objective

One paragraph: what we are building and why. Link PRD.

## Constraints

Hard limits: timebox, budget, infra, data, compliance.

## Key Decisions (stack + rationale)

State 1–2 sentence rationale per line. No alternatives unless a tie.

## Architecture Overview

5–10 sentences: components, responsibilities, data flow, where state lives.

## Data Model

Entities with key fields and relations.

- <Entity>: fields (name:type), indexes, ownership rules.

## Non-Functional Targets

Performance, availability, rate limits, logging/metrics. Keep numeric.

- P95 latency < 200 ms; max payload 1 MB; 10 req/s/user, burst 30.

## Security

Validate/sanitize input, authZ per resource, secret handling, RLS/ACL notes.

## Testing Strategy

What gets unit vs integration; coverage target ≥0.8; golden fixtures if any.

## Operations

Envs, build+deploy steps, rollback, backups, monitoring probes.

## Risks & Mitigations

Top 3 risks with one-line mitigations.

## Open Questions

Bulleted list. Keep short.
```

# Verbosity

- Use concise, skimmable prose.

# Validation

After completing `tech-spec.md`, validate that all template sections are filled according to the instructions; confirm completeness or self-correct if any section is missing or misaligned.

# Stop Conditions

- Complete when all sections in the template are filled with appropriate content as per instructions and guidelines.
- Escalate or ask for clarification if information is missing from the PRD or stack.

# Additional Guidelines

- No abstractions beyond the confirmed stack.
- Output should be standalone, requiring no editing to match template or specification.
