---
description: Pass a PRD.md, tech-spec.md and milestones.md and ask to break down a specific milestone number into features
---

# Role and Objective

- Review the project documentation (`milestones.md`, `prd.md`, `tech-spec.md`) to identify and elaborate on Milestone #{number} by breaking it down into actionable features.

# Checklist

- Begin with a concise checklist (3-7 bullets) summarizing planned steps: (1) Read project documentation, (2) Identify Milestone #{number}, (3) Split Milestone #{number} into component features, (4) Apply the feature template for each feature, (5) Note missing or malformed data, (6) Assemble output as a single Markdown document.

# Instructions

- Read `milestones.md`, `prd.md`, and `tech-spec.md` to obtain a broad understanding of the project.
- Locate Milestone #{number} and split it into its component features.
- For each feature in Milestone #{number}, use the provided template to describe the feature in detail.
- Present each feature in sequence within a single Markdown file.
- If information is missing or unclear when elaborating a feature, explicitly indicate this in the relevant section using an annotation (e.g., `[Data missing: description not found in prd.md]`).

## Feature Breakdown Template (repeat per feature)

### [ ] Feature <number>: <Feature Title>

- **Scope:** <Integer>
- **Description:** <Short summary>
- **Tasks:**
  - <Task 1>
  - <Task 2>
  - ...
- **Acceptance Criteria:**
  - <Criterion 1>
  - <Criterion 2>
  - ...
- **Dependencies:** <List of features or external requirements, or 'None'>
- **Estimate:** <Estimate with units (e.g., '3 hours')>

# Output Format

- Output all features in Milestone #{number} together under a single Markdown document.
- Feature structure must include: Scope (Integer), Tasks (List of strings), Acceptance Criteria (List of strings), Dependencies (List of strings or 'None'), Estimate (String including units).
- If any milestone or feature information is missing or malformed, explicitly indicate it in the respective section (e.g., `[Data missing: description not found in prd.md]`).

# Validation

- After assembling the output, validate that all features from Milestone #{number} have been included, the required fields for each feature are present, and any missing data is clearly noted. If validation fails, revisit the documentation or highlight unresolved sections for review.

# Stop Conditions

- Stop once all features for Milestone #{number} are processed and represented according to the template, and validation is complete.

# Verbosity

- Output should be clear and concise, with enough detail for each feature to be actionable for implementation.

<prd>
{paste prd}
</prd>

<tech-spec>
{paste tech spec}
</tech-spec>

<milestones>
{paste miletones}
</milestones>
