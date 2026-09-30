<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import type { SiteSummary, SiteWrite } from '../types'
import AdminIcon from './AdminIcon.vue'

const store = useAdminStore()
const { sites, selectedSite, selectedSiteId, siteBusy, siteMessage } = storeToRefs(store)
const creating = ref(false)
const originsText = ref('')
const errors = reactive<Record<string, string>>({})
const baseline = ref('')
const defaults = (): SiteWrite => ({ id: '', siteUrl: '', name: '', allowedOrigins: [], defaultSort: 'newest', emailRequired: true, websiteRequired: false, placeholder: '写下评论（仅支持纯文本）', commentLimit: 1000, emptyMessage: '还没有评论\n成为第一个留下评论的人。', smojiEnabled: false, smojiManifestUrl: '', bloggerNickname: '', bloggerEmail: '', bloggerBadge: '[博主]', bloggerPassphrase: '', bloggerPassphraseSet: false, revision: 0 })
const draft = reactive<SiteWrite>(defaults())
const clearErrors = () => Object.keys(errors).forEach((key) => delete errors[key])
function applySite(site: SiteSummary | null) {
  if (!site) return
  creating.value = false
  Object.assign(draft, { ...site, allowedOrigins: [...site.allowedOrigins], bloggerPassphrase: '' })
  originsText.value = site.allowedOrigins.join('\n')
  clearErrors()
  baseline.value = snapshot()
}
watch(selectedSite, (site) => { if (!creating.value) applySite(site) }, { immediate: true })
function snapshot() { return JSON.stringify({ ...draft, bloggerPassphrase: '', allowedOrigins: originsText.value.split(/[\r\n,]+/).map((value) => value.trim()).filter(Boolean) }) }
const dirty = computed(() => creating.value || snapshot() !== baseline.value)
function startCreating() { creating.value = true; Object.assign(draft, defaults()); originsText.value = ''; clearErrors(); baseline.value = snapshot() }
function cancelCreating() { applySite(selectedSite.value ?? sites.value[0] ?? null) }
async function chooseSite(site: SiteSummary) { creating.value = false; await store.selectSite(site.id); applySite(site) }
function displayName(site: SiteSummary) { if (site.name) return site.name; try { return new URL(site.siteUrl).hostname } catch { return site.siteUrl } }
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
  <section class="page-layout" aria-labelledby="sites-title">
    <div class="page-column">
      <header class="page-heading">
        <div><h1 id="sites-title">站点管理</h1><p>每个接入评论区的网站对应一个站点。</p></div>
        <button class="button" type="button" :disabled="siteBusy || creating" @click="startCreating"><AdminIcon name="plus" />新增站点</button>
      </header>
      <p v-if="siteMessage" class="notice notice-error" role="alert">{{ siteMessage }}</p>
      <div class="sites-grid">
        <nav class="site-list-panel" aria-label="站点列表">
          <p class="site-list-title">已注册站点 · {{ sites.length }}</p>
          <button v-if="creating" class="site-list-item is-draft" type="button" aria-current="true"><strong>新站点</strong><small>尚未保存</small></button>
          <button v-for="site in sites" :key="site.id" class="site-list-item" type="button" :aria-current="!creating && selectedSiteId === site.id" @click="chooseSite(site)"><strong>{{ displayName(site) }}</strong><small>{{ site.id }}</small></button>
          <p v-if="!sites.length && !creating" class="field-help site-list-title">当前实例还没有站点</p>
        </nav>

        <form ref="siteForm" class="settings-card" novalidate aria-labelledby="site-form-title" @submit.prevent="submit">
          <h2 id="site-form-title" class="visually-hidden">{{ creating ? '新增站点' : '编辑站点' }}</h2>

          <section class="form-section" aria-labelledby="site-section-basic">
            <div class="section-heading"><h2 id="site-section-basic">基本信息</h2><p>站点 ID 写在接入代码里，站点 URL 用于拼出文章链接。</p></div>
            <div class="section-fields">
              <div class="field">
                <label class="field-label" for="site-id">站点 ID</label>
                <input id="site-id" v-model="draft.id" class="input input-mono" maxlength="100" spellcheck="false" :readonly="!creating" :aria-invalid="Boolean(errors.id)">
                <p v-if="errors.id" class="field-error">{{ errors.id }}</p>
                <p v-if="creating" class="field-help">对应接入代码中的 <code class="mono">data-site-id</code>。字母或数字开头，可含 <span class="mono">. _ -</span>，最多 100 个字符；创建后不能修改。</p>
                <p v-else class="field-help">对应接入代码中的 <code class="mono">data-site-id</code>，创建后不能修改。</p>
              </div>
              <div class="field">
                <label class="field-label" for="site-url">站点 URL</label>
                <input id="site-url" v-model="draft.siteUrl" class="input" type="url" maxlength="2048" spellcheck="false" placeholder="https://blog.example.com" :aria-invalid="Boolean(errors.siteUrl)">
                <p v-if="errors.siteUrl" class="field-error">{{ errors.siteUrl }}</p>
                <p class="field-help">「查看原评论」和通知中的文章链接由它加上页面 key 拼成。</p>
              </div>
              <div class="field">
                <label class="field-label" for="site-name">站点名称 <span class="optional">可选</span></label>
                <input id="site-name" v-model="draft.name" class="input" maxlength="240" :aria-invalid="Boolean(errors.name)">
                <p v-if="errors.name" class="field-error">{{ errors.name }}</p>
                <p class="field-help">留空时使用站点 URL 的域名。</p>
              </div>
              <div class="field">
                <label class="field-label" for="site-origins">允许来源</label>
                <textarea id="site-origins" v-model="originsText" class="textarea input-mono" rows="3" spellcheck="false" :aria-invalid="Boolean(errors.origins)" />
                <p v-if="errors.origins" class="field-error">{{ errors.origins }}</p>
                <p class="field-help">每行一个完整来源，例如 <span class="mono">https://blog.example.com</span>；最多 32 个。</p>
              </div>
            </div>
          </section>

          <section class="form-section" aria-labelledby="site-section-thread">
            <div class="section-heading"><h2 id="site-section-thread">评论区</h2><p>访客在评论区看到的默认行为与文案。</p></div>
            <div class="section-fields">
              <div class="field">
                <span id="site-sort-label" class="field-label">评论排序</span>
                <div class="segmented" role="radiogroup" aria-labelledby="site-sort-label">
                  <label><input v-model="draft.defaultSort" type="radio" name="site-sort" value="newest"><span>最新评论</span></label>
                  <label><input v-model="draft.defaultSort" type="radio" name="site-sort" value="oldest"><span>最早评论</span></label>
                </div>
                <p class="field-help">访客可以在评论区临时切换。</p>
              </div>
              <div class="field">
                <span class="field-label">字段要求</span>
                <div class="choice-row">
                  <label class="choice"><input v-model="draft.emailRequired" type="checkbox">邮箱必填</label>
                  <label class="choice"><input v-model="draft.websiteRequired" type="checkbox">网站必填</label>
                </div>
                <p class="field-help">昵称始终必填。</p>
              </div>
              <div class="field">
                <label class="field-label" for="site-placeholder">评论占位文案</label>
                <input id="site-placeholder" v-model="draft.placeholder" class="input" maxlength="160" :aria-invalid="Boolean(errors.placeholder)">
                <p v-if="errors.placeholder" class="field-error">{{ errors.placeholder }}</p>
              </div>
              <div class="field">
                <label class="field-label" for="site-limit">评论长度上限</label>
                <div class="input-affix limit-field"><input id="site-limit" v-model.number="draft.commentLimit" class="input" type="number" min="1" max="10000" :aria-invalid="Boolean(errors.commentLimit)"><span>字符</span></div>
                <p v-if="errors.commentLimit" class="field-error">{{ errors.commentLimit }}</p>
                <p class="field-help">1–10000。中文、日文、韩文与其他 Unicode 字符均按一个字符计数。</p>
              </div>
              <div class="field">
                <label class="field-label" for="site-empty">无评论文案</label>
                <textarea id="site-empty" v-model="draft.emptyMessage" class="textarea" rows="2" maxlength="480" :aria-invalid="Boolean(errors.emptyMessage)" />
                <p v-if="errors.emptyMessage" class="field-error">{{ errors.emptyMessage }}</p>
                <p class="field-help">还没有评论时显示，可以换行。</p>
              </div>
            </div>
          </section>

          <section class="form-section" aria-labelledby="site-section-smoji">
            <div class="section-heading"><h2 id="site-section-smoji">表情包</h2><p>表情图片由清单所在的服务器直接提供，可能向该站点暴露访客 IP 等请求信息。</p></div>
            <div class="section-fields">
              <label class="switch">
                <input id="smoji-enabled" v-model="draft.smojiEnabled" class="switch-input" type="checkbox">
                <span class="switch-track" aria-hidden="true" /><span>启用表情包</span>
              </label>
              <div class="field">
                <label class="field-label" for="smoji-manifest-url">Smoji 清单 URL</label>
                <input id="smoji-manifest-url" v-model="draft.smojiManifestUrl" class="input input-mono" type="url" maxlength="2048" spellcheck="false" placeholder="https://static.example.com/smoji.json" :aria-invalid="Boolean(errors.smojiManifestUrl)">
                <p v-if="errors.smojiManifestUrl" class="field-error">{{ errors.smojiManifestUrl }}</p>
                <p class="field-help">HTTPS 地址，图片须与清单同源。关闭表情包时可以保留此地址。</p>
              </div>
            </div>
          </section>

          <section class="form-section" aria-labelledby="site-section-blogger">
            <div class="section-heading"><h2 id="site-section-blogger">博主身份</h2><p>在评论区昵称栏输入口令即可以博主身份发言。昵称与邮箱需同时填写或同时留空。</p></div>
            <div class="section-fields">
              <div class="field-grid">
                <div class="field">
                  <label class="field-label" for="blogger-nickname">博主昵称</label>
                  <input id="blogger-nickname" v-model="draft.bloggerNickname" class="input" maxlength="160" :aria-invalid="Boolean(errors.bloggerNickname || errors.bloggerIdentity)">
                  <p v-if="errors.bloggerNickname" class="field-error">{{ errors.bloggerNickname }}</p>
                  <p class="field-help">公开显示，并链接到站点 URL。</p>
                </div>
                <div class="field">
                  <label class="field-label" for="blogger-email">博主邮箱</label>
                  <input id="blogger-email" v-model="draft.bloggerEmail" class="input" type="email" maxlength="254" :aria-invalid="Boolean(errors.bloggerEmail || errors.bloggerIdentity)">
                  <p v-if="errors.bloggerEmail" class="field-error">{{ errors.bloggerEmail }}</p>
                  <p class="field-help">仅用于通知去重与历史评论回填，不会公开。</p>
                </div>
                <p v-if="errors.bloggerIdentity" class="field-error span-2">{{ errors.bloggerIdentity }}</p>
                <div class="field">
                  <label class="field-label" for="blogger-passphrase">博主口令</label>
                  <input id="blogger-passphrase" v-model="draft.bloggerPassphrase" class="input" type="password" maxlength="80" autocomplete="new-password" :placeholder="draft.bloggerPassphraseSet ? '已设置，输入新值以更换' : ''" :aria-invalid="Boolean(errors.bloggerPassphrase)">
                  <p v-if="errors.bloggerPassphrase" class="field-error">{{ errors.bloggerPassphrase }}</p>
                  <p class="field-help">12–80 个字符，UTF-8 编码不超过 72 字节。保存后不再显示，已设置时留空表示不更改。</p>
                </div>
                <div class="field">
                  <label class="field-label" for="blogger-badge">评论区标志 <span class="optional">可选</span></label>
                  <input id="blogger-badge" v-model="draft.bloggerBadge" class="input" maxlength="32" :aria-invalid="Boolean(errors.bloggerBadge)">
                  <p v-if="errors.bloggerBadge" class="field-error">{{ errors.bloggerBadge }}</p>
                  <p class="field-help">显示在博主昵称之后，例如 [博主] 或 [OP]。留空则不显示。</p>
                </div>
              </div>
            </div>
          </section>

          <footer class="form-actions" :class="{ 'is-dirty': dirty }">
            <span class="summary" :class="{ 'is-error': errorCount }" aria-live="polite">{{ errorCount ? `有 ${errorCount} 处需要修改` : dirty ? '有未保存的修改' : '' }}</span>
            <span class="push" />
            <button v-if="creating" class="button" type="button" @click="cancelCreating">取消</button>
            <button class="button button-primary" type="submit" :disabled="siteBusy || (!creating && !selectedSite)">{{ siteBusy ? '保存中…' : creating ? '创建站点' : '保存站点' }}</button>
          </footer>
        </form>
      </div>
      <div class="page-end" />
    </div>
  </section>
</template>
