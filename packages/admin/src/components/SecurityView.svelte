<script lang="ts">
  import { tick, onDestroy, untrack } from 'svelte'

  import { useAdminStore } from '../stores/admin.svelte'
  import { cloneCaptchaSettings, emptyCaptchaSettings } from '../ui'
  import type { CaptchaSettings } from '../types'
  import SaveBar from './SaveBar.svelte'

  const store = useAdminStore()

  let draft = $state<CaptchaSettings>(emptyCaptchaSettings())
  let errors = $state<Record<string, string>>({})
  let baseline = $state('')
  let form = $state<HTMLFormElement | null>(null)
  let dirty = $derived.by(() => Boolean(baseline) && JSON.stringify(draft) !== baseline)
  let errorCount = $derived.by(() => Object.keys(errors).length)

  function apply(settings: CaptchaSettings) {
    Object.assign(draft, cloneCaptchaSettings(settings))
    baseline = JSON.stringify(draft)
  }

  $effect.pre(() => {
    const settings = store.captchaSettings
    untrack(() => {
      if (settings) apply(settings)
    })
  })

  $effect.pre(() => {
    const changed = dirty
    untrack(() => store.setDirty('security', changed))
  })
  onDestroy(() => store.setDirty('security', false))
  function discard() {
    if (store.captchaSettings) apply(store.captchaSettings)
    for (const key of Object.keys(errors)) delete errors[key]
  }

  $effect.pre(() => {
    draft.provider
    untrack(() => {
      for (const key of Object.keys(errors)) delete errors[key]
    })
  })

  function validCapInstance(value: string): boolean {
    try {
      const parsed = new URL(value)
      return (
        parsed.protocol === 'https:' &&
        Boolean(parsed.hostname) &&
        !parsed.username &&
        !parsed.password &&
        !parsed.search &&
        !parsed.hash
      )
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
    if (Object.keys(errors).length) {
      await tick()
      form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const saved = await store.saveCaptcha({
      ...draft,
      turnstile: { ...draft.turnstile },
      cap: { ...draft.cap }
    })
    if (saved) apply(saved)
  }
</script>

<section aria-labelledby="security-title" class="view">
  <header class="page-head layout">
    <div class="in-margin head-margin"><p class="scope">实例设置</p></div>
    <div class="in-main head-main">
      <div class="title-row"><h1 id="security-title" tabindex="-1" class="page-title">安全</h1></div>
      <p class="page-lede">人机验证对整个实例生效，同时用于访客评论和管理员登录，不按站点分开。</p>
    </div>
  </header>
  <div class="layout page-note">
    {#if store.captchaMessage}<p role="alert" class="in-main notice notice-error">
        {store.captchaMessage}{#if !store.captchaSettings}<button
            type="button"
            disabled={store.captchaBusy}
            onclick={store.loadCaptcha}
            class="button">重试</button
          >{/if}
      </p>{/if}
  </div>
  <form
    bind:this={form}
    onsubmit={(event) => {
      event.preventDefault()
      save()
    }}
    id="captcha-form"
    novalidate
    aria-labelledby="captcha-title"
    class="doc"
  >
    <fieldset disabled={store.captchaBusy || !store.captchaSettings}>
      <section class="doc-section layout">
        <div class="in-margin section-margin">
          <h2 id="captcha-title">人机验证</h2>
          <p>三种方式互斥，切换后保存才会生效。</p>
        </div>
        <div class="in-main section-body">
          <fieldset aria-labelledby="captcha-title" class="options-list">
            <label class="option-row"
              ><input bind:group={draft.provider} type="radio" name="captcha-provider" value="off" /><span
                aria-hidden="true"
                class="option-mark"
              ></span><strong>关闭</strong><small>不显示验证组件</small></label
            ><label class="option-row"
              ><input bind:group={draft.provider} type="radio" name="captcha-provider" value="turnstile" /><span
                aria-hidden="true"
                class="option-mark"
              ></span><strong>Cloudflare Turnstile</strong><small>由 Cloudflare 托管的验证</small></label
            ><label class="option-row"
              ><input bind:group={draft.provider} type="radio" name="captcha-provider" value="cap" /><span
                aria-hidden="true"
                class="option-mark"
              ></span><strong>Cap</strong><small>连接自托管的 Cap 实例</small></label
            >
          </fieldset>
          {#if draft.provider === 'off'}<div id="panel-off" class="provider-panel">
              <p class="notice notice-warn">关闭后，访客评论和管理员登录都不再要求额外验证；现有限流仍然生效。</p>
            </div>{:else if draft.provider === 'turnstile'}<div id="panel-turnstile" class="provider-panel">
              <div class="field">
                <label class="setting"
                  ><span class="setting-label">Sitekey</span><input
                    id="turnstile-sitekey"
                    type="text"
                    maxlength="255"
                    spellcheck="false"
                    bind:value={draft.turnstile.sitekey}
                    aria-invalid={Boolean(errors.turnstileSitekey)}
                    class="input mono"
                  /></label
                >{#if errors.turnstileSitekey}<p class="field-error">{errors.turnstileSitekey}</p>{/if}
              </div>
              <div class="field">
                <label class="setting"
                  ><span class="setting-label">Secret key</span><input
                    id="turnstile-secret"
                    type="password"
                    autocomplete="new-password"
                    bind:value={draft.turnstile.secret}
                    aria-invalid={Boolean(errors.turnstileSecret)}
                    placeholder={draft.turnstile.secretSet ? '已设置，输入新值以更换' : ''}
                    class="input mono"
                  /></label
                >{#if errors.turnstileSecret}<p class="field-error">{errors.turnstileSecret}</p>{/if}
              </div>
            </div>{:else}<div id="panel-cap" class="provider-panel">
              <div class="field">
                <label class="setting"
                  ><span class="setting-label">实例地址</span><input
                    id="cap-instance-url"
                    type="url"
                    inputmode="url"
                    spellcheck="false"
                    placeholder="https://cap.example.com"
                    maxlength="2048"
                    bind:value={draft.cap.instanceUrl}
                    aria-invalid={Boolean(errors.capInstanceUrl)}
                    class="input mono"
                  /></label
                >
                <p class="help">自托管 Cap 的 HTTPS 地址，不带查询参数。</p>
                {#if errors.capInstanceUrl}<p class="field-error">{errors.capInstanceUrl}</p>{/if}
              </div>
              <div class="field">
                <label class="setting"
                  ><span class="setting-label">Site key</span><input
                    id="cap-sitekey"
                    type="text"
                    maxlength="255"
                    spellcheck="false"
                    bind:value={draft.cap.sitekey}
                    aria-invalid={Boolean(errors.capSitekey)}
                    class="input mono"
                  /></label
                >{#if errors.capSitekey}<p class="field-error">{errors.capSitekey}</p>{/if}
              </div>
              <div class="field">
                <label class="setting"
                  ><span class="setting-label">Secret key</span><input
                    id="cap-secret"
                    type="password"
                    autocomplete="new-password"
                    bind:value={draft.cap.secret}
                    aria-invalid={Boolean(errors.capSecret)}
                    placeholder={draft.cap.secretSet ? '已设置，输入新值以更换' : ''}
                    class="input mono"
                  /></label
                >{#if errors.capSecret}<p class="field-error">{errors.capSecret}</p>{/if}
              </div>
            </div>{/if}
        </div>
      </section>
    </fieldset>
  </form>
  {#if dirty}<SaveBar busy={store.captchaBusy} {errorCount} onsave={save} ondiscard={discard} />{/if}
</section>
