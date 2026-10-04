<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'

const store = useAdminStore()
const { passwordSetupBusy, passwordSetupMessage } = storeToRefs(store)
// After admin reset-password the account may already have another name; keep it unless changed here.
const currentUsername = store.setupUsername || 'admin'
const username = ref(currentUsername)
const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const localError = ref('')

async function submit() {
  localError.value = ''
  if (!username.value.trim()) { localError.value = `请输入用户名，或保留 ${currentUsername}。`; return }
  if ([...password.value].length < 12 || new TextEncoder().encode(password.value).length > 72) {
    localError.value = '新密码至少 12 个字符，且不能超过 72 个 UTF-8 字节。'; return
  }
  if (password.value !== confirm.value) { localError.value = '两次输入的密码不一致。'; return }
  await store.completeInitialSetup(username.value, password.value)
}
</script>

<template>
  <main class="auth" aria-labelledby="setup-title">
    <section class="auth-sheet">
      <div class="auth-brand" aria-hidden="true"><svg class="seal"><use href="#ecoku-seal" /></svg><span class="wordmark">Ecoku</span></div>
      <form class="auth-form first-login-form" novalidate @submit.prevent="submit">
        <h1 id="setup-title" tabindex="-1">设置你的密码</h1>
        <p class="first-login-intro">更换临时密码后，即可进入管理后台。用户名可以保留为 {{ currentUsername }}。</p>
        <p v-if="passwordSetupMessage || localError" class="notice notice-error" role="alert">{{ passwordSetupMessage || localError }}</p>
        <label class="rule"><span class="rule-label">用户名</span><input v-model="username" autocomplete="username" maxlength="80" required :disabled="passwordSetupBusy"></label>
        <label class="rule"><span class="rule-label">新密码</span><input v-model="password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required :disabled="passwordSetupBusy"></label>
        <label class="rule"><span class="rule-label">确认密码</span><input v-model="confirm" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" required :disabled="passwordSetupBusy"></label>
        <p class="help first-login-help">至少 12 个字符，最多 72 个 UTF-8 字节；可粘贴密码管理器生成的密码。</p>
        <label class="first-login-show"><input v-model="showPassword" type="checkbox" :disabled="passwordSetupBusy">显示密码</label>
        <button class="button button-primary button-block" type="submit" :disabled="passwordSetupBusy">{{ passwordSetupBusy ? '正在保存…' : '保存并进入后台' }}</button>
      </form>
      <p class="first-login-foot">完成设置前，暂不能管理站点或评论。</p>
    </section>
  </main>
</template>
