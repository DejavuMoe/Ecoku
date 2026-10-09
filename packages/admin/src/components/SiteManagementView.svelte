<script lang="ts">
  import { tick, onDestroy, untrack } from 'svelte'

  import { useAdminStore } from '../stores/admin.svelte'
  import type { SiteSummary, SiteWrite } from '../types'
  import SitePicker from './SitePicker.svelte'
  import SaveBar from './SaveBar.svelte'
  import ListInput from './ListInput.svelte'
  import AdminIcon from './AdminIcon.svelte'
  import { normalizeSmojiImageOrigin } from '../smoji'
  import { MAX_SITE_ORIGINS, invalidItemCount, normalizeItems } from '../listInput'

  const store = useAdminStore()

  let creating = $state(false)
  let baseline = $state('')
  let dirty = $derived.by(() => creating || JSON.stringify(draft) !== baseline)
  let errors = $state<Record<string, string>>({})
  // Each allowed origin that needs fixing counts once in the save bar; its message sits under the item.
  let invalidOrigins = $state(0)
  // Changing the key gives the origin list fresh rows whenever a site is loaded or a new one is started.
  let listKey = $state(0)
  let originsInput = $state<{ reveal: () => void } | null>(null)
  const defaults = (): SiteWrite => ({
    id: '',
    siteUrl: '',
    name: '',
    allowedOrigins: [],
    defaultSort: 'newest',
    emailRequired: true,
    websiteRequired: false,
    placeholder: '写下评论（仅支持纯文本）',
    commentLimit: 1000,
    emptyMessage: '还没有评论\n成为第一个留下评论的人。',
    smojiEnabled: false,
    smojiManifestUrl: '',
    smojiImageOrigin: '',
    i18n: 'zh-CN',
    bloggerNickname: '',
    bloggerEmail: '',
    bloggerBadge: '[博主]',
    bloggerPassphrase: '',
    bloggerPassphraseSet: false,
    revision: 0
  })
  let draft = $state<SiteWrite>(defaults())
  const clearErrors = () => {
    Object.keys(errors).forEach((key) => delete errors[key])
    invalidOrigins = 0
  }
  function applySite(site: SiteSummary | null) {
    if (!site) {
      if (!store.siteBusy) startCreating()
      else baseline = JSON.stringify(draft)
      return
    }
    creating = false
    Object.assign(draft, { ...site, allowedOrigins: [...site.allowedOrigins], bloggerPassphrase: '' })
    clearErrors()
    listKey++
    baseline = JSON.stringify(draft)
  }
  applySite(store.selectedSite)

  $effect.pre(() => {
    const site = store.selectedSite
    untrack(() => {
      if (!creating) applySite(site)
    })
  })

  $effect.pre(() => {
    const busy = store.siteBusy
    untrack(() => {
      if (!busy && !store.selectedSite && !creating && !store.siteMessage) startCreating()
    })
  })

  $effect.pre(() => {
    const request = store.createSiteRequest
    untrack(() => {
      if (request > 0) {
        startCreating()
        store.consumeCreateSiteRequest()
      }
    })
  })

  $effect.pre(() => {
    const changed = dirty
    untrack(() => store.setDirty('sites', changed))
  })
  onDestroy(() => store.setDirty('sites', false))

  $effect.pre(() => {
    const count = draft.allowedOrigins.length
    untrack(() => {
      if (count) delete errors.origins
    })
  })
  function startCreating() {
    creating = true
    Object.assign(draft, defaults())
    clearErrors()
    listKey++
  }
  function cancelCreating() {
    const site = store.selectedSite ?? store.sites[0]
    if (site) applySite(site)
    else {
      creating = false
      store.setDirty('sites', false)
      void store.switchView('comments')
    }
  }
  async function chooseSite(id: string) {
    creating = false
    await store.selectSite(id)
    applySite(store.selectedSite)
  }
  function validate() {
    clearErrors()
    draft.id = draft.id.trim()
    draft.siteUrl = draft.siteUrl.trim()
    draft.name = draft.name.trim()
    draft.placeholder = draft.placeholder.trim()
    draft.emptyMessage = draft.emptyMessage.trim()
    draft.smojiManifestUrl = draft.smojiManifestUrl.trim()
    draft.bloggerNickname = draft.bloggerNickname.trim()
    draft.bloggerEmail = draft.bloggerEmail.trim()
    draft.bloggerBadge = draft.bloggerBadge.trim()
    draft.bloggerPassphrase = (draft.bloggerPassphrase || '').trim()
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(draft.id)) errors.id = '站点 ID 格式无效'
    try {
      const url = new URL(draft.siteUrl)
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        url.username ||
        url.password ||
        url.href.includes('?') ||
        url.href.includes('#')
      )
        throw new Error()
    } catch {
      errors.siteUrl = '站点 URL 格式无效'
    }
    if ([...draft.name].length > 120 || /[\r\n]/.test(draft.name)) errors.name = '站点名称不能超过 120 个字符'
    if (!draft.allowedOrigins.length) errors.origins = '至少填写一个允许来源'
    originsInput?.reveal()
    invalidOrigins = invalidItemCount('origin', draft.allowedOrigins)
    if (!draft.placeholder || [...draft.placeholder].length > 80 || /[\r\n]/.test(draft.placeholder))
      errors.placeholder = '评论占位文案需为 1 至 80 个字符'
    if (!Number.isInteger(draft.commentLimit) || draft.commentLimit < 1 || draft.commentLimit > 10000)
      errors.commentLimit = '评论长度上限需为 1 至 10000'
    if (!draft.emptyMessage || [...draft.emptyMessage].length > 240)
      errors.emptyMessage = '无评论文案需为 1 至 240 个字符'
    if (draft.smojiManifestUrl) {
      try {
        const url = new URL(draft.smojiManifestUrl)
        const loopback = ['localhost', '[::1]'].includes(url.hostname) || /^127\.\d+\.\d+\.\d+$/.test(url.hostname)
        if (
          (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
          url.username ||
          url.password ||
          url.href.includes('?') ||
          url.href.includes('#')
        )
          throw new Error()
      } catch {
        errors.smojiManifestUrl = '清单 URL 无效；生产环境需使用 HTTPS'
      }
    } else if (draft.smojiEnabled) errors.smojiManifestUrl = '启用表情包时必须填写清单 URL'
    try {
      draft.smojiImageOrigin = normalizeSmojiImageOrigin(draft.smojiImageOrigin)
    } catch {
      errors.smojiImageOrigin = '图片来源无效；请填写 HTTPS 来源，不含路径'
    }
    if (Boolean(draft.bloggerNickname) !== Boolean(draft.bloggerEmail)) {
      errors.bloggerIdentity = '博主昵称与邮箱需同时填写'
    } else if (
      draft.bloggerNickname &&
      ([...draft.bloggerNickname].length > 80 || /[\r\n]/.test(draft.bloggerNickname))
    ) {
      errors.bloggerNickname = '博主昵称不能超过 80 个字符'
    } else if (
      draft.bloggerEmail &&
      (draft.bloggerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.bloggerEmail))
    ) {
      errors.bloggerEmail = '博主邮箱格式无效'
    }
    if (!draft.bloggerNickname && draft.bloggerPassphrase) {
      errors.bloggerIdentity = '博主口令需要同时填写昵称和邮箱'
    } else if (draft.bloggerNickname && !draft.bloggerPassphrase && (creating || !draft.bloggerPassphraseSet)) {
      errors.bloggerPassphrase = '启用博主身份时必须设置口令'
    } else if (
      draft.bloggerPassphrase &&
      ([...draft.bloggerPassphrase].length < 12 ||
        [...draft.bloggerPassphrase].length > 80 ||
        new TextEncoder().encode(draft.bloggerPassphrase).length > 72 ||
        /[\r\n]/.test(draft.bloggerPassphrase))
    ) {
      errors.bloggerPassphrase = '博主口令需为 12 至 80 个字符，UTF-8 编码不超过 72 字节'
    }
    if ([...draft.bloggerBadge].length > 16 || /[\r\n]/.test(draft.bloggerBadge)) {
      errors.bloggerBadge = '评论区标志不能超过 16 个字符'
    }
    return Object.keys(errors).length === 0 && invalidOrigins === 0
  }
  let siteForm = $state<HTMLFormElement | null>(null)
  let errorCount = $derived.by(() => Object.keys(errors).length + invalidOrigins)
  async function submit() {
    if (!validate()) {
      await tick()
      siteForm?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    const saved = await store.saveSite(
      { ...draft, allowedOrigins: normalizeItems('origin', draft.allowedOrigins) },
      creating
    )
    if (saved) applySite(saved)
  }
</script>

<section aria-labelledby="sites-title" class="view">
  <header class="page-head layout">
    <div class="in-margin head-margin">
      <SitePicker {creating} onselect={(id) => store.requestNavigation(() => chooseSite(id))} />
    </div>
    <div class="in-main head-main">
      <div class="title-row">
        <h1 id="sites-title" tabindex="-1" class="page-title">{creating ? '新增站点' : '站点设置'}</h1>
        <div class="head-tools">
          {#if !creating}<button
              disabled={store.siteBusy}
              onclick={() => {
                store.requestNavigation(startCreating)
              }}
              id="new-site-button"
              type="button"
              class="button button-small"><AdminIcon name="plus" />新增站点</button
            >{/if}
        </div>
      </div>
      <p class="page-lede">每个接入评论区的网站对应一个站点。</p>
    </div>
  </header>
  <div class="layout page-note">
    {#if store.siteMessage}<p role="alert" class="in-main notice notice-error">{store.siteMessage}</p>{/if}
  </div>
  <form
    bind:this={siteForm}
    onsubmit={(event) => {
      event.preventDefault()
      submit()
    }}
    id="site-form"
    novalidate
    aria-labelledby="sites-title"
    class="doc"
  >
    <fieldset disabled={store.siteBusy}>
      <section aria-labelledby="sec-basic" class="doc-section layout">
        <div class="in-margin section-margin">
          <h2 id="sec-basic">基本信息</h2>
          <p>站点 ID 写在接入代码里，站点 URL 用于拼出文章链接。</p>
        </div>
        <div class="in-main section-body">
          <div class="field">
            <label class="setting"
              ><span class="setting-label">站点 ID</span><input
                id="site-id"
                maxlength="100"
                spellcheck="false"
                autocomplete="off"
                bind:value={draft.id}
                aria-invalid={Boolean(errors.id)}
                readonly={!creating}
                class="input mono"
              /></label
            >
            <p id="site-id-help" class="help">
              对应接入代码中的 <code>data-site-id</code>{#if creating}。字母或数字开头，可含 <code>. _ -</code>，最多
                100 个字符；创建后不能修改。{:else}，创建后不能修改。{/if}
            </p>
            {#if errors.id}<p class="field-error">{errors.id}</p>{/if}
          </div>
          <div class="field">
            <label class="setting"
              ><span class="setting-label">站点 URL</span><input
                id="site-url"
                type="url"
                maxlength="2048"
                spellcheck="false"
                placeholder="https://blog.example.com"
                bind:value={draft.siteUrl}
                aria-invalid={Boolean(errors.siteUrl)}
                class="input mono"
              /></label
            >
            <p class="help">「查看原评论」和通知中的文章链接由它加上页面 key 拼成。</p>
            {#if errors.siteUrl}<p class="field-error">{errors.siteUrl}</p>{/if}
          </div>
          <div class="field">
            <label class="setting"
              ><span class="setting-label">站点名称</span><input
                id="site-name"
                maxlength="240"
                placeholder="可选"
                bind:value={draft.name}
                aria-invalid={Boolean(errors.name)}
                class="input"
              /></label
            >
            <p class="help">留空时使用站点 URL 的域名。</p>
            {#if errors.name}<p class="field-error">{errors.name}</p>{/if}
          </div>
          <div class="field">
            <div role="group" aria-labelledby="lbl-site-origins" class="setting setting-top">
              <span id="lbl-site-origins" class="setting-label">允许来源</span>{#key listKey}<ListInput
                  id="site-origins"
                  bind:this={originsInput}
                  bind:modelValue={draft.allowedOrigins}
                  kind="origin"
                  label="允许来源"
                  addLabel="添加来源"
                  placeholder="https://blog.example.com"
                  max={MAX_SITE_ORIGINS}
                  mono
                  inputmode="url"
                  requiredError={errors.origins}
                />{/key}
            </div>
            <p class="help">
              放置评论区的网页来源，只含协议、域名和端口，例如 <code>https://blog.example.com</code>。按 Enter
              添加下一项，可一次粘贴多行。
            </p>
            {#if errors.origins}<p class="field-error">{errors.origins}</p>{/if}
          </div>
        </div>
      </section>
      <section aria-labelledby="sec-thread" class="doc-section layout">
        <div class="in-margin section-margin">
          <h2 id="sec-thread">评论区</h2>
          <p>访客在评论区看到的默认行为与文案。</p>
        </div>
        <div class="in-main section-body">
          <div class="field">
            <div role="radiogroup" aria-labelledby="lbl-site-i18n" class="setting">
              <span id="lbl-site-i18n" class="setting-label">评论区语言</span><span translate="no" class="options"
                ><label
                  ><input type="radio" name="site-i18n" value="zh-CN" bind:group={draft.i18n} /><span
                    lang="zh-CN"
                    class="lang">简体中文</span
                  ></label
                ><label
                  ><input type="radio" name="site-i18n" value="zh-Hant" bind:group={draft.i18n} /><span
                    lang="zh-Hant"
                    class="lang">繁體中文</span
                  ></label
                ><label
                  ><input type="radio" name="site-i18n" value="en" bind:group={draft.i18n} /><span
                    lang="en"
                    class="lang">English</span
                  ></label
                ></span
              >
            </div>
            <p class="help">访客评论区的默认语言；接入 SDK 时传入 <code>i18n</code> 可以覆盖此设置。</p>
          </div>
          <div class="field">
            <div role="radiogroup" aria-labelledby="lbl-site-sort" class="setting">
              <span id="lbl-site-sort" class="setting-label">评论排序</span><span class="options"
                ><label
                  ><input type="radio" name="site-sort" value="newest" bind:group={draft.defaultSort} /><span
                    >最新评论</span
                  ></label
                ><label
                  ><input type="radio" name="site-sort" value="oldest" bind:group={draft.defaultSort} /><span
                    >最早评论</span
                  ></label
                ></span
              >
            </div>
            <p class="help">访客可以在评论区临时切换。</p>
          </div>
          <div class="field">
            <div role="radiogroup" aria-labelledby="lbl-email-required" class="setting">
              <span id="lbl-email-required" class="setting-label">访客邮箱</span><span class="options"
                ><label
                  ><input type="radio" name="site-email-required" value={true} bind:group={draft.emailRequired} /><span
                    >必填</span
                  ></label
                ><label
                  ><input type="radio" name="site-email-required" value={false} bind:group={draft.emailRequired} /><span
                    >选填</span
                  ></label
                ></span
              >
            </div>
          </div>
          <div class="field">
            <div role="radiogroup" aria-labelledby="lbl-website-required" class="setting">
              <span id="lbl-website-required" class="setting-label">访客网站</span><span class="options"
                ><label
                  ><input
                    type="radio"
                    name="site-website-required"
                    value={true}
                    bind:group={draft.websiteRequired}
                  /><span>必填</span></label
                ><label
                  ><input
                    type="radio"
                    name="site-website-required"
                    value={false}
                    bind:group={draft.websiteRequired}
                  /><span>选填</span></label
                ></span
              >
            </div>
            <p class="help">昵称始终必填。</p>
          </div>
          <div class="field">
            <label class="setting"
              ><span class="setting-label">评论占位文案</span><input
                id="site-placeholder"
                maxlength="160"
                bind:value={draft.placeholder}
                aria-invalid={Boolean(errors.placeholder)}
                class="input"
              /></label
            >{#if errors.placeholder}<p class="field-error">{errors.placeholder}</p>{/if}
          </div>
          <div class="field">
            <label class="setting setting-number"
              ><span class="setting-label">评论长度上限</span><span class="control-line"
                ><input
                  id="site-limit"
                  type="number"
                  min="1"
                  max="10000"
                  inputmode="numeric"
                  bind:value={draft.commentLimit}
                  aria-invalid={Boolean(errors.commentLimit)}
                  class="input mono"
                /><span class="control-suffix">字符</span></span
              ></label
            >
            <p class="help">1–10000。中文、日文、韩文与其他 Unicode 字符均按一个字符计数。</p>
            {#if errors.commentLimit}<p class="field-error">{errors.commentLimit}</p>{/if}
          </div>
          <div class="field">
            <label class="setting setting-top"
              ><span class="setting-label">无评论文案</span><textarea
                id="site-empty"
                rows="2"
                maxlength="480"
                bind:value={draft.emptyMessage}
                aria-invalid={Boolean(errors.emptyMessage)}
                class="input"></textarea></label
            >
            <p class="help">还没有评论时显示，可以换行。</p>
            {#if errors.emptyMessage}<p class="field-error">{errors.emptyMessage}</p>{/if}
          </div>
        </div>
      </section>
      <section aria-labelledby="sec-smoji" class="doc-section layout">
        <div class="in-margin section-margin">
          <h2 id="sec-smoji">表情包</h2>
          <p>清单和图片由资源服务器直接提供，可能向该服务器暴露访客 IP 等请求信息。</p>
        </div>
        <div class="in-main section-body">
          <div class="field">
            <div role="radiogroup" aria-labelledby="lbl-smoji" class="setting">
              <span id="lbl-smoji" class="setting-label">表情包</span><span class="options"
                ><label
                  ><input
                    type="radio"
                    name="smoji-enabled"
                    value={true}
                    bind:group={draft.smojiEnabled}
                    id="smoji-enabled"
                  /><span>启用</span></label
                ><label
                  ><input type="radio" name="smoji-enabled" value={false} bind:group={draft.smojiEnabled} /><span
                    >关闭</span
                  ></label
                ></span
              >
            </div>
          </div>
          <div class="field">
            <label class="setting"
              ><span class="setting-label">Smoji 清单</span><input
                id="smoji-manifest-url"
                type="url"
                maxlength="2048"
                spellcheck="false"
                placeholder="https://static.example.com/smoji.json"
                bind:value={draft.smojiManifestUrl}
                aria-invalid={Boolean(errors.smojiManifestUrl)}
                aria-describedby={errors.smojiManifestUrl
                  ? 'smoji-manifest-help smoji-manifest-error'
                  : 'smoji-manifest-help'}
                class="input mono"
              /></label
            >
            <p id="smoji-manifest-help" class="help">
              填写公开的 HTTPS 清单地址。可在 <a href="https://smoji.zsh.moe/" target="_blank" rel="noreferrer"
                >Smoji 工作台</a
              > 挑选表情，导出后自行托管。
            </p>
            {#if errors.smojiManifestUrl}<p id="smoji-manifest-error" class="field-error">
                {errors.smojiManifestUrl}
              </p>{/if}
          </div>
          <div class="field">
            <label class="setting"
              ><span class="setting-label">图片来源</span><input
                id="smoji-image-origin"
                type="url"
                maxlength="2048"
                spellcheck="false"
                placeholder="留空时与清单同源"
                bind:value={draft.smojiImageOrigin}
                aria-invalid={Boolean(errors.smojiImageOrigin)}
                aria-describedby={errors.smojiImageOrigin ? 'smoji-image-help smoji-image-error' : 'smoji-image-help'}
                class="input mono"
              /></label
            >
            <p id="smoji-image-help" class="help">
              选填。图片放在其他 CDN 时，填写其来源，如 https://cdn.example.com，不含路径。仅允许这个来源的图片。
            </p>
            {#if errors.smojiImageOrigin}<p id="smoji-image-error" class="field-error">
                {errors.smojiImageOrigin}
              </p>{/if}
          </div>
          <p class="help">关闭表情包时保留这些地址；历史表情会按文字显示。</p>
        </div>
      </section>
      <section aria-labelledby="sec-blogger" class="doc-section layout">
        <div class="in-margin section-margin">
          <h2 id="sec-blogger">博主身份</h2>
          <p>在评论区昵称栏输入口令即可以博主身份发言。昵称与邮箱需同时填写或同时留空。</p>
        </div>
        <div class="in-main section-body">
          <div class="field">
            <label class="setting"
              ><span class="setting-label">博主昵称</span><input
                id="blogger-nickname"
                maxlength="160"
                bind:value={draft.bloggerNickname}
                aria-invalid={Boolean(errors.bloggerNickname || errors.bloggerIdentity)}
                class="input"
              /></label
            >
            <p class="help">公开显示，并链接到站点 URL。</p>
            {#if errors.bloggerNickname}<p class="field-error">{errors.bloggerNickname}</p>{/if}
          </div>
          <div class="field">
            <label class="setting"
              ><span class="setting-label">博主邮箱</span><input
                id="blogger-email"
                type="email"
                maxlength="254"
                bind:value={draft.bloggerEmail}
                aria-invalid={Boolean(errors.bloggerEmail || errors.bloggerIdentity)}
                class="input"
              /></label
            >
            <p class="help">仅用于通知去重与历史评论回填，不会公开。</p>
            {#if errors.bloggerEmail}<p class="field-error">{errors.bloggerEmail}</p>{/if}{#if errors.bloggerIdentity}<p
                class="field-error"
              >
                {errors.bloggerIdentity}
              </p>{/if}
          </div>
          <div class="field">
            <label class="setting"
              ><span class="setting-label">博主口令</span><input
                id="blogger-passphrase"
                type="password"
                maxlength="80"
                autocomplete="new-password"
                bind:value={draft.bloggerPassphrase}
                aria-invalid={Boolean(errors.bloggerPassphrase)}
                placeholder={draft.bloggerPassphraseSet ? '已设置，输入新值以更换' : ''}
                class="input"
              /></label
            >
            <p class="help">12–80 个字符，UTF-8 编码不超过 72 字节。保存后不再显示，已设置时留空表示不更改。</p>
            {#if errors.bloggerPassphrase}<p class="field-error">{errors.bloggerPassphrase}</p>{/if}
          </div>
          <div class="field">
            <label class="setting setting-short"
              ><span class="setting-label">评论区标志</span><input
                id="blogger-badge"
                maxlength="32"
                placeholder="可选"
                bind:value={draft.bloggerBadge}
                aria-invalid={Boolean(errors.bloggerBadge)}
                class="input"
              /></label
            >
            <p class="help">显示在博主昵称之后，例如 [博主] 或 [OP]。留空则不显示。</p>
            <p aria-hidden="true" class="specimen">
              <span class="specimen-label">评论区显示为</span><strong
                translate={draft.bloggerNickname ? 'no' : undefined}>{draft.bloggerNickname || '博主'}</strong
              >{#if draft.bloggerBadge}<span translate="no" class="specimen-badge">{draft.bloggerBadge}</span>{/if}
            </p>
            {#if errors.bloggerBadge}<p class="field-error">{errors.bloggerBadge}</p>{/if}
          </div>
        </div>
      </section>
    </fieldset>
  </form>
  {#if dirty}<SaveBar
      busy={store.siteBusy}
      {errorCount}
      status={creating ? '新站点尚未创建' : '有未保存的修改'}
      saveLabel={creating ? '创建站点' : '保存站点'}
      discardLabel={creating ? '取消' : '撤销修改'}
      onsave={submit}
      ondiscard={cancelCreating}
    />{/if}
</section>
