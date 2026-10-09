<script lang="ts">
  import { useAdminStore } from '../stores/admin.svelte'

  const store = useAdminStore()

  // After admin reset-password the account may already have another name; keep it unless changed here.
  const currentUsername = store.setupUsername || 'admin'
  let username = $state(currentUsername)
  let password = $state('')
  let confirm = $state('')
  let showPassword = $state(false)
  let localError = $state('')

  async function submit() {
    localError = ''
    if (!username.trim()) {
      localError = `请输入用户名，或保留 ${currentUsername}。`
      return
    }
    if ([...password].length < 12 || new TextEncoder().encode(password).length > 72) {
      localError = '新密码至少 12 个字符，且不能超过 72 个 UTF-8 字节。'
      return
    }
    if (password !== confirm) {
      localError = '两次输入的密码不一致。'
      return
    }
    await store.completeInitialSetup(username, password)
  }
</script>

<main aria-labelledby="setup-title" class="auth">
  <section class="auth-sheet">
    <div aria-hidden="true" class="auth-brand">
      <svg class="seal"><use href="#ecoku-seal"></use></svg><span class="wordmark">Ecoku</span>
    </div>
    <form
      novalidate
      onsubmit={(event) => {
        event.preventDefault()
        submit()
      }}
      class="auth-form first-login-form"
    >
      <h1 id="setup-title" tabindex="-1">设置你的密码</h1>
      <p class="first-login-intro">更换临时密码后，即可进入管理后台。用户名可以保留为 {currentUsername}。</p>
      {#if store.passwordSetupMessage || localError}<p role="alert" class="notice notice-error">
          {store.passwordSetupMessage || localError}
        </p>{/if}<label class="rule"
        ><span class="rule-label">用户名</span><input
          bind:value={username}
          autocomplete="username"
          maxlength="80"
          required
          disabled={store.passwordSetupBusy}
        /></label
      ><label class="rule"
        ><span class="rule-label">新密码</span><input
          bind:value={password}
          type={showPassword ? 'text' : 'password'}
          autocomplete="new-password"
          required
          disabled={store.passwordSetupBusy}
        /></label
      ><label class="rule"
        ><span class="rule-label">确认密码</span><input
          bind:value={confirm}
          type={showPassword ? 'text' : 'password'}
          autocomplete="new-password"
          required
          disabled={store.passwordSetupBusy}
        /></label
      >
      <p class="help first-login-help">至少 12 个字符，最多 72 个 UTF-8 字节；可粘贴密码管理器生成的密码。</p>
      <label class="first-login-show"
        ><input bind:checked={showPassword} type="checkbox" disabled={store.passwordSetupBusy} />显示密码</label
      ><button type="submit" disabled={store.passwordSetupBusy} class="button button-primary button-block"
        >{store.passwordSetupBusy ? '正在保存…' : '保存并进入后台'}</button
      >
    </form>
    <p class="first-login-foot">完成设置前，暂不能管理站点或评论。</p>
  </section>
</main>
