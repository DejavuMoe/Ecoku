<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import { cloneCaptchaSettings, emptyCaptchaSettings } from '../ui'
import type { CaptchaSettings } from '../types'
import SaveBar from './SaveBar.vue'

const store = useAdminStore()
const { captchaSettings, captchaBusy, captchaMessage } = storeToRefs(store)
const draft = reactive<CaptchaSettings>(emptyCaptchaSettings())
const errors = reactive<Record<string, string>>({})
const baseline = ref('')
const form = ref<HTMLFormElement | null>(null)
const dirty = computed(() => Boolean(baseline.value) && JSON.stringify(draft) !== baseline.value)
const errorCount = computed(() => Object.keys(errors).length)

function apply(settings: CaptchaSettings) {
  Object.assign(draft, cloneCaptchaSettings(settings))
  baseline.value = JSON.stringify(draft)
}

watch(captchaSettings, (settings) => {
  if (settings) apply(settings)
}, { immediate: true })

watch(dirty, value => store.setDirty('security', value), { immediate: true, flush: 'sync' })
onBeforeUnmount(() => store.setDirty('security', false))
function discard() { if (captchaSettings.value) apply(captchaSettings.value); for (const key of Object.keys(errors)) delete errors[key] }

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
  if (Object.keys(errors).length) { await nextTick(); form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(); return }
  const saved = await store.saveCaptcha({
    ...draft,
    turnstile: { ...draft.turnstile },
    cap: { ...draft.cap },
  })
  if (saved) apply(saved)
}
</script>

<template>
<section class="view" aria-labelledby="security-title">
        <header class="page-head layout">
          <div class="in-margin head-margin"><p class="scope">实例设置</p></div>
          <div class="in-main head-main">
            <div class="title-row"><h1 id="security-title" class="page-title" tabindex="-1">安全</h1></div>
            <p class="page-lede">人机验证对整个实例生效，同时用于访客评论和管理员登录，不按站点分开。</p>
          </div>
        </header>
        <div class="layout page-note"><p v-if="captchaMessage" class="in-main notice notice-error" role="alert">{{ captchaMessage }}<button v-if="!captchaSettings" class="button" type="button" :disabled="captchaBusy" @click="store.loadCaptcha">重试</button></p></div>

        <form ref="form" @submit.prevent="save" id="captcha-form" class="doc" novalidate aria-labelledby="captcha-title"><fieldset :disabled="captchaBusy || !captchaSettings">
          <section class="doc-section layout">
            <div class="in-margin section-margin"><h2 id="captcha-title">人机验证</h2><p>三种方式互斥，切换后保存才会生效。</p></div>
            <div class="in-main section-body">
              <fieldset class="options-list" aria-labelledby="captcha-title">
                <label class="option-row"><input v-model="draft.provider" type="radio" name="captcha-provider" value="off"><span class="option-mark" aria-hidden="true"></span><strong>关闭</strong><small>不显示验证组件</small></label>
                <label class="option-row"><input v-model="draft.provider" type="radio" name="captcha-provider" value="turnstile"><span class="option-mark" aria-hidden="true"></span><strong>Cloudflare Turnstile</strong><small>由 Cloudflare 托管的验证</small></label>
                <label class="option-row"><input v-model="draft.provider" type="radio" name="captcha-provider" value="cap"><span class="option-mark" aria-hidden="true"></span><strong>Cap</strong><small>连接自托管的 Cap 实例</small></label>
              </fieldset>

              <div v-if="draft.provider === 'off'" id="panel-off" class="provider-panel">
                <p class="notice notice-warn">关闭后，访客评论和管理员登录都不再要求额外验证；现有限流仍然生效。</p>
              </div>

              <div v-else-if="draft.provider === 'turnstile'" id="panel-turnstile" class="provider-panel">
                <div class="field">
                  <label class="setting"><span class="setting-label">Sitekey</span><input id="turnstile-sitekey" class="input mono" type="text" maxlength="255" spellcheck="false" v-model="draft.turnstile.sitekey" :aria-invalid="Boolean(errors.turnstileSitekey)"></label>
                  <p v-if="errors.turnstileSitekey" class="field-error">{{ errors.turnstileSitekey }}</p>
                </div>
                <div class="field">
                  <label class="setting"><span class="setting-label">Secret key</span><input id="turnstile-secret" class="input mono" type="password" autocomplete="new-password" v-model="draft.turnstile.secret" :aria-invalid="Boolean(errors.turnstileSecret)" :placeholder="draft.turnstile.secretSet ? '已设置，输入新值以更换' : ''"></label>
                  <p v-if="errors.turnstileSecret" class="field-error">{{ errors.turnstileSecret }}</p>
                </div>
              </div>

              <div v-else id="panel-cap" class="provider-panel">
                <div class="field">
                  <label class="setting"><span class="setting-label">实例地址</span><input id="cap-instance-url" class="input mono" type="url" inputmode="url" spellcheck="false" placeholder="https://cap.example.com" maxlength="2048" v-model="draft.cap.instanceUrl" :aria-invalid="Boolean(errors.capInstanceUrl)"></label>
                  <p class="help">自托管 Cap 的 HTTPS 地址，不带查询参数。</p>
                  <p v-if="errors.capInstanceUrl" class="field-error">{{ errors.capInstanceUrl }}</p>
                </div>
                <div class="field">
                  <label class="setting"><span class="setting-label">Site key</span><input id="cap-sitekey" class="input mono" type="text" maxlength="255" spellcheck="false" v-model="draft.cap.sitekey" :aria-invalid="Boolean(errors.capSitekey)"></label>
                  <p v-if="errors.capSitekey" class="field-error">{{ errors.capSitekey }}</p>
                </div>
                <div class="field">
                  <label class="setting"><span class="setting-label">Secret key</span><input id="cap-secret" class="input mono" type="password" autocomplete="new-password" v-model="draft.cap.secret" :aria-invalid="Boolean(errors.capSecret)" :placeholder="draft.cap.secretSet ? '已设置，输入新值以更换' : ''"></label>
                  <p v-if="errors.capSecret" class="field-error">{{ errors.capSecret }}</p>
                </div>
              </div>
            </div>
          </section>
        </fieldset></form>
      <SaveBar v-if="dirty" :busy="captchaBusy" :error-count="errorCount" @save="save" @discard="discard" />
</section>
</template>
