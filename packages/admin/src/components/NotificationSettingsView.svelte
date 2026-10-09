<script lang="ts">
  import { tick, onDestroy, untrack } from 'svelte'

  import SaveBar from './SaveBar.svelte'
  import ListInput from './ListInput.svelte'
  import { useAdminStore } from '../stores/admin.svelte'
  import { cloneEmailSettings, cloneTelegramSettings, emptyEmailSettings, emptyTelegramSettings } from '../ui'
  import { invalidItemCount, normalizeItems } from '../listInput'
  import type { EmailNotificationSettings, TelegramNotificationSettings } from '../types'

  type EmailDraft = Omit<EmailNotificationSettings, 'port'> & { port: number | null | undefined }

  const store = useAdminStore()

  let email = $state<EmailDraft>({ ...emptyEmailSettings(), port: null })
  let telegram = $state<TelegramNotificationSettings>(emptyTelegramSettings())
  let emailErrors = $state<Record<string, string>>({})
  let telegramErrors = $state<Record<string, string>>({})
  let persistedEmailEnabled = $state(false)
  let emailBaseline = $state('')
  let telegramBaseline = $state('')
  // Changing a key gives the item list fresh rows whenever saved settings are applied.
  let emailInputKey = $state(0)
  let telegramInputKey = $state(0)
  let persistedTelegramEnabled = $state(false)
  // Each recipient or target that needs fixing counts once in the save bar; its message sits under the item.
  let invalidRecipients = $state(0)
  let invalidTargets = $state(0)

  function applyEmail(settings: EmailNotificationSettings) {
    const cloned = cloneEmailSettings(settings)
    Object.assign(email, { ...cloned, port: cloned.port || null })
    persistedEmailEnabled = cloned.enabled
    emailBaseline = JSON.stringify(email)
    emailInputKey++
  }

  function applyTelegram(settings: TelegramNotificationSettings) {
    Object.assign(telegram, cloneTelegramSettings(settings))
    persistedTelegramEnabled = settings.enabled
    telegramBaseline = JSON.stringify(telegram)
    telegramInputKey++
  }

  $effect.pre(() => {
    const settings = store.notificationSettings
    untrack(() => {
      if (settings) {
        applyEmail(settings.email)
        applyTelegram(settings.telegram)
      }
    })
  })

  let emailDirty = $derived.by(() => Boolean(emailBaseline) && JSON.stringify(email) !== emailBaseline)
  let telegramDirty = $derived.by(() => Boolean(telegramBaseline) && JSON.stringify(telegram) !== telegramBaseline)
  let dirty = $derived.by(() => emailDirty || telegramDirty)
  let errorCount = $derived.by(
    () => Object.keys(emailErrors).length + Object.keys(telegramErrors).length + invalidRecipients + invalidTargets
  )
  let emailForm = $state<HTMLFormElement | null>(null)
  let telegramForm = $state<HTMLFormElement | null>(null)
  let recipientsInput = $state<{ reveal: () => void } | null>(null)
  let targetsInput = $state<{ reveal: () => void } | null>(null)

  $effect.pre(() => {
    const changed = dirty
    untrack(() => store.setDirty('notifications', changed))
  })
  onDestroy(() => store.setDirty('notifications', false))

  $effect.pre(() => {
    const count = email.recipients.length
    untrack(() => {
      if (count) delete emailErrors.recipients
    })
  })

  $effect.pre(() => {
    const count = telegram.targets.length
    untrack(() => {
      if (count) delete telegramErrors.targets
    })
  })
  async function focusError() {
    await tick()
    const emailInvalid = Object.keys(emailErrors).length > 0 || invalidRecipients > 0
    const form = emailInvalid ? emailForm : telegramForm
    form?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
  }
  function discard() {
    if (store.notificationSettings) {
      applyEmail(store.notificationSettings.email)
      applyTelegram(store.notificationSettings.telegram)
    }
    clear(emailErrors)
    clear(telegramErrors)
    invalidRecipients = 0
    invalidTargets = 0
  }
  async function saveChanged() {
    const validEmail = !emailDirty || validateEmail()
    const validTelegram = !telegramDirty || validateTelegram()
    if (emailDirty && validEmail) await saveEmail()
    if (telegramDirty && validTelegram && store.authenticated) await saveTelegram()
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
    invalidRecipients = 0
    if (!email.enabled && !email.host && !email.fromAddress && email.recipients.length === 0) return true
    email.host = email.host.trim()
    email.username = email.username.trim()
    email.fromAddress = email.fromAddress.trim()
    if (!email.host || email.host.length > 255) emailErrors.host = 'SMTP 服务器无效'
    const port = email.port
    if (port == null || !Number.isInteger(port) || port < 1 || port > 65535) emailErrors.port = '端口无效'
    if (!validEmail(email.fromAddress)) emailErrors.from = '发件人地址格式错误'
    if (email.recipients.length === 0) emailErrors.recipients = '至少填写一个收件人'
    recipientsInput?.reveal()
    invalidRecipients = invalidItemCount('email', email.recipients)
    if (!email.passwordSet && !email.password.trim()) emailErrors.password = '密码为空'
    return Object.keys(emailErrors).length === 0 && invalidRecipients === 0
  }

  function validateTelegram(): boolean {
    clear(telegramErrors)
    invalidTargets = 0
    if (!telegram.enabled && telegram.targets.length === 0 && !telegram.token) return true
    if (!telegram.tokenSet && !telegram.token.trim()) telegramErrors.token = 'Bot Token 为空'
    if (telegram.targets.length === 0) telegramErrors.targets = '至少填写一个接收目标'
    targetsInput?.reveal()
    invalidTargets = invalidItemCount('telegram', telegram.targets)
    return Object.keys(telegramErrors).length === 0 && invalidTargets === 0
  }

  const emailPayload = () => ({
    ...email,
    port: email.port ?? 0,
    recipients: normalizeItems('email', email.recipients)
  })
  const telegramPayload = () => ({ ...telegram, targets: normalizeItems('telegram', telegram.targets) })

  async function saveEmail() {
    if (!validateEmail()) {
      await focusError()
      return
    }
    const saved = await store.saveEmail(emailPayload())
    if (saved) applyEmail(saved)
  }

  async function sendTestEmail() {
    if (!validateEmail()) {
      await focusError()
      return
    }
    await store.testEmail(emailPayload())
  }

  async function saveTelegram() {
    if (!validateTelegram()) {
      await focusError()
      return
    }
    const saved = await store.saveTelegram(telegramPayload())
    if (saved) applyTelegram(saved)
  }

  async function sendTestTelegram() {
    if (!validateTelegram()) {
      await focusError()
      return
    }
    await store.testTelegram(telegramPayload())
  }
</script>

<section aria-labelledby="notifications-title" class="view">
  <header class="page-head layout">
    <div class="in-margin head-margin"><p class="scope">实例设置</p></div>
    <div class="in-main head-main">
      <div class="title-row"><h1 id="notifications-title" tabindex="-1" class="page-title">通知设置</h1></div>
      <p class="page-lede">对所有站点生效，保存后立即使用新配置。</p>
    </div>
  </header>
  <div class="layout page-note">
    {#if store.notificationMessage}<p role="alert" class="in-main notice notice-error">
        {store.notificationMessage}{#if !store.notificationSettings}<button
            type="button"
            disabled={store.notificationBusy}
            onclick={store.loadNotifications}
            class="button">重试</button
          >{/if}
      </p>{/if}
  </div>
  <form
    bind:this={emailForm}
    onsubmit={(event) => {
      event.preventDefault()
      saveChanged()
    }}
    id="email-form"
    novalidate
    aria-labelledby="email-title"
    class="doc"
  >
    <fieldset disabled={store.notificationBusy || !store.notificationSettings}>
      <section class="doc-section layout">
        <div class="in-margin section-margin">
          <h2 id="email-title">电子邮件</h2>
          <p>有新评论时发给通知收件人；访客留了邮箱时，他的评论被别人回复也会收到邮件。</p>
        </div>
        <div class="in-main section-body">
          <div class="field">
            <div role="radiogroup" aria-labelledby="lbl-email-enabled" class="setting">
              <span id="lbl-email-enabled" class="setting-label">邮件通知</span><span class="options"
                ><label
                  ><input type="radio" name="email-enabled" value={true} bind:group={email.enabled} /><span>开启</span
                  ></label
                ><label
                  ><input type="radio" name="email-enabled" value={false} bind:group={email.enabled} /><span>关闭</span
                  ></label
                ></span
              >
            </div>
            {#if !email.enabled}<p class="help">未开启，不会发送任何邮件，包括访客回复通知。</p>{/if}
          </div>
          <div style:display={email.enabled ? undefined : 'none'} class="channel-fields">
            <div class="field">
              <div class="setting">
                <label for="email-server" class="setting-label">SMTP 服务器</label><span class="host-pair"
                  ><input
                    id="email-server"
                    type="text"
                    placeholder="smtp.example.com"
                    maxlength="255"
                    spellcheck="false"
                    bind:value={email.host}
                    aria-invalid={Boolean(emailErrors.host)}
                    class="input mono"
                  /><span class="port-group"
                    ><label for="email-port" class="setting-label">端口</label><input
                      id="email-port"
                      type="number"
                      min="1"
                      max="65535"
                      placeholder={email.encryption === 'starttls' ? '587' : '465'}
                      inputmode="numeric"
                      bind:value={email.port}
                      aria-invalid={Boolean(emailErrors.port)}
                      class="input mono port"
                    /></span
                  ></span
                >
              </div>
              {#if emailErrors.host}<p class="field-error">{emailErrors.host}</p>{/if}{#if emailErrors.port}<p
                  class="field-error"
                >
                  {emailErrors.port}
                </p>{/if}
            </div>
            <div class="field">
              <div id="email-encryption" role="radiogroup" aria-labelledby="lbl-email-encryption" class="setting">
                <span id="lbl-email-encryption" class="setting-label">加密方式</span><span class="options"
                  ><label
                    ><input type="radio" name="email-encryption" value="tls" bind:group={email.encryption} /><span
                      >SSL/TLS</span
                    ></label
                  ><label
                    ><input type="radio" name="email-encryption" value="starttls" bind:group={email.encryption} /><span
                      >STARTTLS</span
                    ></label
                  ></span
                >
              </div>
            </div>
            <div class="field">
              <label class="setting"
                ><span class="setting-label">用户名</span><input
                  id="email-user"
                  type="text"
                  autocomplete="username"
                  bind:value={email.username}
                  class="input"
                /></label
              >
            </div>
            <div class="field">
              <label class="setting"
                ><span class="setting-label">密码</span><input
                  id="email-password"
                  type="password"
                  autocomplete="new-password"
                  bind:value={email.password}
                  aria-invalid={Boolean(emailErrors.password)}
                  placeholder={email.passwordSet ? '已设置，输入新值以更换' : ''}
                  class="input"
                /></label
              >{#if emailErrors.password}<p class="field-error">{emailErrors.password}</p>{/if}
            </div>
            <div class="field">
              <label class="setting"
                ><span class="setting-label">发件人地址</span><input
                  id="email-sender"
                  type="email"
                  bind:value={email.fromAddress}
                  aria-invalid={Boolean(emailErrors.from)}
                  class="input"
                /></label
              >{#if emailErrors.from}<p class="field-error">{emailErrors.from}</p>{/if}
            </div>
            <div class="field">
              <div role="group" aria-labelledby="lbl-email-recipients" class="setting setting-top">
                <span id="lbl-email-recipients" class="setting-label">通知收件人</span>{#key emailInputKey}<ListInput
                    id="email-recipients"
                    bind:this={recipientsInput}
                    bind:modelValue={email.recipients}
                    kind="email"
                    label="通知收件人"
                    addLabel="添加收件人"
                    placeholder="name@example.com"
                    inputmode="email"
                    requiredError={emailErrors.recipients}
                  />{/key}
              </div>
              <p class="help">每项一个邮箱。按 Enter 添加下一项，可一次粘贴多行。</p>
              {#if emailErrors.recipients}<p class="field-error">{emailErrors.recipients}</p>{/if}
            </div>
          </div>
          <div class="section-actions">
            {#if email.enabled}<button
                disabled={store.notificationBusy}
                onclick={sendTestEmail}
                id="email-test"
                type="button"
                class="button button-small">发送测试邮件</button
              >{/if}<span
              aria-live="polite"
              class={[
                'feedback',
                { 'is-success': store.emailTestState === 'success', 'is-failure': store.emailTestState === 'failure' }
              ]}>{email.enabled ? store.emailTestMessage : persistedEmailEnabled ? '关闭后需保存才会生效' : ''}</span
            >
          </div>
        </div>
      </section>
    </fieldset>
  </form>
  <form
    bind:this={telegramForm}
    onsubmit={(event) => {
      event.preventDefault()
      saveChanged()
    }}
    id="telegram-form"
    novalidate
    aria-labelledby="telegram-title"
    class="doc"
  >
    <fieldset disabled={store.notificationBusy || !store.notificationSettings}>
      <section class="doc-section layout">
        <div class="in-margin section-margin">
          <h2 id="telegram-title">Telegram</h2>
          <p>有新评论时由机器人发到下列用户、群组或频道。</p>
        </div>
        <div class="in-main section-body">
          <div class="field">
            <div role="radiogroup" aria-labelledby="lbl-telegram-enabled" class="setting">
              <span id="lbl-telegram-enabled" class="setting-label">Telegram</span><span class="options"
                ><label
                  ><input type="radio" name="telegram-enabled" value={true} bind:group={telegram.enabled} /><span
                    >开启</span
                  ></label
                ><label
                  ><input type="radio" name="telegram-enabled" value={false} bind:group={telegram.enabled} /><span
                    >关闭</span
                  ></label
                ></span
              >
            </div>
            {#if !telegram.enabled}<p class="help">未开启。</p>{/if}
          </div>
          <div style:display={telegram.enabled ? undefined : 'none'} class="channel-fields">
            <div class="field">
              <label class="setting"
                ><span class="setting-label">Bot Token</span><input
                  id="telegram-token"
                  type="password"
                  autocomplete="new-password"
                  bind:value={telegram.token}
                  aria-invalid={Boolean(telegramErrors.token)}
                  placeholder={telegram.tokenSet ? '已设置，输入新值以更换' : ''}
                  class="input mono"
                /></label
              >
              <p class="help">通过 @BotFather 获取。</p>
              {#if telegramErrors.token}<p class="field-error">{telegramErrors.token}</p>{/if}
            </div>
            <div class="field">
              <div role="group" aria-labelledby="lbl-telegram-targets" class="setting setting-top">
                <span id="lbl-telegram-targets" class="setting-label">接收目标 ID</span
                >{#key telegramInputKey}<ListInput
                    id="telegram-targets"
                    bind:this={targetsInput}
                    bind:modelValue={telegram.targets}
                    kind="telegram"
                    label="接收目标 ID"
                    addLabel="添加接收目标"
                    placeholder="-1001234567890"
                    mono
                    inputmode="text"
                    requiredError={telegramErrors.targets}
                  />{/key}
              </div>
              <p class="help">用户、群组或频道的数字 ID，如 123456789 或 -1001234567890。按 Enter 添加下一项。</p>
              {#if telegramErrors.targets}<p class="field-error">{telegramErrors.targets}</p>{/if}
            </div>
          </div>
          <div class="section-actions">
            {#if telegram.enabled}<button
                disabled={store.notificationBusy}
                onclick={sendTestTelegram}
                id="telegram-test"
                type="button"
                class="button button-small">发送测试消息</button
              >{/if}<span
              aria-live="polite"
              class={[
                'feedback',
                {
                  'is-success': store.telegramTestState === 'success',
                  'is-failure': store.telegramTestState === 'failure'
                }
              ]}
              >{telegram.enabled
                ? store.telegramTestMessage
                : persistedTelegramEnabled
                  ? '关闭后需保存才会生效'
                  : ''}</span
            >
          </div>
        </div>
      </section>
    </fieldset>
  </form>
  {#if dirty}<SaveBar
      busy={store.notificationBusy}
      {errorCount}
      status={`${emailDirty ? '电子邮件' : ''}${emailDirty && telegramDirty ? '、' : ''}${telegramDirty ? 'Telegram ' : ''}有未保存的修改`}
      onsave={saveChanged}
      ondiscard={discard}
    />{/if}
</section>
