import type { CaptchaPublicConfig } from './types'
import { CapWidget } from './cap'
import { TurnstileWidget } from './turnstile'

export interface ChallengeWidget {
  waitForToken(timeoutMs?: number): Promise<string>
  reset(): void
  remove(): void
}

export async function mountChallenge(container: HTMLElement, config: CaptchaPublicConfig): Promise<ChallengeWidget | null> {
  if (config.provider === 'turnstile' && config.sitekey) {
    return TurnstileWidget.mount(container, config.sitekey)
  }
  if (config.provider === 'cap' && config.sitekey && config.instanceUrl) {
    return CapWidget.mount(container, config)
  }
  container.replaceChildren()
  return null
}
