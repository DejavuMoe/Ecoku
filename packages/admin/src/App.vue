<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  authenticated, sessionReady, logoutBusy, logoutMessage, loginBusy, loginMessage, view, toastMessage,
} = storeToRefs(store)

const views: { id: MainView; label: string }[] = [
  { id: 'comments', label: '评论管理' },
  { id: 'sites', label: '站点管理' },
  { id: 'notifications', label: '通知设置' },
  { id: 'security', label: '安全' },
]

const username = ref('')
const password = ref('')
const usernameInput = ref<HTMLInputElement | null>(null)
const primaryNav = ref<HTMLElement | null>(null)
const loginSlot = ref<HTMLElement | null>(null)
const loginCaptcha = ref<CaptchaPublicConfig>({ provider: 'off', sitekey: '', instanceUrl: '' })
let loginWidget: ChallengeWidget | null = null
const mobileDetail = ref(false)
const brandMark = '/admin/ecoku-mark.svg'
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
    primaryNav.value?.querySelector<HTMLButtonElement>('[aria-current="page"]')?.focus()
  } else {
    if (previous) {
      window.location.reload()
      return
    }
    usernameInput.value?.focus()
    await mountLoginChallenge()
  }
})

watch(view, () => {
  mobileDetail.value = false
})

onMounted(async () => {
  await store.restoreSession()
  if (!authenticated.value) await mountLoginChallenge()
})
onBeforeUnmount(() => {
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
  if (store.dirtyView && !window.confirm('放弃未保存的修改？\n退出后，本页的修改不会保存。')) return
  username.value = ''
  password.value = ''
  mobileDetail.value = false
  store.logout()
}

async function switchView(next: MainView) {
  if (next !== view.value && store.dirtyView && !window.confirm('放弃未保存的修改？\n离开后，本页的修改不会保存。')) return
  await store.switchView(next)
}
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>

  <main v-if="sessionReady && !authenticated" id="main-content" class="auth-screen">
    <section class="auth-shell" aria-labelledby="login-title">
      <span class="brand" aria-hidden="true"><img class="brand-seal" :src="brandMark" alt=""><span class="brand-name">Ecoku</span></span>
      <form class="login-card" novalidate @submit.prevent="submitLogin">
        <h1 id="login-title">管理员登录</h1>
        <p v-if="loginMessage" class="notice notice-error" role="alert">{{ loginMessage }}</p>
        <div class="field">
          <label class="field-label" for="login-username">用户名</label>
          <input id="login-username" ref="usernameInput" v-model="username" class="input" name="username" type="text" autocomplete="username" maxlength="80" required>
        </div>
        <div class="field">
          <label class="field-label" for="login-password">密码</label>
          <input id="login-password" v-model="password" class="input" name="password" type="password" autocomplete="current-password" required>
        </div>
        <div v-if="loginCaptcha.provider !== 'off'" ref="loginSlot" class="captcha-slot"></div>
        <button class="button button-primary login-button" type="submit" :disabled="loginBusy || !username.trim() || !password">{{ loginBusy ? '登录中…' : '登录' }}</button>
      </form>
    </section>
  </main>

  <div v-else-if="sessionReady" class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <button class="brand" type="button" aria-label="Ecoku 评论管理首页" @click="switchView('comments')">
          <img class="brand-seal" :src="brandMark" alt=""><span class="brand-name" aria-hidden="true">Ecoku</span>
        </button>
        <nav ref="primaryNav" class="primary-nav" aria-label="主导航">
          <button
            v-for="item in views"
            :key="item.id"
            class="nav-tab"
            type="button"
            :aria-current="view === item.id ? 'page' : undefined"
            @click="switchView(item.id)"
          >{{ item.label }}</button>
        </nav>
        <div class="header-end">
          <p v-if="logoutMessage" class="notice notice-error" role="alert">{{ logoutMessage }}</p>
          <button class="logout-button" type="button" :disabled="logoutBusy" @click="logout">退出登录</button>
        </div>
      </div>
    </header>

    <main id="main-content" class="main-area">
      <CommentManagementView v-if="view === 'comments'" :mobile-detail="mobileDetail" @mobile-detail="mobileDetail = $event" />
      <SiteManagementView v-else-if="view === 'sites'" />
      <NotificationSettingsView v-else-if="view === 'notifications'" />
      <SecurityView v-else />
    </main>

    <nav class="mobile-tabbar" aria-label="主导航（底部）">
      <button v-for="item in views" :key="`mobile-${item.id}`" class="mobile-tab" type="button" :aria-current="view === item.id ? 'page' : undefined" @click="switchView(item.id)">
        <AdminIcon :name="item.id === 'comments' ? 'comments' : item.id === 'sites' ? 'sites' : item.id === 'notifications' ? 'notify' : 'security'" />
        <span>{{ item.label.replace('管理', '').replace('设置', '') }}</span>
      </button>
    </nav>
  </div>

  <div class="sr-status" aria-live="polite">{{ visibleToast }}</div>
  <div v-if="visibleToast" class="toast" aria-hidden="true"><AdminIcon name="check" /><span>{{ visibleToast }}</span></div>
</template>
