<script lang="ts">
  import { tick, onMount, onDestroy, untrack } from 'svelte'

  import AdminIcon from './components/AdminIcon.svelte'
  import CommentManagementView from './components/CommentManagementView.svelte'
  import NotificationSettingsView from './components/NotificationSettingsView.svelte'
  import SecurityView from './components/SecurityView.svelte'
  import SiteManagementView from './components/SiteManagementView.svelte'
  import FirstLoginSetupView from './components/FirstLoginSetupView.svelte'
  import { useAdminStore } from './stores/admin.svelte'
  import { adminApi } from './api'
  import type { CaptchaPublicConfig, LoginConfig, MainView } from './types'
  import { mountChallenge, type ChallengeWidget } from './captcha'
  import { messages } from './messages'
  import {
    adminLocale,
    adminText,
    installAdminTranslations,
    refreshAdminTranslations,
    setAdminLocale
  } from './i18n.svelte'

  const store = useAdminStore()

  let views = $derived.by(() => [
    { id: 'comments' as const, label: adminText('comments') },
    { id: 'sites' as const, label: adminText('sites') },
    { id: 'notifications' as const, label: adminText('notifications') },
    { id: 'security' as const, label: adminText('security') }
  ])

  let username = $state('')
  let password = $state('')
  let usernameInput = $state<HTMLInputElement | null>(null)
  let loginSlot = $state<HTMLElement | null>(null)
  let loginCaptcha = $state<CaptchaPublicConfig>({ provider: 'off', sitekey: '', instanceUrl: '' })
  let loginLoadState = $state<'loading' | 'ready' | 'error'>('loading')
  const loginController = new AbortController()
  let loginWidget: ChallengeWidget | null = null
  let discardDialog = $state<HTMLDialogElement | null>(null)
  let navigationBusy = $derived.by(
    () => Boolean(store.dirtyView) && (store.siteBusy || store.notificationBusy || store.captchaBusy)
  )
  let returnFocus: HTMLElement | null = null
  let visibleToast = $state('')
  let toastTimer: ReturnType<typeof setTimeout> | undefined
  let stopAdminTranslations: (() => void) | undefined
  // The login configuration carries the admin locale, which a restored session needs too.
  let startupLoginConfig: Promise<LoginConfig> | null = null
  // Focus moves to the page heading only after a sign-in the user just submitted; a restored
  // session leaves focus alone, so the browser draws no focus ring on page load.
  let focusAfterSignIn = false

  $effect(() => {
    adminLocale.value
    queueMicrotask(refreshAdminTranslations)
  })

  let previousToast = untrack(() => store.toastSerial)
  $effect.pre(() => {
    const toastSerial = store.toastSerial
    if (toastSerial === previousToast) return
    previousToast = toastSerial
    void untrack(async () => {
      const value = store.toastMessage
      if (!value) return
      // Clear first so that a repeated message is shown and announced again.
      visibleToast = ''
      await tick()
      if (loginController.signal.aborted) return
      if (toastTimer !== undefined) clearTimeout(toastTimer)
      visibleToast = value
      toastTimer = setTimeout(() => {
        visibleToast = ''
      }, 3200)
    })
  })

  // Ending a session reloads the page so that the login form gets a CSP matching the current
  // CAPTCHA provider. The history entry carries the expiry notice across that reload.
  const sessionNoticeKey = 'ecokuAdminNotice'
  function reloadAfterSessionEnd() {
    if (store.loginMessage === messages.sessionExpired) {
      try {
        history.replaceState({ [sessionNoticeKey]: 'session-expired' }, '')
      } catch {
        /* the notice is optional */
      }
    }
    window.location.reload()
  }
  function takeSessionNotice(): boolean {
    const state: unknown = history.state
    if (
      !state ||
      typeof state !== 'object' ||
      (state as Record<string, unknown>)[sessionNoticeKey] !== 'session-expired'
    )
      return false
    try {
      history.replaceState(null, '')
    } catch {
      /* ignore */
    }
    return true
  }

  let previousAuthenticated = untrack(() => store.authenticated)
  $effect.pre(() => {
    const authenticated = store.authenticated
    if (authenticated === previousAuthenticated) return
    const value = authenticated
    const previous = previousAuthenticated
    previousAuthenticated = authenticated
    void untrack(async () => {
      await tick()
      if (loginController.signal.aborted) return
      if (value) {
        loginWidget?.remove()
        loginWidget = null
        loginCaptcha = { provider: 'off', sitekey: '', instanceUrl: '' }
        if (focusAfterSignIn) {
          focusAfterSignIn = false
          document.querySelector<HTMLElement>('#main-content h1, #setup-title')?.focus({ preventScroll: true })
        }
      } else {
        if (previous) {
          reloadAfterSessionEnd()
          return
        }
        usernameInput?.focus()
        await mountLoginChallenge()
      }
    })
  })

  let previousView = untrack(() => store.view)
  $effect.pre(() => {
    const view = store.view
    if (view === previousView) return
    previousView = view
    void untrack(async () => {
      await tick()
      if (loginController.signal.aborted) return
      document.querySelector<HTMLElement>('#main-content h1')?.focus()
    })
  })
  let previousDiscard = untrack(() => store.discardRequested)
  $effect.pre(() => {
    const discard = store.discardRequested
    if (discard === previousDiscard) return
    const open = discard
    previousDiscard = discard
    void untrack(async () => {
      if (open) returnFocus = document.activeElement as HTMLElement
      await tick()
      if (loginController.signal.aborted) return
      if (open && !discardDialog?.open) discardDialog?.showModal()
      if (!open && discardDialog?.open) {
        discardDialog.close()
        returnFocus?.focus()
      }
    })
  })
  function beforeUnload(event: BeforeUnloadEvent) {
    if (store.dirtyView) {
      event.preventDefault()
      event.returnValue = ''
    }
  }

  onMount(async () => {
    stopAdminTranslations = installAdminTranslations(document.body)
    startupLoginConfig = adminApi.getLoginConfig(loginController.signal)
    startupLoginConfig.then(
      (config) => {
        if (!loginController.signal.aborted) setAdminLocale(config.locale)
      },
      () => undefined
    )
    const expired = takeSessionNotice()
    window.addEventListener('beforeunload', beforeUnload)
    await store.restoreSession()
    if (!store.authenticated && !loginController.signal.aborted) {
      if (expired && !store.loginMessage) store.loginMessage = messages.sessionExpired
      await tick()
      usernameInput?.focus()
      await mountLoginChallenge()
    }
  })
  onDestroy(() => {
    loginController.abort()
    window.removeEventListener('beforeunload', beforeUnload)
    if (toastTimer !== undefined) clearTimeout(toastTimer)
    loginWidget?.remove()
    loginWidget = null
    stopAdminTranslations?.()
  })

  async function mountLoginChallenge() {
    loginLoadState = 'loading'
    if (store.loginMessage === messages.loginChallengeUnavailable) store.loginMessage = ''
    loginWidget?.remove()
    loginWidget = null
    loginCaptcha = { provider: 'off', sitekey: '', instanceUrl: '' }
    try {
      const pending = startupLoginConfig ?? adminApi.getLoginConfig(loginController.signal)
      startupLoginConfig = null
      const config = await pending
      if (loginController.signal.aborted) return
      setAdminLocale(config.locale)
      loginCaptcha = config.captcha
      await tick()
      if (loginCaptcha.provider !== 'off') {
        if (!loginSlot) throw new Error('Login challenge container missing')
        const widget = await mountChallenge(loginSlot, loginCaptcha)
        if (loginController.signal.aborted) {
          widget?.remove()
          return
        }
        if (!widget) throw new Error('Login challenge unavailable')
        loginWidget = widget
      }
      loginLoadState = 'ready'
    } catch {
      loginWidget = null
      if (loginController.signal.aborted) return
      loginLoadState = 'error'
      store.loginMessage = messages.loginChallengeUnavailable
    }
  }

  async function submitLogin() {
    if (loginLoadState === 'loading' || store.loginBusy) return
    if (loginLoadState === 'error') {
      await mountLoginChallenge()
      return
    }
    if (!username.trim() || !password) return
    focusAfterSignIn = true
    if (loginCaptcha.provider !== 'off') {
      let token = ''
      try {
        token = (await loginWidget?.waitForToken()) ?? ''
      } catch {
        token = ''
      }
      if (!token) {
        store.loginMessage = messages.loginChallengeRequired
        return
      }
      const succeeded = await store.login(username.trim(), password, token)
      password = ''
      loginWidget?.reset()
      if (succeeded) username = ''
      return
    }
    const succeeded = await store.login(username.trim(), password)
    password = ''
    if (succeeded) username = ''
  }

  function logout() {
    username = ''
    password = ''
    store.requestNavigation(() => store.logout())
  }

  async function switchView(next: MainView) {
    if (!navigationBusy && next !== store.view) store.requestNavigation(() => store.switchView(next))
  }
</script>

<a href="#main-content" class="skip-link">{adminText('skip')}</a><svg
  width="0"
  height="0"
  aria-hidden="true"
  class="brand-symbols"
  ><symbol id="ecoku-seal" viewBox="0 0 64 64"
    ><path
      style="fill: var(--seal)"
      d="M13.4 4.3C25.8 3.8 38.6 3.8 50.7 4.3c5.3.2 8.9 3.7 9.1 9 .4 12.5.4 25 0 37.5-.2 5.4-3.8 8.9-9.1 9.1-12.4.4-25 .4-37.4 0-5.3-.2-8.8-3.7-9-9-.4-12.5-.4-25.1 0-37.6.2-5.3 3.8-8.8 9.1-9Z"
    ></path><path
      style="stroke: var(--seal-cut)"
      d="M53.5 12.6H12.6v38.8h40.9"
      fill="none"
      stroke-width="4.2"
      stroke-linejoin="round"
    ></path><g style="stroke: var(--seal-cut)" fill="none" stroke-width="3.6" stroke-linejoin="round"
      ><rect x="30.55" y="19.7" width="10.3" height="8.9"></rect><rect x="19.7" y="35.4" width="12.6" height="8.9"
      ></rect><rect x="39.1" y="35.4" width="12.6" height="8.9"></rect></g
    ></symbol
  ></svg
>{#if store.sessionReady && !store.authenticated}<main id="main-content" class="auth">
    <section aria-labelledby="login-title" class="auth-sheet">
      <div aria-hidden="true" class="auth-brand">
        <svg class="seal"><use href="#ecoku-seal"></use></svg><span class="wordmark">Ecoku</span>
      </div>
      <form
        novalidate
        onsubmit={(event) => {
          event.preventDefault()
          submitLogin()
        }}
        class="auth-form"
      >
        <h1 id="login-title">{adminText('loginTitle')}</h1>
        {#if store.loginMessage}<p role="alert" class="notice notice-error">{store.loginMessage}</p>{/if}<label
          class="rule"
          ><span class="rule-label">{adminText('username')}</span><input
            id="login-username"
            bind:this={usernameInput}
            bind:value={username}
            name="username"
            type="text"
            autocomplete="username"
            maxlength="80"
            required
          /></label
        ><label class="rule"
          ><span class="rule-label">{adminText('password')}</span><input
            id="login-password"
            bind:value={password}
            name="password"
            type="password"
            autocomplete="current-password"
            required
          /></label
        >{#if loginCaptcha.provider !== 'off'}<div bind:this={loginSlot} class="captcha-slot"></div>{/if}<button
          type="submit"
          disabled={store.loginBusy ||
            loginLoadState === 'loading' ||
            (loginLoadState === 'ready' && (!username.trim() || !password))}
          class="button button-primary button-block"
          >{loginLoadState === 'loading'
            ? adminText('loading')
            : loginLoadState === 'error'
              ? adminText('retry')
              : store.loginBusy
                ? adminText('loggingIn')
                : adminText('login')}</button
        >
      </form>
    </section>
  </main>{:else if store.sessionReady && store.passwordSetupRequired}<FirstLoginSetupView
  />{:else if store.sessionReady}<div class="app">
    <header class="masthead">
      <div class="masthead-inner layout">
        <div class="in-margin masthead-brand">
          <button
            type="button"
            aria-label="Ecoku 评论管理首页"
            disabled={navigationBusy}
            onclick={() => {
              switchView('comments')
            }}
            class="brand"
            ><svg aria-hidden="true" class="seal"><use href="#ecoku-seal"></use></svg><span
              aria-hidden="true"
              class="wordmark">Ecoku</span
            ></button
          >
        </div>
        <div class="in-main masthead-main">
          <nav aria-label="主导航" class="nav">
            {#each views as item (item.id)}<button
                type="button"
                aria-current={store.view === item.id ? 'page' : undefined}
                disabled={navigationBusy}
                onclick={() => {
                  switchView(item.id)
                }}
                class="nav-link">{item.label}</button
              >{/each}
          </nav>
          {#if store.logoutMessage}<p role="alert" class="inline-error">{store.logoutMessage}</p>{/if}<button
            type="button"
            disabled={store.logoutBusy || navigationBusy}
            onclick={logout}
            class="quiet-link logout">{adminText('logout')}</button
          >
        </div>
      </div>
    </header>
    <main id="main-content" class="main">
      {#if store.view === 'comments'}<CommentManagementView />{:else if store.view === 'sites'}<SiteManagementView
        />{:else if store.view === 'notifications'}<NotificationSettingsView />{:else}<SecurityView />{/if}
    </main>
    <nav aria-label="主导航（底部）" class="tabbar">
      {#each views as item (item.id)}<button
          type="button"
          aria-current={store.view === item.id ? 'page' : undefined}
          disabled={navigationBusy}
          onclick={() => {
            switchView(item.id)
          }}
          class="tabbar-item"><AdminIcon name={item.id} class="tabbar-icon" /><span>{item.label}</span></button
        >{/each}
    </nav>
  </div>{/if}
<dialog
  bind:this={discardDialog}
  aria-labelledby="discard-title"
  aria-describedby="discard-copy"
  oncancel={(event) => {
    event.preventDefault()
    store.resolveNavigation(false)
  }}
  onclose={() => {
    store.resolveNavigation(false)
  }}
>
  <div class="dialog-body">
    <h2 id="discard-title">{adminText('discardTitle')}</h2>
    <p id="discard-copy">{adminText('discardCopy')}</p>
  </div>
  <div class="dialog-actions">
    <button
      type="button"
      onclick={() => {
        store.resolveNavigation(false)
      }}
      class="button button-quiet">{adminText('continue')}</button
    ><button
      type="button"
      onclick={() => {
        store.resolveNavigation(true)
      }}
      class="button button-danger">{adminText('discard')}</button
    >
  </div>
</dialog>
<div aria-live="polite" class="visually-hidden">{visibleToast}</div>
{#if visibleToast}<div aria-hidden="true" class="toast"><AdminIcon name="check" /><span>{visibleToast}</span></div>{/if}
