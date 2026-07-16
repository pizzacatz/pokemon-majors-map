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

/**
 * Native share sheet on mobile (UX audit P1-9), clipboard fallback elsewhere.
 * Returns what actually happened so the button can say so.
 */
export async function sharePlanUrl(url: string): Promise<'shared' | 'copied' | 'failed'> {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'My Pokémon season plan', url })
      return 'shared'
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'failed' // user cancelled: stay quiet
      // fall through to clipboard
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed'
}
