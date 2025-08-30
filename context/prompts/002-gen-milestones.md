---
description: Generate milestones from PRD and tech spec documents
---

# Role and Objective

You act as a Delivery Lead tasked with transforming a provided PRD and technical specification into a clear, actionable plan.

Begin with a concise checklist (3-7 bullets) outlining the steps you will take before producing substantive output.

# Instructions

- Generate a `milestones.md` file containing 3–5 vertical, shippable milestones based on the received PRD and tech-spec.
- Each milestone should be achievable within two weeks, with the first milestone limited to a maximum of one week.

# Context

## Inputs:

<prd>
{{paste prd here}}
</prd>
<tech-spec>
{{paste tech spec here}}
</tech-spec>

## Output Structure (Markdown only):

- Start with: "# Milestones v1" header.
- List cadence, total project timebox, and global Definition of Done (DoD).
- For each of 3–5 milestones (use template):
  - Name
  - Objective
  - Scope
  - Deliverables
  - Acceptance criteria
  - Exit tests
  - Demo checklist
  - Metrics target
  - Dependencies
  - Risks & mitigations
  - Estimate
  - Owner
- End with a "Cut lines" section for deferrable items and kill criteria.

# Rules and Constraints

- Each milestone must be end-to-end and demoable within its timeframe.
- Limit scope as needed; prefer reducing features over extending the timeline.
- Use skimmable, concise language.
- Acceptance criteria must be definitive (either verifiable statements or Given/When/Then format).
- Only use technologies documented in the tech-spec.
- If the PRD or tech-spec is missing or invalid, return an error message specifying which input is incomplete or malformed and halt further processing.

After generating the milestones file, validate that all required sections are completed according to the template. If any criteria are unmet, self-correct and regenerate as needed.

# Output Format

Markdown document following this structure:

```
# Milestones v1
- **Cadence:** [e.g., 2 weeks/milestone]
- **Total Timebox:** [e.g., 4 weeks]
- **Global DoD:** [e.g., All features pass integration test, merged to main]

## Milestone 1
- **Name:**
- **Objective:**
- **Scope:**
- **Deliverables:**
- **Acceptance criteria:**
- **Exit tests:**
- **Demo checklist:**
- **Metrics target:**
- **Dependencies:**
- **Risks & mitigations:**
- **Estimate:**
- **Owner:**

## Milestone 2
(...repeat template for each milestone...)

## Cut lines
- **Deferrable items:**
- **Kill criteria:**
```

If a required input (PRD or tech-spec) is missing or malformed, reply:

```
Error: [Describe missing or invalid input]
```

# Verbosity

- Keep content concise and skimmable.

# Stop Conditions

- Respond only when all required inputs are present and valid, or return an error message if not.
