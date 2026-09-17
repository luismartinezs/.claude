export interface UtmParams {
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
}

export function parseUtmParams(search: string): UtmParams {
  const params = new URLSearchParams(search)
  return {
    utmSource: params.get('utm_source') || null,
    utmMedium: params.get('utm_medium') || null,
    utmCampaign: params.get('utm_campaign') || null,
  }
}

export function extractFirstErrorMessage(issues: ReadonlyArray<{ message: string }>): string {
  return issues[0]?.message ?? 'Invalid input'
}
