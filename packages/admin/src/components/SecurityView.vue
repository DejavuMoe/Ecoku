<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import { cloneTurnstileSettings, emptyTurnstileSettings } from '../ui'
import type { TurnstileSettings } from '../types'

const store = useAdminStore()
const { turnstileSettings, turnstileBusy, turnstileMessage } = storeToRefs(store)
const draft = reactive<TurnstileSettings>(emptyTurnstileSettings())
const errors = reactive<Record<string, string>>({})
const persistedEnabled = ref(false)
const saveDisabled = computed(() => turnstileBusy.value || (!draft.enabled && draft.enabled === persistedEnabled.value))

function apply(settings: TurnstileSettings) {
  Object.assign(draft, cloneTurnstileSettings(settings))
  persistedEnabled.value = settings.enabled
}

watch(turnstileSettings, (settings) => {
  if (settings) apply(settings)
}, { immediate: true })

async function save() {
  for (const key of Object.keys(errors)) delete errors[key]
  draft.sitekey = draft.sitekey.trim()
  if (draft.enabled || draft.sitekey || draft.secret) {
    if (!draft.sitekey) errors.sitekey = 'Sitekey 不能为空'
    if (!draft.secretSet && !draft.secret.trim()) errors.secret = 'Secret key 不能为空'
  }
  if (Object.keys(errors).length) return
  const saved = await store.saveTurnstile({ ...draft })
  if (saved) apply(saved)
}
</script>

<template>
  <section class="page-layout" aria-labelledby="security-title">
    <div class="notification-column">
      <header class="page-heading">
        <div>
          <h1 id="security-title">安全</h1>
          <p>实例级 Cloudflare Turnstile，同时用于访客评论和管理员登录，不按站点分开。</p>
        </div>
      </header>
      <p v-if="turnstileMessage" class="inline-error page-message" role="alert">{{ turnstileMessage }}</p>
      <div class="channel-stack">
        <section class="channel-card" :data-enabled="draft.enabled">
          <header class="channel-head">
            <h2>Cloudflare Turnstile</h2>
            <label class="switch-label">
              <input v-model="draft.enabled" class="switch-input" type="checkbox" :disabled="turnstileBusy">
              <span class="switch-track" aria-hidden="true" /><span>启用验证</span>
            </label>
          </header>
          <div class="channel-content">
            <div class="channel-form">
              <div class="form-row">
                <label class="form-label" for="turnstile-sitekey">Sitekey</label>
                <div class="field-stack">
                  <input id="turnstile-sitekey" v-model="draft.sitekey" class="input" type="text" maxlength="255" :disabled="!draft.enabled || turnstileBusy" :aria-invalid="Boolean(errors.sitekey)">
                  <p v-if="errors.sitekey" class="field-error">{{ errors.sitekey }}</p>
                </div>
              </div>
              <div class="form-row">
                <label class="form-label" for="turnstile-secret">Secret key</label>
                <div class="field-stack">
                  <input id="turnstile-secret" v-model="draft.secret" class="input" type="password" autocomplete="new-password" :placeholder="draft.secretSet ? '已设置，输入新值以更换' : ''" :disabled="!draft.enabled || turnstileBusy" :aria-invalid="Boolean(errors.secret)">
                  <p v-if="errors.secret" class="field-error">{{ errors.secret }}</p>
                </div>
              </div>
            </div>
            <footer class="channel-actions">
              <button class="button button-primary save-button" type="button" :disabled="saveDisabled" @click="save">保存</button>
            </footer>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
