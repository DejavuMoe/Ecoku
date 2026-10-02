<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import type { SiteSummary, SiteWrite } from '../types'
import SitePicker from './SitePicker.vue'
import SaveBar from './SaveBar.vue'

const store = useAdminStore()
const { sites, selectedSite, siteBusy, siteMessage, createSiteRequest } = storeToRefs(store)
const creating = ref(false)
const baseline = ref('')
const dirty = computed(() => creating.value || JSON.stringify([draft, originsText.value]) !== baseline.value)
const originsText = ref('')
const errors = reactive<Record<string, string>>({})
const defaults = (): SiteWrite => ({ id: '', siteUrl: '', name: '', allowedOrigins: [], defaultSort: 'newest', emailRequired: true, websiteRequired: false, placeholder: '写下评论（仅支持纯文本）', commentLimit: 1000, emptyMessage: '还没有评论\n成为第一个留下评论的人。', smojiEnabled: false, smojiManifestUrl: '', bloggerNickname: '', bloggerEmail: '', bloggerBadge: '[博主]', bloggerPassphrase: '', bloggerPassphraseSet: false, revision: 0 })
const draft = reactive<SiteWrite>(defaults())
const clearErrors = () => Object.keys(errors).forEach((key) => delete errors[key])
function applySite(site: SiteSummary | null) {
  if (!site) { if (!siteBusy.value) startCreating(); else baseline.value = JSON.stringify([draft, originsText.value]); return }
  creating.value = false
  Object.assign(draft, { ...site, allowedOrigins: [...site.allowedOrigins], bloggerPassphrase: '' })
  originsText.value = site.allowedOrigins.join('\n')
  clearErrors()
  baseline.value = JSON.stringify([draft, originsText.value])
}
applySite(selectedSite.value)
watch(selectedSite, site => { if (!creating.value) applySite(site) })
watch(siteBusy, busy => {
  if (!busy && !selectedSite.value && !creating.value && !siteMessage.value) startCreating()
})
watch(createSiteRequest, request => { if (request > 0) { startCreating(); store.consumeCreateSiteRequest() } })
watch(dirty, value => store.setDirty('sites', value), { immediate: true, flush: 'sync' })
onBeforeUnmount(() => store.setDirty('sites', false))
function startCreating() { creating.value = true; Object.assign(draft, defaults()); originsText.value = ''; clearErrors() }
function cancelCreating() {
  const site = selectedSite.value ?? sites.value[0]
  if (site) applySite(site)
  else { creating.value = false; store.setDirty('sites', false); void store.switchView('comments') }
}
async function chooseSite(id: string) { creating.value = false; await store.selectSite(id); applySite(selectedSite.value) }
function validate() {
  clearErrors(); draft.id = draft.id.trim(); draft.siteUrl = draft.siteUrl.trim(); draft.name = draft.name.trim(); draft.placeholder = draft.placeholder.trim(); draft.emptyMessage = draft.emptyMessage.trim(); draft.smojiManifestUrl = draft.smojiManifestUrl.trim(); draft.bloggerNickname = draft.bloggerNickname.trim(); draft.bloggerEmail = draft.bloggerEmail.trim(); draft.bloggerBadge = draft.bloggerBadge.trim(); draft.bloggerPassphrase = (draft.bloggerPassphrase || '').trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(draft.id)) errors.id = '站点 ID 格式无效'
  try { const url = new URL(draft.siteUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.href.includes('?') || url.href.includes('#')) throw new Error() } catch { errors.siteUrl = '站点 URL 格式无效' }
  if ([...draft.name].length > 120 || /[\r\n]/.test(draft.name)) errors.name = '站点名称不能超过 120 个字符'
  const origins = originsText.value.split(/[\r\n,]+/).map((value) => value.trim().replace(/\/$/, '')).filter(Boolean)
  if (!origins.length || origins.length > 32) errors.origins = '请填写 1 至 32 个允许来源'
  for (const origin of origins) { try { const url = new URL(origin); if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error() } catch { errors.origins = '允许来源格式无效' } }
  if (!draft.placeholder || [...draft.placeholder].length > 80 || /[\r\n]/.test(draft.placeholder)) errors.placeholder = '评论占位文案需为 1 至 80 个字符'
  if (!Number.isInteger(draft.commentLimit) || draft.commentLimit < 1 || draft.commentLimit > 10000) errors.commentLimit = '评论长度上限需为 1 至 10000'
  if (!draft.emptyMessage || [...draft.emptyMessage].length > 240) errors.emptyMessage = '无评论文案需为 1 至 240 个字符'
  if (draft.smojiManifestUrl) {
    try {
      const url = new URL(draft.smojiManifestUrl)
      const loopback = ['localhost', '[::1]'].includes(url.hostname) || /^127\.\d+\.\d+\.\d+$/.test(url.hostname)
      if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.href.includes('?') || url.href.includes('#')) throw new Error()
    } catch { errors.smojiManifestUrl = '清单 URL 无效；生产环境需使用 HTTPS' }
  } else if (draft.smojiEnabled) errors.smojiManifestUrl = '启用表情包时必须填写清单 URL'
  if (Boolean(draft.bloggerNickname) !== Boolean(draft.bloggerEmail)) {
    errors.bloggerIdentity = '博主昵称与邮箱需同时填写'
  } else if (draft.bloggerNickname && ([...draft.bloggerNickname].length > 80 || /[\r\n]/.test(draft.bloggerNickname))) {
    errors.bloggerNickname = '博主昵称不能超过 80 个字符'
  } else if (draft.bloggerEmail && (draft.bloggerEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.bloggerEmail))) {
    errors.bloggerEmail = '博主邮箱格式无效'
  }
  if (!draft.bloggerNickname && draft.bloggerPassphrase) {
    errors.bloggerIdentity = '博主口令需要同时填写昵称和邮箱'
  } else if (draft.bloggerNickname && !draft.bloggerPassphrase && (creating.value || !draft.bloggerPassphraseSet)) {
    errors.bloggerPassphrase = '启用博主身份时必须设置口令'
  } else if (draft.bloggerPassphrase && ([...draft.bloggerPassphrase].length < 12 || [...draft.bloggerPassphrase].length > 80 || new TextEncoder().encode(draft.bloggerPassphrase).length > 72 || /[\r\n]/.test(draft.bloggerPassphrase))) {
    errors.bloggerPassphrase = '博主口令需为 12 至 80 个字符，UTF-8 编码不超过 72 字节'
  }
  if ([...draft.bloggerBadge].length > 16 || /[\r\n]/.test(draft.bloggerBadge)) {
    errors.bloggerBadge = '评论区标志不能超过 16 个字符'
  }
  draft.allowedOrigins = [...new Set(origins)]
  return Object.keys(errors).length === 0
}
const siteForm = ref<HTMLFormElement | null>(null)
const errorCount = computed(() => Object.keys(errors).length)
async function submit() {
  if (!validate()) {
    await nextTick()
    siteForm.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  const saved = await store.saveSite({ ...draft, allowedOrigins: [...draft.allowedOrigins] }, creating.value)
  if (saved) applySite(saved)
}
</script>

<template>
<section class="view" aria-labelledby="sites-title">
        <header class="page-head layout">
          <div class="in-margin head-margin"><SitePicker :creating="creating" @select="id => store.requestNavigation(() => chooseSite(id))" /></div>
          <div class="in-main head-main">
            <div class="title-row">
              <h1 id="sites-title" class="page-title" tabindex="-1">{{ creating ? '新增站点' : '站点设置' }}</h1>
              <div class="head-tools"><button v-if="!creating" :disabled="siteBusy" @click="store.requestNavigation(startCreating)" id="new-site-button" class="quiet-link" type="button">新增站点</button></div>
            </div>
            <p class="page-lede">每个接入评论区的网站对应一个站点。</p>
          </div>
        </header>
        <div class="layout page-note"><p v-if="siteMessage" class="in-main notice notice-error" role="alert">{{ siteMessage }}</p></div>

        <form ref="siteForm" @submit.prevent="submit" id="site-form" class="doc" novalidate aria-labelledby="sites-title"><fieldset :disabled="siteBusy">
          <section class="doc-section layout" aria-labelledby="sec-basic">
            <div class="in-margin section-margin"><h2 id="sec-basic">基本信息</h2><p>站点 ID 写在接入代码里，站点 URL 用于拼出文章链接。</p></div>
            <div class="in-main section-body">
              <div class="field">
                <label class="rule"><span class="rule-label">站点 ID</span><input id="site-id" class="mono" maxlength="100" spellcheck="false" autocomplete="off" v-model="draft.id" :aria-invalid="Boolean(errors.id)" :readonly="!creating"></label>
                <p class="help" id="site-id-help">对应接入代码中的 <code>data-site-id</code><template v-if="creating">。字母或数字开头，可含 <code>. _ -</code>，最多 100 个字符；创建后不能修改。</template><template v-else>，创建后不能修改。</template></p>
                <p v-if="errors.id" class="field-error">{{ errors.id }}</p>
              </div>
              <div class="field">
                <label class="rule"><span class="rule-label">站点 URL</span><input id="site-url" class="mono" type="url" maxlength="2048" spellcheck="false" placeholder="https://blog.example.com" v-model="draft.siteUrl" :aria-invalid="Boolean(errors.siteUrl)"></label>
                <p class="help">「查看原评论」和通知中的文章链接由它加上页面 key 拼成。</p>
                <p v-if="errors.siteUrl" class="field-error">{{ errors.siteUrl }}</p>
              </div>
              <div class="field">
                <label class="rule"><span class="rule-label">站点名称</span><input id="site-name" maxlength="240" placeholder="可选" v-model="draft.name" :aria-invalid="Boolean(errors.name)"></label>
                <p class="help">留空时使用站点 URL 的域名。</p>
                <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
              </div>
              <div class="field">
                <label class="rule rule-area"><span class="rule-label">允许来源</span><textarea id="site-origins" class="ruled-paper mono" rows="3" spellcheck="false" v-model="originsText" :aria-invalid="Boolean(errors.origins)"></textarea></label>
                <p class="help">每行一个完整来源，例如 <code>https://blog.example.com</code>；最多 32 个。</p>
                <p v-if="errors.origins" class="field-error">{{ errors.origins }}</p>
              </div>
            </div>
          </section>

          <section class="doc-section layout" aria-labelledby="sec-thread">
            <div class="in-margin section-margin"><h2 id="sec-thread">评论区</h2><p>访客在评论区看到的默认行为与文案。</p></div>
            <div class="in-main section-body">
              <div class="field">
                <div class="rule rule-choice" role="radiogroup" aria-labelledby="lbl-site-sort">
                  <span class="rule-label" id="lbl-site-sort">评论排序</span>
                  <span class="options"><label><input type="radio" name="site-sort" value="newest" v-model="draft.defaultSort"><span>最新评论</span></label><label><input type="radio" name="site-sort" value="oldest" v-model="draft.defaultSort"><span>最早评论</span></label></span>
                </div>
                <p class="help">访客可以在评论区临时切换。</p>
              </div>
              <div class="field">
                <div class="rule rule-choice" role="radiogroup" aria-labelledby="lbl-email-required">
                  <span class="rule-label" id="lbl-email-required">访客邮箱</span>
                  <span class="options"><label><input type="radio" name="site-email-required" :value="true" v-model="draft.emailRequired"><span>必填</span></label><label><input type="radio" name="site-email-required" :value="false" v-model="draft.emailRequired"><span>选填</span></label></span>
                </div>
              </div>
              <div class="field">
                <div class="rule rule-choice" role="radiogroup" aria-labelledby="lbl-website-required">
                  <span class="rule-label" id="lbl-website-required">访客网站</span>
                  <span class="options"><label><input type="radio" name="site-website-required" :value="true" v-model="draft.websiteRequired"><span>必填</span></label><label><input type="radio" name="site-website-required" :value="false" v-model="draft.websiteRequired"><span>选填</span></label></span>
                </div>
                <p class="help">昵称始终必填。</p>
              </div>
              <div class="field">
                <label class="rule"><span class="rule-label">评论占位文案</span><input id="site-placeholder" maxlength="160" v-model="draft.placeholder" :aria-invalid="Boolean(errors.placeholder)"></label>
                <p v-if="errors.placeholder" class="field-error">{{ errors.placeholder }}</p>
              </div>
              <div class="field">
                <label class="rule rule-number"><span class="rule-label">评论长度上限</span><input id="site-limit" class="mono" type="number" min="1" max="10000" inputmode="numeric" v-model.number="draft.commentLimit" :aria-invalid="Boolean(errors.commentLimit)"><span class="rule-suffix">字符</span></label>
                <p class="help">1–10000。中文、日文、韩文与其他 Unicode 字符均按一个字符计数。</p>
                <p v-if="errors.commentLimit" class="field-error">{{ errors.commentLimit }}</p>
              </div>
              <div class="field">
                <label class="rule rule-area"><span class="rule-label">无评论文案</span><textarea id="site-empty" class="ruled-paper" rows="2" maxlength="480" v-model="draft.emptyMessage" :aria-invalid="Boolean(errors.emptyMessage)"></textarea></label>
                <p class="help">还没有评论时显示，可以换行。</p>
                <p v-if="errors.emptyMessage" class="field-error">{{ errors.emptyMessage }}</p>
              </div>
            </div>
          </section>

          <section class="doc-section layout" aria-labelledby="sec-smoji">
            <div class="in-margin section-margin"><h2 id="sec-smoji">表情包</h2><p>表情图片由清单所在的服务器直接提供，可能向该站点暴露访客 IP 等请求信息。</p></div>
            <div class="in-main section-body">
              <div class="field">
                <div class="rule rule-choice" role="radiogroup" aria-labelledby="lbl-smoji">
                  <span class="rule-label" id="lbl-smoji">表情包</span>
                  <span class="options"><label><input type="radio" name="smoji-enabled" :value="true" v-model="draft.smojiEnabled" id="smoji-enabled"><span>启用</span></label><label><input type="radio" name="smoji-enabled" :value="false" v-model="draft.smojiEnabled"><span>关闭</span></label></span>
                </div>
              </div>
              <div class="field">
                <label class="rule"><span class="rule-label">Smoji 清单</span><input id="smoji-manifest-url" class="mono" type="url" maxlength="2048" spellcheck="false" placeholder="https://static.example.com/smoji.json" v-model="draft.smojiManifestUrl" :aria-invalid="Boolean(errors.smojiManifestUrl)"></label>
                <p class="help">HTTPS 地址，图片须与清单同源。关闭表情包时可以保留此地址。</p>
                <p v-if="errors.smojiManifestUrl" class="field-error">{{ errors.smojiManifestUrl }}</p>
              </div>
            </div>
          </section>

          <section class="doc-section layout" aria-labelledby="sec-blogger">
            <div class="in-margin section-margin"><h2 id="sec-blogger">博主身份</h2><p>在评论区昵称栏输入口令即可以博主身份发言。昵称与邮箱需同时填写或同时留空。</p></div>
            <div class="in-main section-body">
              <div class="field">
                <label class="rule"><span class="rule-label">博主昵称</span><input id="blogger-nickname" maxlength="160" v-model="draft.bloggerNickname" :aria-invalid="Boolean(errors.bloggerNickname || errors.bloggerIdentity)"></label>
                <p class="help">公开显示，并链接到站点 URL。</p>
                <p v-if="errors.bloggerNickname" class="field-error">{{ errors.bloggerNickname }}</p>
              </div>
              <div class="field">
                <label class="rule"><span class="rule-label">博主邮箱</span><input id="blogger-email" type="email" maxlength="254" v-model="draft.bloggerEmail" :aria-invalid="Boolean(errors.bloggerEmail || errors.bloggerIdentity)"></label>
                <p class="help">仅用于通知去重与历史评论回填，不会公开。</p>
                <p v-if="errors.bloggerEmail" class="field-error">{{ errors.bloggerEmail }}</p>
                <p v-if="errors.bloggerIdentity" class="field-error">{{ errors.bloggerIdentity }}</p>
              </div>
              <div class="field">
                <label class="rule"><span class="rule-label">博主口令</span><input id="blogger-passphrase" type="password" maxlength="80" autocomplete="new-password" v-model="draft.bloggerPassphrase" :aria-invalid="Boolean(errors.bloggerPassphrase)" :placeholder="draft.bloggerPassphraseSet ? '已设置，输入新值以更换' : ''"></label>
                <p class="help">12–80 个字符，UTF-8 编码不超过 72 字节。保存后不再显示，已设置时留空表示不更改。</p>
                <p v-if="errors.bloggerPassphrase" class="field-error">{{ errors.bloggerPassphrase }}</p>
              </div>
              <div class="field">
                <label class="rule rule-short"><span class="rule-label">评论区标志</span><input id="blogger-badge" maxlength="32" placeholder="可选" v-model="draft.bloggerBadge" :aria-invalid="Boolean(errors.bloggerBadge)"></label>
                <p class="help">显示在博主昵称之后，例如 [博主] 或 [OP]。留空则不显示。</p>
                <p class="specimen" aria-hidden="true"><span class="specimen-label">评论区显示为</span><strong>{{ draft.bloggerNickname || '博主' }}</strong><span v-if="draft.bloggerBadge" class="specimen-badge">{{ draft.bloggerBadge }}</span></p>
                <p v-if="errors.bloggerBadge" class="field-error">{{ errors.bloggerBadge }}</p>
              </div>
            </div>
          </section>
        </fieldset></form>
      <SaveBar v-if="dirty" :busy="siteBusy" :error-count="errorCount" :status="creating ? '新站点尚未创建' : '有未保存的修改'" :save-label="creating ? '创建站点' : '保存站点'" :discard-label="creating ? '取消' : '撤销修改'" @save="submit" @discard="cancelCreating" />
</section>
</template>
