<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import {
  CREDENTIAL_SCOPES,
  SCOPE_LABELS,
  type ActivityEntry,
  type CreatedCredential,
  type Credential,
  type ProductSignal,
  type SignalStatus,
  type UsageReport,
} from "@pawalist/contracts"
import Panel from "../components/Panel.vue"
import Badge from "../components/Badge.vue"
import Feedback from "../components/Feedback.vue"
import EmptyState from "../components/EmptyState.vue"
import Modal from "../components/Modal.vue"
import Icon from "../components/Icon.vue"
import Skeleton from "../components/Skeleton.vue"
import { api } from "../lib/api.ts"
import { remembered } from "../stores/remembered.ts"
import { errorMessage } from "../stores/work.ts"
import { useAccount } from "../stores/account.ts"

/**
 * Developer access: API credentials and MCP connections, and what the product
 * knows about itself.
 *
 * Creating either credential happens here and nowhere else. No credential scope
 * and no confirmation challenge can create another credential, which is the
 * point: an external agent can use Pawalist but can never widen its own access.
 *
 * Below them sit the two counters the product keeps for whoever is building it:
 * which features actually get used, and every request it could not serve. The
 * second is the backlog, written by use rather than by memory, and each item
 * carries how many times it has now happened.
 */
const router = useRouter()
const account = useAccount()

/** Null until the first answer, so what has not loaded is not drawn as none. */
const credentials = remembered<Credential[] | null>("developer.credentials", null)
const activity = remembered<ActivityEntry[] | null>("developer.activity", null)
const error = ref<string | null>(null)
const creating = ref<"api" | "mcp" | null>(null)
const name = ref("")
const scopes = ref<string[]>(["records:read"])
const created = ref<CreatedCredential | null>(null)
const copied = ref(false)

const usage = remembered<UsageReport | null>("developer.usage", null)
const signals = remembered<ProductSignal[] | null>("developer.signals", null)
const settledVisible = ref(false)

const apiKeys = computed(() => (credentials.value ?? []).filter((credential) => credential.kind === "api"))
const mcpConnections = computed(() => (credentials.value ?? []).filter((credential) => credential.kind === "mcp"))
const origin = computed(() => window.location.origin)

const load = async (): Promise<void> => {
  try {
    const [list, entries, counts, backlog] = await Promise.all([
      api<{ items: Credential[] }>("/developer/credentials"),
      api<{ items: ActivityEntry[] }>("/agent/activity"),
      api<UsageReport>("/insight/usage?days=30"),
      api<{ items: ProductSignal[] }>(
        `/insight/signals?status=${settledVisible.value ? "open,planned,resolved,dismissed" : "open,planned"}`,
      ),
    ])
    credentials.value = list.items
    activity.value = entries.items.filter(
      (entry) => entry.channel === "api" || entry.channel === "mcp",
    )
    usage.value = counts
    signals.value = backlog.items
  } catch (loadError) {
    error.value = errorMessage(loadError)
  }
}

onMounted(load)

const toggleScope = (scope: string): void => {
  scopes.value = scopes.value.includes(scope) ? scopes.value.filter((value) => value !== scope) : [...scopes.value, scope]
}

const create = async (): Promise<void> => {
  if (!creating.value || name.value.trim() === "" || scopes.value.length === 0) return
  try {
    created.value = await api<CreatedCredential>("/developer/credentials", {
      method: "POST",
      body: { kind: creating.value, name: name.value.trim(), scopes: scopes.value },
    })
    creating.value = null
    name.value = ""
    await load()
  } catch (createError) {
    error.value = errorMessage(createError)
    creating.value = null
  }
}

const revoke = async (credential: Credential): Promise<void> => {
  await api(`/developer/credentials/${credential.id}`, { method: "DELETE" })
  await load()
}

const settle = async (signal: ProductSignal, status: SignalStatus): Promise<void> => {
  try {
    await api(`/insight/signals/${signal.id}`, { method: "PATCH", body: { status } })
    await load()
  } catch (settleError) {
    error.value = errorMessage(settleError)
  }
}

const showSettled = async (): Promise<void> => {
  settledVisible.value = !settledVisible.value
  await load()
}

const copy = async (): Promise<void> => {
  if (!created.value) return
  await navigator.clipboard.writeText(created.value.secret).catch(() => undefined)
  copied.value = true
}
</script>

<template>
  <h1 class="t-screen mb-6 hidden lg:block">Developer access</h1>

  <Feedback v-if="error" tone="error" title="Something went wrong" icon="overdue" class="mb-6">{{ error }}</Feedback>

  <div class="section-stack">
    <Panel title="API credentials" flush>
      <template #actions>
        <button type="button" class="btn btn-tertiary btn-compact" data-testid="new-api-key" @click="creating = 'api'">
          New credential
        </button>
      </template>

      <!-- Inside the first panel, under its header: it waits for the account
           summary, and above the panels it pushed the whole screen down when
           that arrived. Here it pushes only the credentials. -->
      <Feedback
        v-if="account.summary.value && !account.aiAvailable.value"
        tone="info"
        title="The paid API and MCP need the monthly plan"
        icon="key"
        class="m-4"
      >
        Both use the same credit balance as the agent, and neither needs a separate subscription.
        <template #actions>
          <button type="button" class="btn btn-primary" @click="router.push('/billing')">See the plan</button>
        </template>
      </Feedback>

      <table v-if="apiKeys.length > 0" class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Prefix</th>
            <th class="col-wide">Scopes</th>
            <th class="num col-wide">Last used</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="credential in apiKeys" :key="credential.id">
            <td class="t-strong">{{ credential.name }}</td>
            <td class="num t-mono-sm">{{ credential.prefix }}</td>
            <td class="col-wide">{{ credential.scopes.length }}</td>
            <td class="num t-mono-sm col-wide">{{ credential.lastUsedAt?.slice(0, 10) ?? "never" }}</td>
            <td class="num">
              <Badge v-if="credential.revoked" tone="error">Revoked</Badge>
              <button v-else type="button" class="btn btn-destructive btn-compact" @click="revoke(credential)">
                Revoke
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <!-- Rows without a header: the columns size to what arrives, and a header
           drawn over skeletons would slide sideways when they do. -->
      <table v-else-if="!credentials && !error" class="table" aria-busy="true">
        <tbody>
          <tr>
            <td><Skeleton class="w-40" /></td>
            <td class="num"><Skeleton class="w-20" /></td>
            <td class="col-wide"><Skeleton class="w-6" /></td>
            <td class="num col-wide"><Skeleton class="w-20" /></td>
            <td class="num"><Skeleton class="h-7 w-16" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else message="No API credentials. One lets a script read and change your work without chat." />
    </Panel>

    <Panel title="MCP connections" flush>
      <template #actions>
        <button type="button" class="btn btn-tertiary btn-compact" data-testid="new-mcp" @click="creating = 'mcp'">
          Authorize an agent
        </button>
      </template>

      <table v-if="mcpConnections.length > 0" class="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Prefix</th>
            <th class="num col-wide">Last used</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="credential in mcpConnections" :key="credential.id">
            <td class="t-strong">{{ credential.name }}</td>
            <td class="num t-mono-sm">{{ credential.prefix }}</td>
            <td class="num t-mono-sm col-wide">{{ credential.lastUsedAt?.slice(0, 10) ?? "never" }}</td>
            <td class="num">
              <Badge v-if="credential.revoked" tone="error">Revoked</Badge>
              <button v-else type="button" class="btn btn-destructive btn-compact" @click="revoke(credential)">
                Revoke
              </button>
            </td>
          </tr>
        </tbody>
      </table>
      <table v-else-if="!credentials && !error" class="table" aria-busy="true">
        <tbody>
          <tr>
            <td><Skeleton class="w-40" /></td>
            <td class="num"><Skeleton class="w-20" /></td>
            <td class="num col-wide"><Skeleton class="w-20" /></td>
            <td class="num"><Skeleton class="h-7 w-16" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else message="No external agents connected. An MCP connection lets one work your list as you would." />
    </Panel>

    <Panel title="How to connect">
      <p class="t-label mb-2">MCP endpoint</p>
      <pre class="code">{{ origin }}/api/mcp</pre>
      <p class="t-small mt-2">
        The token from "Authorize an agent" goes in the connection's Authorization header, never in the URL. An API
        credential does not work here, and an MCP token does not work on the paid API.
      </p>
      <p class="t-label mb-2 mt-4">Claude Code</p>
      <pre class="code">claude mcp add --transport http pawalist {{ origin }}/api/mcp \
  --header "Authorization: Bearer YOUR_MCP_TOKEN"</pre>
      <p class="t-label mb-2 mt-4">Clients configured in JSON, such as Cursor</p>
      <pre class="code">{
  "mcpServers": {
    "pawalist": {
      "type": "http",
      "url": "{{ origin }}/api/mcp",
      "headers": { "Authorization": "Bearer YOUR_MCP_TOKEN" }
    }
  }
}</pre>
      <p class="t-label mb-2 mt-4">Paid API</p>
      <pre class="code">curl {{ origin }}/api/v1/tasks \
  -H "Authorization: Bearer YOUR_CREDENTIAL"</pre>
      <p class="t-small mt-4">
        Signing in, buying anything, deleting your account, and creating a credential have no endpoint and no tool.
        They only happen on this screen, signed in as you. Anything destructive an agent asks for returns a link you
        approve here first.
      </p>
      <p class="t-small mt-2">
        Rate limits, per credential, per minute: 600 reads, 120 writes, 20 AI requests. MCP allows 240 calls a minute.
      </p>
    </Panel>

    <Panel title="Recent external activity" flush>
      <table v-if="activity && activity.length > 0" class="table">
        <thead>
          <tr>
            <th>Who</th>
            <th>What</th>
            <th>Result</th>
            <th class="num col-wide">When</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in activity.slice(0, 30)" :key="entry.id">
            <td class="cell-token">{{ entry.channel.toUpperCase() }}: {{ entry.channelLabel ?? "unnamed" }}</td>
            <td>{{ entry.operation }}</td>
            <td>
              <Badge :tone="entry.result === 'complete' ? 'success' : entry.result === 'partial' ? 'warning' : 'error'">
                {{ entry.result }}
              </Badge>
            </td>
            <td class="num t-mono-sm col-wide">{{ entry.at.slice(0, 16).replace("T", " ") }}</td>
          </tr>
        </tbody>
      </table>
      <table v-else-if="!activity && !error" class="table" aria-busy="true">
        <tbody>
          <tr v-for="width in ['w-40', 'w-28', 'w-36']" :key="width">
            <td><Skeleton class="w-32" /></td>
            <td><Skeleton :class="width" /></td>
            <td><Skeleton class="h-5 w-16" /></td>
            <td class="num col-wide"><Skeleton class="w-28" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else message="Nothing has used your credentials yet." />
    </Panel>

    <!--
      What the product could not do. Each row is one distinct problem with a
      count, not one row per occurrence, so the number beside it is how badly it
      wants fixing.
    -->
    <Panel title="Backlog" flush data-testid="backlog">
      <template #actions>
        <span v-if="signals" class="t-mono-sm">{{ signals.length }}</span>
        <span v-else-if="!error" class="t-mono-sm"><Skeleton class="h-2.5 w-6" /></span>
        <button type="button" class="btn btn-tertiary btn-compact" @click="showSettled">
          {{ settledVisible ? "Only what is open" : "Include settled" }}
        </button>
      </template>
      <table v-if="signals && signals.length > 0" class="table">
        <thead>
          <tr>
            <th>What happened</th>
            <th>Kind</th>
            <th class="num">Times</th>
            <th class="num col-wide">Last</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="signal in signals" :key="signal.id" :data-testid="`signal-${signal.id}`">
            <td>{{ signal.summary }}</td>
            <td class="cell-token">{{ signal.kind.replace("_", " ") }}</td>
            <td class="num t-mono-sm">{{ signal.occurrences }}</td>
            <td class="num t-mono-sm col-wide">{{ signal.lastSeenAt.slice(0, 16).replace("T", " ") }}</td>
            <td>
              <div class="flex flex-wrap items-center gap-2">
                <Badge
                  :tone="
                    signal.status === 'resolved'
                      ? 'success'
                      : signal.status === 'planned'
                        ? 'accepted'
                        : signal.status === 'dismissed'
                          ? 'neutral'
                          : 'warning'
                  "
                >
                  {{ signal.status }}
                </Badge>
                <button
                  v-if="signal.status !== 'planned'"
                  type="button"
                  class="btn btn-tertiary btn-compact"
                  @click="settle(signal, 'planned')"
                >
                  Planned
                </button>
                <button
                  v-if="signal.status !== 'resolved'"
                  type="button"
                  class="btn btn-tertiary btn-compact"
                  @click="settle(signal, 'resolved')"
                >
                  Resolved
                </button>
                <button
                  v-if="signal.status !== 'dismissed'"
                  type="button"
                  class="btn btn-tertiary btn-compact"
                  @click="settle(signal, 'dismissed')"
                >
                  Dismiss
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <table v-else-if="!signals && !error" class="table" aria-busy="true">
        <tbody>
          <tr v-for="width in ['w-48', 'w-32']" :key="width">
            <td><Skeleton :class="width" /></td>
            <td><Skeleton class="w-20" /></td>
            <td class="num"><Skeleton class="w-6" /></td>
            <td class="num col-wide"><Skeleton class="w-28" /></td>
            <td><Skeleton class="h-7 w-48" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else message="Nothing has failed and nothing has been asked for that Pawalist cannot do." />
    </Panel>

    <!-- What actually gets used, counted rather than sampled, most-used first. -->
    <Panel title="Usage" flush data-testid="usage">
      <template #actions>
        <span v-if="usage" class="t-caption">{{ usage.from }} to {{ usage.to }}</span>
        <span v-else-if="!error" class="t-caption"><Skeleton class="h-2.5 w-36" /></span>
      </template>
      <table v-if="usage && usage.features.length > 0" class="table">
        <thead>
          <tr>
            <th>Feature</th>
            <th class="num">Total</th>
            <th class="num col-wide">Days used</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="feature in usage.features.slice(0, 60)" :key="feature.feature">
            <td class="cell-token">{{ feature.feature }}</td>
            <td class="num t-mono-sm">{{ feature.total }}</td>
            <td class="num t-mono-sm col-wide">{{ feature.days.length }}</td>
          </tr>
        </tbody>
      </table>
      <table v-else-if="!usage && !error" class="table" aria-busy="true">
        <tbody>
          <tr v-for="width in ['w-32', 'w-24', 'w-28']" :key="width">
            <td><Skeleton :class="width" /></td>
            <td class="num"><Skeleton class="w-8" /></td>
            <td class="num col-wide"><Skeleton class="w-6" /></td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-else message="Nothing has been counted in the last thirty days yet." />
    </Panel>
  </div>

  <Modal
    v-if="creating"
    :title="creating === 'api' ? 'New API credential' : 'Authorize an external agent'"
    @close="creating = null"
  >
    <label class="field-label" for="credential-name">Name</label>
    <input
      id="credential-name"
      v-model="name"
      class="input"
      data-testid="credential-name"
      placeholder="Build script, Claude Desktop"
    />

    <p class="field-label mt-4">What it may do</p>
    <!-- The whole row is the target, 32px tall and reaching past the box's left
         edge: the 16px checkbox alone was missed as often as hit on a phone. -->
    <div>
      <label v-for="scope in CREDENTIAL_SCOPES" :key="scope" class="-mx-2 flex min-h-8 items-center gap-2 px-2">
        <input
          type="checkbox"
          class="h-4 w-4 flex-none"
          :checked="scopes.includes(scope)"
          @change="toggleScope(scope)"
        />
        <span class="t-body">{{ SCOPE_LABELS[scope] }}</span>
      </label>
    </div>

    <template #actions>
      <button type="button" class="btn btn-secondary" @click="creating = null">Cancel</button>
      <button type="button" class="btn btn-primary" data-testid="credential-create" @click="create">Create</button>
    </template>
  </Modal>

  <Modal v-if="created" title="Copy this now" @close="((created = null), (copied = false))">
    <p class="t-body">
      This is the only time Pawalist can show it. The secret is stored as a hash, so nobody, including Pawalist, can
      read it back.
    </p>
    <pre class="code mt-3" data-testid="credential-secret">{{ created.secret }}</pre>
    <template #actions>
      <button type="button" class="btn btn-secondary" @click="copy">
        <Icon name="key" :size="16" /> {{ copied ? "Copied" : "Copy" }}
      </button>
      <button type="button" class="btn btn-primary" @click="((created = null), (copied = false))">Done</button>
    </template>
  </Modal>
</template>
