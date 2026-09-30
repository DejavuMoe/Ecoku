<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AdminIcon from './components/AdminIcon.vue'
import CommentManagementView from './components/CommentManagementView.vue'
import NotificationSettingsView from './components/NotificationSettingsView.vue'
import SecurityView from './components/SecurityView.vue'
import SiteManagementView from './components/SiteManagementView.vue'
import { useAdminStore } from './stores/admin'
import { adminApi } from './api'
import type { CaptchaPublicConfig, MainView } from './types'
import { mountChallenge, type ChallengeWidget } from './captcha'
import { messages } from './messages'

const store = useAdminStore()
const {
  authenticated, sessionReady, logoutBusy, logoutMessage, loginBusy, loginMessage, view, toastMessage, dirtyView, discardRequested,
} = storeToRefs(store)

const views: { id: MainView; label: string }[] = [
  { id: 'comments', label: '评论' },
  { id: 'sites', label: '站点' },
  { id: 'notifications', label: '通知' },
  { id: 'security', label: '安全' },
]

const username = ref('')
const password = ref('')
const usernameInput = ref<HTMLInputElement | null>(null)
const primaryNav = ref<HTMLElement | null>(null)
const loginSlot = ref<HTMLElement | null>(null)
const loginCaptcha = ref<CaptchaPublicConfig>({ provider: 'off', sitekey: '', instanceUrl: '' })
let loginWidget: ChallengeWidget | null = null
const discardDialog = ref<HTMLDialogElement | null>(null)
const navigationBusy = computed(() => Boolean(dirtyView.value) && (store.siteBusy || store.notificationBusy || store.captchaBusy))
let returnFocus: HTMLElement | null = null
const visibleToast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

watch(toastMessage, (value) => {
  if (!value) return
  visibleToast.value = value
  if (toastTimer !== undefined) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { visibleToast.value = '' }, 3200)
})

watch(authenticated, async (value, previous) => {
  await nextTick()
  if (value) {
    loginWidget?.remove()
    loginWidget = null
    loginCaptcha.value = { provider: 'off', sitekey: '', instanceUrl: '' }
    const nav = primaryNav.value?.offsetParent ? primaryNav.value : document.querySelector('.tabbar')
    nav?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus()
  } else {
    if (previous) {
      window.location.reload()
      return
    }
    usernameInput.value?.focus()
    await mountLoginChallenge()
  }
})

watch(view, async () => { await nextTick(); document.querySelector<HTMLElement>('#main-content h1')?.focus() })
watch(discardRequested, async (open) => {
  if (open) returnFocus = document.activeElement as HTMLElement
  await nextTick()
  if (open && !discardDialog.value?.open) discardDialog.value?.showModal()
  if (!open && discardDialog.value?.open) { discardDialog.value.close(); returnFocus?.focus() }
})
function saveShortcut(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === 's' && dirtyView.value && !discardRequested.value) { event.preventDefault(); document.querySelector<HTMLButtonElement>('.save-button')?.click() }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirtyView.value) { event.preventDefault(); event.returnValue = '' }
}

onMounted(async () => {
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('keydown', saveShortcut)
  await store.restoreSession()
  if (!authenticated.value) {
    await nextTick()
    usernameInput.value?.focus()
    await mountLoginChallenge()
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  document.removeEventListener('keydown', saveShortcut)
  if (toastTimer !== undefined) clearTimeout(toastTimer)
  loginWidget?.remove()
  loginWidget = null
})

async function mountLoginChallenge() {
  loginWidget?.remove()
  loginWidget = null
  loginCaptcha.value = { provider: 'off', sitekey: '', instanceUrl: '' }
  try {
    const config = await adminApi.getLoginConfig()
    loginCaptcha.value = config.captcha
    await nextTick()
    if (loginCaptcha.value.provider !== 'off' && loginSlot.value) {
      loginWidget = await mountChallenge(loginSlot.value, loginCaptcha.value)
    }
  } catch {
    loginWidget = null
  }
}

async function submitLogin() {
  if (loginCaptcha.value.provider !== 'off') {
    let token = ''
    try { token = await loginWidget?.waitForToken() ?? '' } catch { token = '' }
    if (!token) {
      store.loginMessage = messages.loginChallengeRequired
      return
    }
    const succeeded = await store.login(username.value.trim(), password.value, token)
    password.value = ''
    loginWidget?.reset()
    if (succeeded) username.value = ''
    return
  }
  const succeeded = await store.login(username.value.trim(), password.value)
  password.value = ''
  if (succeeded) username.value = ''
}

function logout() {
  username.value = ''
  password.value = ''
  store.requestNavigation(() => store.logout())
}

async function switchView(next: MainView) {
  if (!navigationBusy.value && next !== view.value) store.requestNavigation(() => store.switchView(next))
}

</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>
  <svg width="0" height="0" class="brand-symbols" aria-hidden="true">
    <symbol id="ecoku-seal" viewBox="0 0 64 64">
      <path style="fill: var(--seal)" d="M13.4 4.3C25.8 3.8 38.6 3.8 50.7 4.3c5.3.2 8.9 3.7 9.1 9 .4 12.5.4 25 0 37.5-.2 5.4-3.8 8.9-9.1 9.1-12.4.4-25 .4-37.4 0-5.3-.2-8.8-3.7-9-9-.4-12.5-.4-25.1 0-37.6.2-5.3 3.8-8.8 9.1-9Z" />
      <path style="stroke: var(--seal-cut)" d="M53.5 12.6H12.6v38.8h40.9" fill="none" stroke-width="4.2" stroke-linejoin="round" />
      <g style="stroke: var(--seal-cut)" fill="none" stroke-width="3.6" stroke-linejoin="round"><rect x="30.55" y="19.7" width="10.3" height="8.9" /><rect x="19.7" y="35.4" width="12.6" height="8.9" /><rect x="39.1" y="35.4" width="12.6" height="8.9" /></g>
    </symbol>
  </svg>

  <main v-if="sessionReady && !authenticated" id="main-content" class="auth">
    <section class="auth-sheet" aria-labelledby="login-title">
      <div class="auth-brand" aria-hidden="true"><svg class="seal"><use href="#ecoku-seal" /></svg><span class="wordmark">Ecoku</span></div>
      <form class="auth-form" novalidate @submit.prevent="submitLogin">
        <h1 id="login-title">管理员登录</h1>
        <p v-if="loginMessage" class="notice notice-error" role="alert">{{ loginMessage }}</p>
        <label class="rule"><span class="rule-label">用户名</span><input id="login-username" ref="usernameInput" v-model="username" name="username" type="text" autocomplete="username" maxlength="80" required></label>
        <label class="rule"><span class="rule-label">密码</span><input id="login-password" v-model="password" name="password" type="password" autocomplete="current-password" required></label>
        <div v-if="loginCaptcha.provider !== 'off'" ref="loginSlot" class="captcha-slot"></div>
        <button class="button button-primary button-block" type="submit" :disabled="loginBusy || !username.trim() || !password">{{ loginBusy ? '登录中…' : '登录' }}</button>
      </form>
    </section>
  </main>

  <div v-else-if="sessionReady" class="app">
    <header class="masthead">
      <div class="masthead-inner layout">
        <div class="in-margin masthead-brand"><button class="brand" type="button" aria-label="Ecoku 评论管理首页" :disabled="navigationBusy" @click="switchView('comments')"><svg class="seal" aria-hidden="true"><use href="#ecoku-seal" /></svg><span class="wordmark" aria-hidden="true">Ecoku</span></button></div>
        <div class="in-main masthead-main">
          <nav ref="primaryNav" class="nav" aria-label="主导航">
            <button v-for="item in views" :key="item.id" class="nav-link" type="button" :aria-current="view === item.id ? 'page' : undefined" :disabled="navigationBusy" @click="switchView(item.id)">{{ item.label }}</button>
          </nav>
          <p v-if="logoutMessage" class="inline-error" role="alert">{{ logoutMessage }}</p>
          <button class="quiet-link logout" type="button" :disabled="logoutBusy || navigationBusy" @click="logout">退出登录</button>
        </div>
      </div>
    </header>
    <main id="main-content" class="main">
      <CommentManagementView v-if="view === 'comments'" />
      <SiteManagementView v-else-if="view === 'sites'" />
      <NotificationSettingsView v-else-if="view === 'notifications'" />
      <SecurityView v-else />
    </main>
    <nav class="tabbar" aria-label="主导航（底部）"><button v-for="item in views" :key="item.id" class="tabbar-item" type="button" :aria-current="view === item.id ? 'page' : undefined" :disabled="navigationBusy" @click="switchView(item.id)"><AdminIcon :name="item.id" class="tabbar-icon" /><span>{{ item.label }}</span></button></nav>
  </div>

  <dialog ref="discardDialog" aria-labelledby="discard-title" aria-describedby="discard-copy" @cancel.prevent="store.resolveNavigation(false)" @close="store.resolveNavigation(false)">
    <div class="dialog-body"><h2 id="discard-title">放弃未保存的修改？</h2><p id="discard-copy">离开后，本页的修改不会保存。</p></div>
    <div class="dialog-actions"><button class="button button-quiet" type="button" autofocus @click="store.resolveNavigation(false)">继续编辑</button><button class="button button-danger" type="button" @click="store.resolveNavigation(true)">放弃修改</button></div>
  </dialog>
  <div class="visually-hidden" aria-live="polite">{{ visibleToast }}</div>
  <div v-if="visibleToast" class="toast" aria-hidden="true"><AdminIcon name="check" /><span>{{ visibleToast }}</span></div>
</template>
