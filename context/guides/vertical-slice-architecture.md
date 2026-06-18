## 1. The Core Principles

* **Group by Feature:** Organize code by **Business Capability** (e.g., `src/modules/billing`) rather than **Technical Layer** (e.g., `src/services`).
* **Self-Contained Slices:** A slice should contain everything it needs to function: logic, types, schemas, and UI.
* **Zero Horizontal Coupling:** Slices are forbidden from importing the internal logic of other slices.
* **Composition Root:** Only the application entry point (e.g., `main.ts`, Astro Page, or Route Handler) is allowed to "wire" slices together.

---

## 2. Structural Patterns

### The Public API (`{slice}.public.ts`)

The **Gatekeeper** for the module. It defines the only legal way for other parts of the app to interact with the slice.

* **Rule:** Export only the bare minimum (Commands, Service Contracts, and Top-level UI).
* **AI Friction:** Prevents AI from "deep-linking" into private internal helper functions.

### The Service Contract (`{slice}.contract.ts`)

Defines the **Data Interface** that the slice provides to the world.

* **Rule:** Contains only types and interfaces. No logic allowed.
* **Benefit:** Allows other slices to know the "shape" of the data without knowing the implementation.

### Shared (`src/shared`)

The home for "Leaf Nodes"—utilities that have zero knowledge of your business logic.

* **Rule:** If a shared utility needs to import a module, it is no longer shared; move it to a module.

---

## 3. Logic Patterns

### The Command Pattern

Encapsulates a single user intent into a standalone object with an `.execute()` method.

* **Structure:** `const createActionCommand = (data) => ({ name: 'Action', data, execute: async () => { ... } })`.
* **Benefit:** Decouples the **Trigger** (UI/Event) from the **Logic** (Action), making testing and logging trivial.

### The Strategy Pattern

Handles varying logic paths without giant `if/else` or `switch` blocks.

* **Usage:** Define a Strategy interface (e.g., `PaymentStrategy`) and pass the specific implementation (Stripe, PayPal) to the Command at runtime.

### The Observer Pattern (Event Bus)

The primary method for **Cross-Slice Side Effects**.

* **Usage:** Slice A emits `ORDER_PLACED`. Slice B (Inventory) and Slice C (Notifications) listen and react independently.
* **Benefit:** High isolation—Slice A doesn't even know Slices B and C exist.

---

## 4. Implementation Checklist

| Step  | Action                                                                 | Pattern Used         |
| ----- | ---------------------------------------------------------------------- | -------------------- |
| **1** | Define the input data validation using Zod/Types.                      | **Schema**           |
| **2** | Wrap business logic in a class or factory function with `execute()`.   | **Command**          |
| **3** | Define the external types in a contract file.                          | **Contract**         |
| **4** | Export the command/UI from the public gatekeeper file.                 | **Public API**       |
| **5** | Wire the event listeners and commands in the entry point (Page/Route). | **Composition Root** |

---

## 5. Automated Enforcement (Architectural Friction)

* **ESLint:** Use `import/no-restricted-paths` to block cross-module internal imports.
* **Dependency Cruiser:** Use to detect and block circular dependencies (A -> B -> A).