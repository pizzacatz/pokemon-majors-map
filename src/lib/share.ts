/** Season plan sharing via ?plan=<comma-separated event ids> (PRD §4.6). */

export function readPlanFromUrl(): string[] | null {
  const plan = new URLSearchParams(window.location.search).get('plan')
  if (!plan) return null
  const ids = plan.split(',').map((s) => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

export function clearPlanFromUrl(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('plan')
  window.history.replaceState(null, '', url)
}

export function buildPlanUrl(checkedIds: string[]): string {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('plan', checkedIds.join(','))
  return url.toString()
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
