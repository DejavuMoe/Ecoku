<script setup lang="ts">
import { reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import { cloneCaptchaSettings, emptyCaptchaSettings } from '../ui'
import type { CaptchaSettings } from '../types'

const store = useAdminStore()
const { captchaSettings, captchaBusy, captchaMessage } = storeToRefs(store)
const draft = reactive<CaptchaSettings>(emptyCaptchaSettings())
const errors = reactive<Record<string, string>>({})

function apply(settings: CaptchaSettings) {
  Object.assign(draft, cloneCaptchaSettings(settings))
}

watch(captchaSettings, (settings) => {
  if (settings) apply(settings)
}, { immediate: true })

watch(() => draft.provider, () => {
  for (const key of Object.keys(errors)) delete errors[key]
})

function validCapInstance(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && Boolean(parsed.hostname) && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
  } catch {
    return false
  }
}

async function save() {
  for (const key of Object.keys(errors)) delete errors[key]
  draft.turnstile.sitekey = draft.turnstile.sitekey.trim()
  draft.turnstile.secret = draft.turnstile.secret.trim()
  draft.cap.instanceUrl = draft.cap.instanceUrl.trim().replace(/\/+$/, '')
  draft.cap.sitekey = draft.cap.sitekey.trim()
  draft.cap.secret = draft.cap.secret.trim()

  if (draft.provider === 'turnstile') {
    if (!draft.turnstile.sitekey) errors.turnstileSitekey = 'Sitekey 不能为空'
    if (!draft.turnstile.secretSet && !draft.turnstile.secret) errors.turnstileSecret = 'Secret key 不能为空'
  }
  if (draft.provider === 'cap') {
    if (!validCapInstance(draft.cap.instanceUrl)) errors.capInstanceUrl = '请输入有效的 HTTPS 实例地址'
    if (!draft.cap.sitekey) errors.capSitekey = 'Site key 不能为空'
    if (!draft.cap.secretSet && !draft.cap.secret) errors.capSecret = 'Secret key 不能为空'
  }
  if (Object.keys(errors).length) return
  const saved = await store.saveCaptcha({
    ...draft,
    turnstile: { ...draft.turnstile },
    cap: { ...draft.cap },
  })
  if (saved) apply(saved)
}
</script>

<template>
  <section class="page-layout" aria-labelledby="security-title">
    <div class="page-column is-narrow">
      <header class="page-heading">
        <div>
          <h1 id="security-title">安全</h1>
          <p>人机验证对整个实例生效，同时用于访客评论和管理员登录，不按站点分开。</p>
        </div>
      </header>
      <p v-if="captchaMessage" class="notice notice-error" role="alert">{{ captchaMessage }}</p>

      <section class="settings-card" aria-label="验证方式">
        <fieldset class="provider-group" role="radiogroup" aria-label="验证方式">
          <label class="provider-option">
            <input v-model="draft.provider" type="radio" name="captcha-provider" value="off" :disabled="captchaBusy">
            <strong>关闭</strong>
            <small>不显示验证组件</small>
          </label>
          <label class="provider-option">
            <input v-model="draft.provider" type="radio" name="captcha-provider" value="turnstile" :disabled="captchaBusy">
            <strong>Cloudflare Turnstile</strong>
            <small>由 Cloudflare 托管的验证</small>
          </label>
          <label class="provider-option">
            <input v-model="draft.provider" type="radio" name="captcha-provider" value="cap" :disabled="captchaBusy">
            <strong>Cap</strong>
            <small>连接自托管的 Cap 实例</small>
          </label>
        </fieldset>

        <div v-if="draft.provider === 'off'" class="provider-panel">
          <p class="notice notice-warn">关闭后，访客评论和管理员登录都不再要求额外验证；现有限流仍然生效。</p>
        </div>

        <div v-else-if="draft.provider === 'turnstile'" class="provider-panel">
          <div class="field">
            <label class="field-label" for="turnstile-sitekey">Sitekey</label>
            <input id="turnstile-sitekey" v-model="draft.turnstile.sitekey" class="input input-mono" type="text" maxlength="255" spellcheck="false" :disabled="captchaBusy" :aria-invalid="Boolean(errors.turnstileSitekey)">
            <p v-if="errors.turnstileSitekey" class="field-error">{{ errors.turnstileSitekey }}</p>
          </div>
          <div class="field">
            <label class="field-label" for="turnstile-secret">Secret key</label>
            <input id="turnstile-secret" v-model="draft.turnstile.secret" class="input input-mono" type="password" autocomplete="new-password" :placeholder="draft.turnstile.secretSet ? '已设置，输入新值以更换' : ''" :disabled="captchaBusy" :aria-invalid="Boolean(errors.turnstileSecret)">
            <p v-if="errors.turnstileSecret" class="field-error">{{ errors.turnstileSecret }}</p>
          </div>
        </div>

        <div v-else class="provider-panel">
          <div class="field">
            <label class="field-label" for="cap-instance-url">实例地址</label>
            <input id="cap-instance-url" v-model="draft.cap.instanceUrl" class="input input-mono" type="url" inputmode="url" spellcheck="false" placeholder="https://cap.example.com" maxlength="2048" :disabled="captchaBusy" :aria-invalid="Boolean(errors.capInstanceUrl)">
            <p v-if="errors.capInstanceUrl" class="field-error">{{ errors.capInstanceUrl }}</p>
            <p class="field-help">自托管 Cap 的 HTTPS 地址，不带查询参数。</p>
          </div>
          <div class="field-grid">
            <div class="field">
              <label class="field-label" for="cap-sitekey">Site key</label>
              <input id="cap-sitekey" v-model="draft.cap.sitekey" class="input input-mono" type="text" maxlength="255" spellcheck="false" :disabled="captchaBusy" :aria-invalid="Boolean(errors.capSitekey)">
              <p v-if="errors.capSitekey" class="field-error">{{ errors.capSitekey }}</p>
            </div>
            <div class="field">
              <label class="field-label" for="cap-secret">Secret key</label>
              <input id="cap-secret" v-model="draft.cap.secret" class="input input-mono" type="password" autocomplete="new-password" :placeholder="draft.cap.secretSet ? '已设置，输入新值以更换' : ''" :disabled="captchaBusy" :aria-invalid="Boolean(errors.capSecret)">
              <p v-if="errors.capSecret" class="field-error">{{ errors.capSecret }}</p>
            </div>
          </div>
        </div>

        <footer class="channel-actions">
          <button class="button button-primary save-button push" type="button" :disabled="captchaBusy" @click="save">保存</button>
        </footer>
      </section>
      <div class="page-end" />
    </div>
  </section>
</template>
