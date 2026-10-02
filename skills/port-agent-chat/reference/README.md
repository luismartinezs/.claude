# What this reference expects

The chat is the UI half. It does not spawn anything itself: it hands one task to
the agent runtime and polls the job.

Two imports come from **`port-agent-runtime`**, which must be ported first:

| Import in this reference | What it is |
|---|---|
| `../contracts/agent.ts` | `agentSelectionSchema`, `agentSelectionContract`, `agentImageSchema`, `inspectImageBytes`, the image limits |
| `../runtime/run.ts`, `../runtime/process.ts` | `runRoutedAgentTask`, `AgentTask`, `AgentProcessAdapter` |

In a ported repository both live wherever that skill put them; rewrite the two
import paths and nothing else changes.

`app/api/chat.ts` is the SPA's thin fetch wrapper over the three endpoints
(`POST /api/chat`, `GET /api/chat/:id`, `POST /api/chat/:id/cancel`). It is not
in the reference because it is three `fetch` calls in whatever shape the target's
other API calls already have — copy the neighbouring file instead of this one.
