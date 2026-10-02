<script setup lang="ts">
import { computed } from 'vue';
import { agentSelectionContract, type AgentSelection } from '../contracts/agent.ts';

// The runtime, model and effort the next question will use.
//
// THE LISTS COME FROM THE CONTRACT, never from literals here. A hardcoded list in the UI drifts from
// what the CLI accepts, and the operator finds out by picking a model that fails on the server.
// Choosing a runtime narrows the other two to what that runtime actually supports.
const selection = defineModel<AgentSelection>({ required: true });

const allowed = computed(() => agentSelectionContract.runtimes[selection.value.runtime]);
const runtimes = computed(() => Object.keys(agentSelectionContract.runtimes) as AgentSelection['runtime'][]);

const label: Record<AgentSelection['runtime'], string> = {
  codex: 'Codex',
  'claude-code': 'Claude Code',
};

const chooseRuntime = (value: string): void => {
  const runtime = runtimes.value.find(candidate => candidate === value);
  if (!runtime) return;
  const supported = agentSelectionContract.runtimes[runtime];
  // Keep the operator's model and effort if the new runtime has them; otherwise its first, which is
  // always a valid selection. Carrying an unsupported label over is how a selector produces a
  // request the server rejects.
  selection.value = {
    runtime,
    model: supported.models.includes(selection.value.model) ? selection.value.model : supported.models[0]!,
    effort: supported.efforts.includes(selection.value.effort) ? selection.value.effort : supported.efforts[0]!,
  };
};
</script>

<template>
  <fieldset class="agent-selectors">
    <legend>Agent</legend>
    <label>
      Runtime
      <select
        :value="selection.runtime"
        aria-label="Agent runtime"
        @change="chooseRuntime(($event.target as HTMLSelectElement).value)"
      >
        <option v-for="runtime in runtimes" :key="runtime" :value="runtime">{{ label[runtime] }}</option>
      </select>
    </label>
    <label>
      Model
      <select v-model="selection.model" aria-label="Agent model">
        <option v-for="model in allowed.models" :key="model" :value="model">{{ model }}</option>
      </select>
    </label>
    <label>
      Effort
      <select v-model="selection.effort" aria-label="Agent effort">
        <option v-for="effort in allowed.efforts" :key="effort" :value="effort">{{ effort }}</option>
      </select>
    </label>
  </fieldset>
</template>
