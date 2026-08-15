<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import CommentManagementView from './components/CommentManagementView.vue'
import NotificationSettingsView from './components/NotificationSettingsView.vue'
import SecurityView from './components/SecurityView.vue'
import SiteManagementView from './components/SiteManagementView.vue'
import { useAdminStore } from './stores/admin'
import { adminApi } from './api'
import type { MainView } from './types'
import { TurnstileWidget } from './turnstile'
import { messages } from './messages'

const store = useAdminStore()
const {
  authenticated, loginBusy, loginMessage, view,
  sites, selectedSiteId, selectedSite, siteBusy, toastMessage,
} = storeToRefs(store)

const username = ref('')
const password = ref('')
const usernameInput = ref<HTMLInputElement | null>(null)
const loginSlot = ref<HTMLElement | null>(null)
const loginSitekey = ref('')
let loginWidget: TurnstileWidget | null = null
const sitePicker = ref<HTMLElement | null>(null)
const siteTrigger = ref<HTMLButtonElement | null>(null)
const siteMenu = ref<HTMLElement | null>(null)
const siteMenuOpen = ref(false)
const mobileDetail = ref(false)
const visibleToast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

watch(toastMessage, (value) => {
  if (!value) return
  visibleToast.value = value
  if (toastTimer !== undefined) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { visibleToast.value = '' }, 3200)
})

watch(authenticated, async (value) => {
  await nextTick()
  if (value) {
    loginWidget?.remove()
    loginWidget = null
    loginSitekey.value = ''
    siteTrigger.value?.focus()
  } else {
    usernameInput.value?.focus()
    await mountLoginChallenge()
  }
})

watch(view, () => {
  siteMenuOpen.value = false
  mobileDetail.value = false
})

function handleDocumentPointerDown(event: PointerEvent) {
  if (siteMenuOpen.value && !sitePicker.value?.contains(event.target as Node)) siteMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  if (!authenticated.value) void mountLoginChallenge()
})
onBeforeUnmount(() => {
  if (toastTimer !== undefined) clearTimeout(toastTimer)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  loginWidget?.remove()
  loginWidget = null
})

async function mountLoginChallenge() {
  loginWidget?.remove()
  loginWidget = null
  loginSitekey.value = ''
  try {
    const config = await adminApi.getLoginConfig()
    loginSitekey.value = config.turnstileSitekey
    await nextTick()
    if (loginSitekey.value && loginSlot.value) {
      loginWidget = await TurnstileWidget.mount(loginSlot.value, loginSitekey.value)
    }
  } catch {
    loginWidget = null
  }
}

async function submitLogin() {
  if (loginSitekey.value) {
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
  siteMenuOpen.value = false
  mobileDetail.value = false
  store.logout()
}

async function switchView(next: MainView) {
  await store.switchView(next)
}

async function chooseSite(siteId: string) {
  siteMenuOpen.value = false
  mobileDetail.value = false
  await store.selectSite(siteId)
  await nextTick()
  siteTrigger.value?.focus()
}

async function toggleSiteMenu(open = !siteMenuOpen.value) {
  if (siteBusy.value || sites.value.length === 0) return
  siteMenuOpen.value = open
  if (!open) return
  await nextTick()
  siteMenu.value?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus()
}

function handleSiteMenuKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    siteMenuOpen.value = false
    siteTrigger.value?.focus()
    return
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const options = Array.from(siteMenu.value?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])
  if (!options.length) return
  const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement)
  const nextIndex = event.key === 'Home'
    ? 0
    : event.key === 'End'
      ? options.length - 1
      : (currentIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
  options[nextIndex]?.focus()
}
</script>

<template>
  <a class="skip-link" href="#main-content">跳到主要内容</a>

  <main v-if="!authenticated" id="main-content" class="auth-screen">
    <section class="auth-shell" aria-labelledby="login-title">
      <form class="login-form" novalidate @submit.prevent="submitLogin">
        <div class="login-brand" aria-hidden="true">
          <span class="brand-mark">E</span>
          <span class="brand-copy"><strong>Ecoku</strong><small>评论管理</small></span>
        </div>
        <h1 id="login-title">管理员登录</h1>
        <p v-if="loginMessage" class="form-error" role="alert">{{ loginMessage }}</p>
        <label class="input-group"><span>用户名</span><input ref="usernameInput" v-model="username" name="username" type="text" autocomplete="username" maxlength="80" required></label>
        <label class="input-group"><span>密码</span><input v-model="password" name="password" type="password" autocomplete="current-password" required></label>
        <div v-if="loginSitekey" ref="loginSlot" class="turnstile-slot"></div>
        <button class="button button-primary login-button" type="submit" :disabled="loginBusy || !username.trim() || !password">{{ loginBusy ? '登录中…' : '登录' }}</button>
      </form>
    </section>
  </main>

  <div v-else class="app-shell">
    <header class="app-header">
      <div class="header-inner">
        <div class="header-start">
          <button class="brand" type="button" aria-label="Ecoku 评论管理首页" @click="switchView('comments')">
            <span class="brand-mark" aria-hidden="true">E</span>
            <span class="brand-copy"><strong>Ecoku</strong><small>评论管理</small></span>
          </button>
          <nav class="primary-nav" aria-label="主导航">
            <button class="nav-tab" type="button" :aria-current="view === 'comments' ? 'page' : undefined" @click="switchView('comments')">评论管理</button>
            <button class="nav-tab" type="button" :aria-current="view === 'sites' ? 'page' : undefined" @click="switchView('sites')">站点管理</button>
            <button class="nav-tab" type="button" :aria-current="view === 'notifications' ? 'page' : undefined" @click="switchView('notifications')">通知设置</button>
            <button class="nav-tab" type="button" :aria-current="view === 'security' ? 'page' : undefined" @click="switchView('security')">安全</button>
          </nav>
        </div>
        <div class="header-context">
          <div ref="sitePicker" class="site-picker">
            <button
              ref="siteTrigger"
              class="site-trigger"
              type="button"
              aria-haspopup="listbox"
              :aria-expanded="siteMenuOpen"
              :disabled="siteBusy || sites.length === 0"
              @click="toggleSiteMenu()"
            ><span>{{ selectedSite?.name || selectedSite?.siteUrl || '没有可用站点' }}</span><span class="chevron" aria-hidden="true" /></button>
            <div v-show="siteMenuOpen" ref="siteMenu" class="site-menu" role="listbox" aria-label="选择站点" @keydown="handleSiteMenuKeydown">
              <button
                v-for="site in sites"
                :key="site.id"
                class="site-option"
                type="button"
                role="option"
                :aria-selected="selectedSiteId === site.id"
                @click="chooseSite(site.id)"
              ><span>{{ site.name || site.siteUrl }}</span><small>{{ site.id }}</small></button>
            </div>
          </div>
          <button class="logout-button" type="button" @click="logout">退出登录</button>
        </div>
      </div>
    </header>

    <main id="main-content" class="main-area">
      <CommentManagementView v-if="view === 'comments'" :mobile-detail="mobileDetail" @mobile-detail="mobileDetail = $event" />
      <SiteManagementView v-else-if="view === 'sites'" />
      <NotificationSettingsView v-else-if="view === 'notifications'" />
      <SecurityView v-else />
    </main>
  </div>

  <div class="sr-status" aria-live="polite">{{ visibleToast }}</div>
  <div v-if="visibleToast" class="toast" role="status">{{ visibleToast }}</div>
</template>
