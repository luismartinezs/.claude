---
description: Write api-contact.md using tech-spec.md as input
model: gtp5
---

# Role

You are a Tech Lead API designer.

# Objective

Create a concise and explicit `api-contract.md` that defines the application's public boundary, strictly based on the provided `tech-spec.md`.

Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.

# Input

<tech-spec>
{{paste tech spec}}
</tech-spec>

# Output

- Produce a Markdown file (`api-contract.md`) capped at two pages.
- Ensure content is both concise and unambiguous.
- Use the structure and templates below.

## Required Sections

### # API Contract v1

#### ## Overview

- Specify API boundary type (REST, GraphQL, gRPC, events, library API, etc.).

#### ## Operations

For each operation, in the order found in `tech-spec.md`:

- **Name:** short identifier
- **Purpose:** one sentence
- **Input:**
  - List all fields with:
    - Field name
    - Data type
    - Required/optional
    - Nullable: yes/no
    - Description of constraints
- **Output:**
  - List all fields as above, specifying required/optional, nullability, and constraints
- **Errors:**
  - Enumerate possible error codes and their meaning
  - Indicate error code format (string/integer)
- **Auth/Access:**
  - Indicate who can perform the operation (per-operation or per-resource, as detailed in `tech-spec.md`)

#### ## Invariants

List rules that must always hold:

- Authorization rules (per resource/operation)
- Ownership/ACL rules
- Rate limits/quotas
- Idempotency/ordering guarantees (if any)
- Validation requirements

#### ## Error Model

- Define a unified error shape (e.g., `{ code: string/integer, message: string }`).
- Enumerate all error codes and their meaning.
- State whether this error shape is consistent across all operations.

#### ## Examples

Provide two flows:

- One happy path
- One error scenario
  Both must use concrete data shapes (e.g., JSON) that exactly match the schemas in the Operations section.
- **Flow X:** (Happy path or Error case)
  - **Request**
    ```json
    { ... }
    ```
  - **Response**
    ```json
    { ... }
    ```

# Rules

- Do not add any functionality not specified in `tech-spec.md`.
- All types must be explicit; do not use placeholders like "TBD".
- Use bullet points for clarity; avoid dense prose.
- Ensure the spec is protocol-agnostic, describing the boundary exactly as implied by the tech-spec.

After drafting the output, validate that all example fields precisely correspond to those defined in the Operations section. Make corrections if discrepancies are detected.

# Output Format Example

````markdown
# API Contract v1

## Overview

## Operations

- Name: ...
  - Purpose: ...
  - Input:
    - field_name (type, required/optional, nullable: yes/no): constraint
    - ...
  - Output:
    - field_name (type, required/optional, nullable: yes/no): constraint
    - ...
  - Errors:
    - code (string/integer): description
    - ...
  - Auth/Access:
    - description

## Invariants

- Rule ...
- ...

## Error Model

Format: { code: string/integer, message: string }
Enumerated error codes:

- code: description
- ...

## Examples

### Flow 1: (Happy path)

#### Request

```json
{ ... }
```
````

#### Response

```json
{ ... }
```

### Flow 2: (Error case)

#### Request

```json
{ ... }
```

#### Response

```json
{ ... }
```

```

- All fields in examples must align with the schemas defined under Operations.
```
