import type { CaptchaPublicConfig, EcokuTheme } from './config'
import { CapWidget } from './cap'
import { TurnstileWidget } from './turnstile'

export interface ChallengeWidget {
  waitForToken(timeoutMs?: number): Promise<string>
  reset(): void
  remove(): void
}

export async function mountChallenge(
  container: HTMLElement,
  config: CaptchaPublicConfig,
  theme: EcokuTheme,
): Promise<ChallengeWidget | null> {
  if (config.provider === 'turnstile' && config.sitekey) {
    return TurnstileWidget.mount(container, config.sitekey, theme)
  }
  if (config.provider === 'cap' && config.sitekey && config.instanceUrl) {
    return CapWidget.mount(container, config, theme)
  }
  container.replaceChildren()
  return null
}
