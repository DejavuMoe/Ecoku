<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import ChipInput from './ChipInput.vue'
import { useAdminStore } from '../stores/admin'
import { cloneEmailSettings, cloneTelegramSettings, emptyEmailSettings, emptyTelegramSettings } from '../ui'
import type { EmailNotificationSettings, TelegramNotificationSettings } from '../types'

type EmailDraft = Omit<EmailNotificationSettings, 'port'> & { port: number | null }

const store = useAdminStore()
const {
  notificationSettings, notificationBusy, notificationMessage,
  emailTestState, emailTestMessage, telegramTestState, telegramTestMessage,
} = storeToRefs(store)

const email = reactive<EmailDraft>({ ...emptyEmailSettings(), port: null })
const telegram = reactive<TelegramNotificationSettings>(emptyTelegramSettings())
const emailErrors = reactive<Record<string, string>>({})
const telegramErrors = reactive<Record<string, string>>({})
const persistedEmailEnabled = ref(false)
const persistedTelegramEnabled = ref(false)
const emailSaveDisabled = computed(() => notificationBusy.value || (!email.enabled && email.enabled === persistedEmailEnabled.value))
const telegramSaveDisabled = computed(() => notificationBusy.value || (!telegram.enabled && telegram.enabled === persistedTelegramEnabled.value))

function applyEmail(settings: EmailNotificationSettings) {
  const cloned = cloneEmailSettings(settings)
  Object.assign(email, { ...cloned, port: cloned.port || null })
  persistedEmailEnabled.value = cloned.enabled
}

function applyTelegram(settings: TelegramNotificationSettings) {
  Object.assign(telegram, cloneTelegramSettings(settings))
  persistedTelegramEnabled.value = settings.enabled
}

watch(notificationSettings, (settings) => {
  if (!settings) return
  applyEmail(settings.email)
  applyTelegram(settings.telegram)
}, { immediate: true })

function clear(record: Record<string, string>) {
  for (const key of Object.keys(record)) delete record[key]
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

function validateEmail(): boolean {
  clear(emailErrors)
  if (!email.enabled && !email.host && !email.fromAddress && email.recipients.length === 0) return true
  email.host = email.host.trim()
  email.username = email.username.trim()
  email.fromAddress = email.fromAddress.trim()
  if (!email.host || email.host.length > 255) emailErrors.host = 'SMTP 服务器无效'
  const port = email.port
  if (port === null || !Number.isInteger(port) || port < 1 || port > 65535) emailErrors.port = '端口无效'
  if (!validEmail(email.fromAddress)) emailErrors.from = '发件人地址格式错误'
  if (email.recipients.length === 0 || email.recipients.some((value) => !validEmail(value))) emailErrors.recipients = '邮箱格式错误'
  if (!email.passwordSet && !email.password.trim()) emailErrors.password = '密码为空'
  return Object.keys(emailErrors).length === 0
}

function validateTelegram(): boolean {
  clear(telegramErrors)
  if (!telegram.enabled && telegram.targets.length === 0 && !telegram.token) return true
  if (!telegram.tokenSet && !telegram.token.trim()) telegramErrors.token = 'Bot Token 为空'
  if (telegram.targets.length === 0 || telegram.targets.some((value) => !/^-?\d{1,32}$/.test(value))) telegramErrors.targets = '接收目标 ID 格式错误'
  return Object.keys(telegramErrors).length === 0
}

async function saveEmail() {
  if (!validateEmail()) return
  const saved = await store.saveEmail({ ...email, port: email.port ?? 0, recipients: [...email.recipients] })
  if (saved) applyEmail(saved)
}

async function sendTestEmail() {
  if (!validateEmail()) return
  await store.testEmail({ ...email, port: email.port ?? 0, recipients: [...email.recipients] })
}

async function saveTelegram() {
  if (!validateTelegram()) return
  const saved = await store.saveTelegram({ ...telegram, targets: [...telegram.targets] })
  if (saved) applyTelegram(saved)
}

async function sendTestTelegram() {
  if (!validateTelegram()) return
  await store.testTelegram({ ...telegram, targets: [...telegram.targets] })
}
</script>

<template>
  <section class="page-layout" aria-labelledby="notifications-title">
    <div class="notification-column">
      <header class="page-heading">
        <div><h1 id="notifications-title">通知设置</h1><p>配置新评论通知的投递渠道，保存后立即生效。</p></div>
      </header>
      <p v-if="notificationMessage" class="inline-error page-message" role="alert">{{ notificationMessage }}</p>

      <div class="channel-stack">
        <section class="channel-card" :data-enabled="email.enabled">
          <header class="channel-head">
            <h2>电子邮件通知</h2>
            <label class="switch-label">
              <input v-model="email.enabled" class="switch-input" type="checkbox" :disabled="notificationBusy">
              <span class="switch-track" aria-hidden="true" /><span>启用电子邮件通知</span>
            </label>
          </header>
          <div class="channel-content">
            <div class="channel-form">
              <div class="form-row"><label class="form-label" for="email-server">SMTP 服务器</label><div class="field-stack"><input id="email-server" v-model="email.host" class="input" type="text" placeholder="smtp.example.com" maxlength="255" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.host)"><p v-if="emailErrors.host" class="field-error">{{ emailErrors.host }}</p></div></div>
              <div class="form-row"><label class="form-label" for="email-port">端口</label><div class="field-stack"><input id="email-port" v-model.number="email.port" class="input" type="number" min="1" max="65535" placeholder="465" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.port)"><p v-if="emailErrors.port" class="field-error">{{ emailErrors.port }}</p></div></div>
              <div class="form-row"><label class="form-label" for="email-encryption">加密方式</label><div class="field-stack"><select id="email-encryption" v-model="email.encryption" class="select" :disabled="!email.enabled || notificationBusy"><option value="tls">SSL/TLS</option><option value="starttls">STARTTLS</option></select></div></div>
              <div class="form-row"><label class="form-label" for="email-user">用户名</label><div class="field-stack"><input id="email-user" v-model="email.username" class="input" type="text" autocomplete="username" :disabled="!email.enabled || notificationBusy"></div></div>
              <div class="form-row"><label class="form-label" for="email-password">密码</label><div class="field-stack"><input id="email-password" v-model="email.password" class="input" type="password" autocomplete="new-password" :placeholder="email.passwordSet ? '已设置，输入新值以更换' : ''" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.password)"><p v-if="emailErrors.password" class="field-error">{{ emailErrors.password }}</p></div></div>
              <div class="form-row"><label class="form-label" for="email-sender">发件人地址</label><div class="field-stack"><input id="email-sender" v-model="email.fromAddress" class="input" type="email" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.from)"><p v-if="emailErrors.from" class="field-error">{{ emailErrors.from }}</p></div></div>
              <div class="form-row"><label class="form-label" for="email-recipients">通知收件人</label><div class="field-stack"><ChipInput id="email-recipients" v-model="email.recipients" kind="email" label="通知收件人" :disabled="!email.enabled || notificationBusy" /><p v-if="emailErrors.recipients && !email.recipients.some((value) => !validEmail(value))" class="field-error">{{ emailErrors.recipients }}</p><p class="field-help">按 Enter、逗号或换行添加多个邮箱</p></div></div>
              <div class="form-row"><span class="form-label">回复通知</span><div class="check-row"><label class="check-label"><input type="checkbox" checked disabled>访客收到回复时</label></div></div>
            </div>
            <footer class="channel-actions">
              <button class="button" type="button" :disabled="!email.enabled || notificationBusy" @click="sendTestEmail">发送测试邮件</button>
              <span class="test-feedback" :class="{ 'is-success': emailTestState === 'success', 'is-failure': emailTestState === 'failure' }" aria-live="polite">{{ emailTestMessage }}</span>
              <button class="button button-primary save-button" type="button" :disabled="emailSaveDisabled" @click="saveEmail">保存</button>
            </footer>
          </div>
        </section>

        <section class="channel-card" :data-enabled="telegram.enabled">
          <header class="channel-head">
            <h2>Telegram 通知</h2>
            <label class="switch-label">
              <input v-model="telegram.enabled" class="switch-input" type="checkbox" :disabled="notificationBusy">
              <span class="switch-track" aria-hidden="true" /><span>启用 Telegram 通知</span>
            </label>
          </header>
          <div class="channel-content">
            <div class="channel-form">
              <div class="form-row"><label class="form-label" for="telegram-token">Bot Token</label><div class="field-stack"><input id="telegram-token" v-model="telegram.token" class="input" type="password" autocomplete="new-password" :placeholder="telegram.tokenSet ? '已设置，输入新值以更换' : ''" :disabled="!telegram.enabled || notificationBusy" :aria-invalid="Boolean(telegramErrors.token)"><p v-if="telegramErrors.token" class="field-error">{{ telegramErrors.token }}</p><p class="field-help">通过 @BotFather 获取</p></div></div>
              <div class="form-row"><label class="form-label" for="telegram-targets">接收目标 ID</label><div class="field-stack"><ChipInput id="telegram-targets" v-model="telegram.targets" kind="telegram" label="接收目标 ID" :disabled="!telegram.enabled || notificationBusy" /><p v-if="telegramErrors.targets && !telegram.targets.some((value) => !/^-?\d{1,32}$/.test(value))" class="field-error">{{ telegramErrors.targets }}</p><p class="field-help">按 Enter、逗号或换行添加；支持用户、群组、频道 ID，如 123456789 或 -1001234567890</p></div></div>
            </div>
            <footer class="channel-actions">
              <button class="button" type="button" :disabled="!telegram.enabled || notificationBusy" @click="sendTestTelegram">发送测试消息</button>
              <span class="test-feedback" :class="{ 'is-success': telegramTestState === 'success', 'is-failure': telegramTestState === 'failure' }" aria-live="polite">{{ telegramTestMessage }}</span>
              <button class="button button-primary save-button" type="button" :disabled="telegramSaveDisabled" @click="saveTelegram">保存</button>
            </footer>
          </div>
        </section>
      </div>

    </div>
  </section>
</template>
