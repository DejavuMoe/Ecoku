<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import SaveBar from './SaveBar.vue'
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
const emailBaseline = ref('')
const telegramBaseline = ref('')
const pendingEmail = ref(false)
const pendingTelegram = ref(false)
const emailInputKey = ref(0)
const telegramInputKey = ref(0)
const persistedTelegramEnabled = ref(false)

function applyEmail(settings: EmailNotificationSettings) {
  const cloned = cloneEmailSettings(settings)
  Object.assign(email, { ...cloned, port: cloned.port || null })
  persistedEmailEnabled.value = cloned.enabled
  emailBaseline.value = JSON.stringify(email); pendingEmail.value = false; emailInputKey.value++
}

function applyTelegram(settings: TelegramNotificationSettings) {
  Object.assign(telegram, cloneTelegramSettings(settings))
  persistedTelegramEnabled.value = settings.enabled
  telegramBaseline.value = JSON.stringify(telegram); pendingTelegram.value = false; telegramInputKey.value++
}

watch(notificationSettings, (settings) => {
  if (!settings) return
  applyEmail(settings.email)
  applyTelegram(settings.telegram)
}, { immediate: true })

const emailDirty = computed(() => Boolean(emailBaseline.value) && (pendingEmail.value || JSON.stringify(email) !== emailBaseline.value))
const telegramDirty = computed(() => Boolean(telegramBaseline.value) && (pendingTelegram.value || JSON.stringify(telegram) !== telegramBaseline.value))
const dirty = computed(() => emailDirty.value || telegramDirty.value)
const errorCount = computed(() => Object.keys(emailErrors).length + Object.keys(telegramErrors).length)
const emailForm = ref<HTMLFormElement | null>(null)
const telegramForm = ref<HTMLFormElement | null>(null)
watch(dirty, value => store.setDirty('notifications', value), { immediate: true, flush: 'sync' })
onBeforeUnmount(() => store.setDirty('notifications', false))
async function focusError() {
  await nextTick()
  const invalid = (Object.keys(emailErrors).length ? emailForm : telegramForm).value?.querySelector<HTMLElement>('[aria-invalid="true"]')
  const target = invalid?.querySelector<HTMLElement>('input') ?? invalid
  target?.focus()
}
function discard() {
  if (notificationSettings.value) { applyEmail(notificationSettings.value.email); applyTelegram(notificationSettings.value.telegram) }
  clear(emailErrors); clear(telegramErrors)
}
async function saveChanged() {
  const validEmail = !emailDirty.value || validateEmail()
  const validTelegram = !telegramDirty.value || validateTelegram()
  if (emailDirty.value && validEmail) await saveEmail()
  if (telegramDirty.value && validTelegram && store.authenticated) await saveTelegram()
  if (!validEmail || !validTelegram) await focusError()
}
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
  if (!validateEmail()) { await focusError(); return }
  const saved = await store.saveEmail({ ...email, port: email.port ?? 0, recipients: [...email.recipients] })
  if (saved) applyEmail(saved)
}

async function sendTestEmail() {
  if (!validateEmail()) { await focusError(); return }
  await store.testEmail({ ...email, port: email.port ?? 0, recipients: [...email.recipients] })
}

async function saveTelegram() {
  if (!validateTelegram()) { await focusError(); return }
  const saved = await store.saveTelegram({ ...telegram, targets: [...telegram.targets] })
  if (saved) applyTelegram(saved)
}

async function sendTestTelegram() {
  if (!validateTelegram()) { await focusError(); return }
  await store.testTelegram({ ...telegram, targets: [...telegram.targets] })
}
</script>

<template>
<section class="view" aria-labelledby="notifications-title">
        <header class="page-head layout">
          <div class="in-margin head-margin"><p class="scope">实例设置</p></div>
          <div class="in-main head-main">
            <div class="title-row"><h1 id="notifications-title" class="page-title" tabindex="-1">通知设置</h1></div>
            <p class="page-lede">对所有站点生效，保存后立即使用新配置。</p>
          </div>
        </header>
        <div class="layout page-note"><p v-if="notificationMessage" class="in-main notice notice-error" role="alert">{{ notificationMessage }}<button v-if="!notificationSettings" class="button" type="button" :disabled="notificationBusy" @click="store.loadNotifications">重试</button></p></div>

        <form ref="emailForm" @submit.prevent="saveChanged" id="email-form" class="doc" novalidate aria-labelledby="email-title"><fieldset :disabled="notificationBusy || !notificationSettings">
          <section class="doc-section layout">
            <div class="in-margin section-margin"><h2 id="email-title">电子邮件</h2><p>有新评论时发给通知收件人；访客留了邮箱时，他的评论被别人回复也会收到邮件。</p></div>
            <div class="in-main section-body">
              <div class="field">
                <div class="rule rule-choice" role="radiogroup" aria-labelledby="lbl-email-enabled">
                  <span class="rule-label" id="lbl-email-enabled">邮件通知</span>
                  <span class="options"><label><input type="radio" name="email-enabled" :value="true" v-model="email.enabled"><span>开启</span></label><label><input type="radio" name="email-enabled" :value="false" v-model="email.enabled"><span>关闭</span></label></span>
                </div>
                <p v-if="!email.enabled" class="help">未开启，不会发送任何邮件，包括访客回复通知。</p>
              </div>
              <div v-show="email.enabled" class="channel-fields">
                <div class="field">
                  <div class="rule rule-host">
                    <label class="rule-label" for="email-server">SMTP 服务器</label>
                    <input id="email-server" class="mono" type="text" placeholder="smtp.example.com" maxlength="255" spellcheck="false" v-model="email.host" :aria-invalid="Boolean(emailErrors.host)">
                    <label class="rule-label rule-label-inline" for="email-port">端口</label>
                    <input id="email-port" class="mono port" type="number" min="1" max="65535" :placeholder="email.encryption === 'starttls' ? '587' : '465'" inputmode="numeric" v-model.number="email.port" :aria-invalid="Boolean(emailErrors.port)">
                  </div>
                  <p v-if="emailErrors.host" class="field-error">{{ emailErrors.host }}</p>
                  <p v-if="emailErrors.port" class="field-error">{{ emailErrors.port }}</p>
                </div>
                <div class="field">
                  <div id="email-encryption" class="rule rule-choice" role="radiogroup" aria-labelledby="lbl-email-encryption">
                    <span class="rule-label" id="lbl-email-encryption">加密方式</span>
                    <span class="options"><label><input type="radio" name="email-encryption" value="tls" v-model="email.encryption"><span>SSL/TLS</span></label><label><input type="radio" name="email-encryption" value="starttls" v-model="email.encryption"><span>STARTTLS</span></label></span>
                  </div>
                </div>
                <div class="field">
                  <label class="rule"><span class="rule-label">用户名</span><input id="email-user" type="text" autocomplete="username" v-model="email.username"></label>
                </div>
                <div class="field">
                  <label class="rule"><span class="rule-label">密码</span><input id="email-password" type="password" autocomplete="new-password" v-model="email.password" :aria-invalid="Boolean(emailErrors.password)" :placeholder="email.passwordSet ? '已设置，输入新值以更换' : ''"></label>
                  <p v-if="emailErrors.password" class="field-error">{{ emailErrors.password }}</p>
                </div>
                <div class="field">
                  <label class="rule"><span class="rule-label">发件人地址</span><input id="email-sender" type="email" v-model="email.fromAddress" :aria-invalid="Boolean(emailErrors.from)"></label>
                  <p v-if="emailErrors.from" class="field-error">{{ emailErrors.from }}</p>
                </div>
                <div class="field">
                  <div class="rule rule-chips"><label class="rule-label" for="email-recipients-input">通知收件人</label><ChipInput id="email-recipients-input" :key="emailInputKey" v-model="email.recipients" kind="email" label="通知收件人" :error="emailErrors.recipients" :disabled="notificationBusy || !email.enabled" @draft-change="pendingEmail = $event" /></div>
                  <p class="help">按 Enter、逗号或换行添加多个邮箱</p>
                </div>
              </div>
              <div class="section-actions">
                <button v-if="email.enabled" :disabled="notificationBusy" @click="sendTestEmail" id="email-test" class="quiet-link" type="button">发送测试邮件</button>
                <span class="feedback" :class="{ 'is-success': emailTestState === 'success', 'is-failure': emailTestState === 'failure' }" aria-live="polite">{{ email.enabled ? emailTestMessage : persistedEmailEnabled ? '关闭后需保存才会生效' : '' }}</span>
              </div>
            </div>
          </section>
        </fieldset></form>

        <form ref="telegramForm" @submit.prevent="saveChanged" id="telegram-form" class="doc" novalidate aria-labelledby="telegram-title"><fieldset :disabled="notificationBusy || !notificationSettings">
          <section class="doc-section layout">
            <div class="in-margin section-margin"><h2 id="telegram-title">Telegram</h2><p>有新评论时由机器人发到下列用户、群组或频道。</p></div>
            <div class="in-main section-body">
              <div class="field">
                <div class="rule rule-choice" role="radiogroup" aria-labelledby="lbl-telegram-enabled">
                  <span class="rule-label" id="lbl-telegram-enabled">Telegram</span>
                  <span class="options"><label><input type="radio" name="telegram-enabled" :value="true" v-model="telegram.enabled"><span>开启</span></label><label><input type="radio" name="telegram-enabled" :value="false" v-model="telegram.enabled"><span>关闭</span></label></span>
                </div>
                <p v-if="!telegram.enabled" class="help">未开启。</p>
              </div>
              <div v-show="telegram.enabled" class="channel-fields">
                <div class="field">
                  <label class="rule"><span class="rule-label">Bot Token</span><input id="telegram-token" class="mono" type="password" autocomplete="new-password" v-model="telegram.token" :aria-invalid="Boolean(telegramErrors.token)" :placeholder="telegram.tokenSet ? '已设置，输入新值以更换' : ''"></label>
                  <p class="help">通过 @BotFather 获取。</p>
                  <p v-if="telegramErrors.token" class="field-error">{{ telegramErrors.token }}</p>
                </div>
                <div class="field">
                  <div class="rule rule-chips"><label class="rule-label" for="telegram-targets-input">接收目标 ID</label><ChipInput id="telegram-targets-input" :key="telegramInputKey" v-model="telegram.targets" kind="telegram" label="接收目标 ID" :error="telegramErrors.targets" :disabled="notificationBusy || !telegram.enabled" @draft-change="pendingTelegram = $event" /></div>
                  <p class="help">按 Enter、逗号或换行添加；支持用户、群组、频道 ID，如 123456789 或 -1001234567890</p>
                </div>
              </div>
              <div class="section-actions">
                <button v-if="telegram.enabled" :disabled="notificationBusy" @click="sendTestTelegram" id="telegram-test" class="quiet-link" type="button">发送测试消息</button>
                <span class="feedback" :class="{ 'is-success': telegramTestState === 'success', 'is-failure': telegramTestState === 'failure' }" aria-live="polite">{{ telegram.enabled ? telegramTestMessage : persistedTelegramEnabled ? '关闭后需保存才会生效' : '' }}</span>
              </div>
            </div>
          </section>
        </fieldset></form>
      <SaveBar v-if="dirty" :busy="notificationBusy" :error-count="errorCount" :status="`${emailDirty ? '电子邮件' : ''}${emailDirty && telegramDirty ? '、' : ''}${telegramDirty ? 'Telegram ' : ''}有未保存的修改`" @save="saveChanged" @discard="discard" />
</section>
</template>
