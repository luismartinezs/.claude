import { ref } from 'vue'
import { WaitlistEntrySchema, type WaitlistResponse } from '@repo/api-types'
import { trackEvent } from '@shared/analytics/track-event'
import { parseUtmParams, extractFirstErrorMessage } from './waitlist.logic'

type Status = 'idle' | 'loading' | 'success' | 'error'

export function useWaitlist() {
  const email = ref('')
  const restrictions = ref<string[]>(['dairy-free', 'nut-free', 'egg-free'])
  const status = ref<Status>('idle')
  const errorMessage = ref('')

  async function submit() {
    errorMessage.value = ''

    const body = {
      email: email.value,
      restrictions: restrictions.value,
      ...parseUtmParams(window.location.search),
    }

    const parsed = WaitlistEntrySchema.safeParse(body)
    if (!parsed.success) {
      status.value = 'error'
      errorMessage.value = extractFirstErrorMessage(parsed.error.issues)
      return
    }

    status.value = 'loading'

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })

      const data: WaitlistResponse = await res.json()

      if (!res.ok || !data.success) {
        status.value = 'error'
        errorMessage.value = data.message ?? 'Something went wrong'
        return
      }

      status.value = 'success'
      trackEvent('email-submit')
      window.location.href = '/pricing'
    } catch {
      status.value = 'error'
      errorMessage.value = 'Network error — please try again'
    }
  }

  return { email, restrictions, status, errorMessage, submit }
}
