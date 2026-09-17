<script setup lang="ts">
import { useWaitlist } from '../composables/use-waitlist'
import UiButton from '@shared/ui/core/button.vue'
import UiInput from '@shared/ui/core/input.vue'

const emit = defineEmits<{
  success: []
}>()

const { email, restrictions, status, errorMessage, submit } = useWaitlist()

defineExpose({ restrictions })

async function handleSubmit() {
  await submit()
  if (status.value === 'success') {
    emit('success')
  }
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="w-full max-w-md mx-auto">
    <div v-if="status === 'success'" class="text-center py-4">
      <p class="text-lg font-semibold text-success-700">You're on the list!</p>
      <p class="text-sm text-neutral-500 mt-1">We'll email you when TinyPlates launches.</p>
    </div>

    <template v-else>
      <div class="flex gap-2">
        <div class="flex-1">
          <UiInput
            v-model="email"
            type="email"
            placeholder="your@email.com"
            :error="errorMessage"
            :disabled="status === 'loading'"
          />
        </div>
        <UiButton
          type="submit"
          variant="primary"
          size="lg"
          :disabled="status === 'loading'"
          glow
        >
          {{ status === 'loading' ? 'Joining…' : 'Get Started' }}
        </UiButton>
      </div>
      <p v-if="errorMessage" class="text-xs text-danger-600 font-medium mt-1.5">
        {{ errorMessage }}
      </p>
    </template>
  </form>
</template>
