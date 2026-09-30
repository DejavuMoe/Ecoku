<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import AdminIcon from './AdminIcon.vue'
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
const emailBaseline = ref('')
const telegramBaseline = ref('')
function emailSnapshot() { return JSON.stringify({ ...email, password: '' }) }
function telegramSnapshot() { return JSON.stringify({ ...telegram, token: '' }) }
const emailDirty = computed(() => emailSnapshot() !== emailBaseline.value)
const telegramDirty = computed(() => telegramSnapshot() !== telegramBaseline.value)
const emailSaveDisabled = computed(() => notificationBusy.value || !emailDirty.value)
const telegramSaveDisabled = computed(() => notificationBusy.value || !telegramDirty.value)
watch([emailDirty, telegramDirty], ([emailValue, telegramValue]) => store.setDirty('notifications', emailValue || telegramValue), { immediate: true })
onBeforeUnmount(() => store.setDirty('notifications', false))

function applyEmail(settings: EmailNotificationSettings) {
  const cloned = cloneEmailSettings(settings)
  Object.assign(email, { ...cloned, port: cloned.port || null })
  persistedEmailEnabled.value = cloned.enabled
  emailBaseline.value = emailSnapshot()
}

function applyTelegram(settings: TelegramNotificationSettings) {
  Object.assign(telegram, cloneTelegramSettings(settings))
  persistedTelegramEnabled.value = settings.enabled
  telegramBaseline.value = telegramSnapshot()
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
    <div class="page-column is-narrow">
      <header class="page-heading">
        <div><h1 id="notifications-title">通知设置</h1><p>对所有站点生效，保存后立即使用新配置。</p></div>
      </header>
      <p v-if="notificationMessage" class="notice notice-error" role="alert">{{ notificationMessage }}</p>

      <div class="channel-stack">
          <section class="settings-card channel-card" :data-enabled="email.enabled" aria-labelledby="email-title">
          <header class="channel-head">
            <div>
              <h2 id="email-title">电子邮件</h2>
              <p>有新评论时发给通知收件人；访客留了邮箱时，他的评论被别人回复也会收到邮件。</p>
            </div>
            <label class="switch">
              <input v-model="email.enabled" class="switch-input" type="checkbox" aria-label="启用电子邮件通知" :disabled="notificationBusy">
              <span class="switch-track" aria-hidden="true" /><span class="switch-state" aria-hidden="true">{{ email.enabled ? '已开启' : '未开启' }}</span>
            </label>
          </header>
          <div v-show="email.enabled" class="channel-body">
            <div class="field-grid">
              <div class="span-2 host-port">
                <div class="field">
                  <label class="field-label" for="email-server">SMTP 服务器</label>
                  <input id="email-server" v-model="email.host" class="input input-mono" type="text" placeholder="smtp.example.com" maxlength="255" spellcheck="false" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.host)">
                  <p v-if="emailErrors.host" class="field-error">{{ emailErrors.host }}</p>
                </div>
                <div class="field">
                  <label class="field-label" for="email-port">端口</label>
                  <input id="email-port" v-model.number="email.port" class="input input-mono" type="number" min="1" max="65535" :placeholder="email.encryption === 'starttls' ? '587' : '465'" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.port)">
                  <p v-if="emailErrors.port" class="field-error">{{ emailErrors.port }}</p>
                </div>
              </div>
              <div class="field span-2">
                <span id="email-encryption-label" class="field-label">加密方式</span>
                <div id="email-encryption" class="segmented" role="radiogroup" aria-labelledby="email-encryption-label">
                  <label><input v-model="email.encryption" type="radio" name="email-encryption" value="tls" :disabled="!email.enabled || notificationBusy"><span>SSL/TLS</span></label>
                  <label><input v-model="email.encryption" type="radio" name="email-encryption" value="starttls" :disabled="!email.enabled || notificationBusy"><span>STARTTLS</span></label>
                </div>
              </div>
              <div class="field">
                <label class="field-label" for="email-user">用户名</label>
                <input id="email-user" v-model="email.username" class="input" type="text" autocomplete="username" :disabled="!email.enabled || notificationBusy">
              </div>
              <div class="field">
                <label class="field-label" for="email-password">密码</label>
                <input id="email-password" v-model="email.password" class="input" type="password" autocomplete="new-password" :placeholder="email.passwordSet ? '已设置，输入新值以更换' : ''" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.password)">
                <p v-if="emailErrors.password" class="field-error">{{ emailErrors.password }}</p>
              </div>
              <div class="field span-2">
                <label class="field-label" for="email-sender">发件人地址</label>
                <input id="email-sender" v-model="email.fromAddress" class="input" type="email" :disabled="!email.enabled || notificationBusy" :aria-invalid="Boolean(emailErrors.from)">
                <p v-if="emailErrors.from" class="field-error">{{ emailErrors.from }}</p>
              </div>
              <div class="field span-2">
                <label class="field-label" for="email-recipients">通知收件人</label>
                <ChipInput id="email-recipients" v-model="email.recipients" kind="email" label="通知收件人" :disabled="!email.enabled || notificationBusy" />
                <p v-if="emailErrors.recipients && !email.recipients.some((value) => !validEmail(value))" class="field-error">{{ emailErrors.recipients }}</p>
                <p class="field-help">按 Enter、逗号或换行添加多个邮箱</p>
              </div>
            </div>
          </div>
          <p v-if="!email.enabled" class="channel-off">未开启，不会发送任何邮件，包括访客回复通知。</p>
          <footer class="channel-actions" :class="{ 'is-dirty': emailDirty }">
            <span v-if="emailDirty" class="dirty-label">有未保存的修改</span>
            <button v-if="email.enabled" class="button" type="button" :disabled="notificationBusy" @click="sendTestEmail">发送测试邮件</button>
            <span class="test-feedback" :class="{ 'is-success': email.enabled && emailTestState === 'success', 'is-failure': email.enabled && emailTestState === 'failure' }" aria-live="polite"><template v-if="email.enabled && emailTestMessage"><AdminIcon :name="emailTestState === 'success' ? 'check' : 'alert'" />{{ emailTestMessage }}</template><template v-else-if="!email.enabled && persistedEmailEnabled">关闭后需保存才会生效</template></span>
            <button class="button button-primary save-button push" type="button" :disabled="emailSaveDisabled" @click="saveEmail">保存</button>
          </footer>
        </section>

        <section class="settings-card channel-card" :data-enabled="telegram.enabled" aria-labelledby="telegram-title">
          <header class="channel-head">
            <div>
              <h2 id="telegram-title">Telegram</h2>
              <p>有新评论时由机器人发到下列用户、群组或频道。</p>
            </div>
            <label class="switch">
              <input v-model="telegram.enabled" class="switch-input" type="checkbox" aria-label="启用 Telegram 通知" :disabled="notificationBusy">
              <span class="switch-track" aria-hidden="true" /><span class="switch-state" aria-hidden="true">{{ telegram.enabled ? '已开启' : '未开启' }}</span>
            </label>
          </header>
          <div v-show="telegram.enabled" class="channel-body">
            <div class="field">
              <label class="field-label" for="telegram-token">Bot Token</label>
              <input id="telegram-token" v-model="telegram.token" class="input input-mono" type="password" autocomplete="new-password" :placeholder="telegram.tokenSet ? '已设置，输入新值以更换' : ''" :disabled="!telegram.enabled || notificationBusy" :aria-invalid="Boolean(telegramErrors.token)">
              <p v-if="telegramErrors.token" class="field-error">{{ telegramErrors.token }}</p>
              <p class="field-help">通过 @BotFather 获取。</p>
            </div>
            <div class="field">
              <label class="field-label" for="telegram-targets">接收目标 ID</label>
              <ChipInput id="telegram-targets" v-model="telegram.targets" kind="telegram" label="接收目标 ID" :disabled="!telegram.enabled || notificationBusy" />
              <p v-if="telegramErrors.targets && !telegram.targets.some((value) => !/^-?\d{1,32}$/.test(value))" class="field-error">{{ telegramErrors.targets }}</p>
              <p class="field-help">按 Enter、逗号或换行添加；支持用户、群组、频道 ID，如 123456789 或 -1001234567890</p>
            </div>
          </div>
          <p v-if="!telegram.enabled" class="channel-off">未开启。</p>
          <footer class="channel-actions" :class="{ 'is-dirty': telegramDirty }">
            <span v-if="telegramDirty" class="dirty-label">有未保存的修改</span>
            <button v-if="telegram.enabled" class="button" type="button" :disabled="notificationBusy" @click="sendTestTelegram">发送测试消息</button>
            <span class="test-feedback" :class="{ 'is-success': telegram.enabled && telegramTestState === 'success', 'is-failure': telegram.enabled && telegramTestState === 'failure' }" aria-live="polite"><template v-if="telegram.enabled && telegramTestMessage"><AdminIcon :name="telegramTestState === 'success' ? 'check' : 'alert'" />{{ telegramTestMessage }}</template><template v-else-if="!telegram.enabled && persistedTelegramEnabled">关闭后需保存才会生效</template></span>
            <button class="button button-primary save-button push" type="button" :disabled="telegramSaveDisabled" @click="saveTelegram">保存</button>
          </footer>
        </section>
      </div>
      <div class="page-end" />
    </div>
  </section>
</template>
