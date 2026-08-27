<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useAdminStore } from '../stores/admin'
import type { SiteSummary, SiteWrite } from '../types'

const store = useAdminStore()
const { sites, selectedSite, selectedSiteId, siteBusy, siteMessage } = storeToRefs(store)
const creating = ref(false)
const originsText = ref('')
const errors = reactive<Record<string, string>>({})
const defaults = (): SiteWrite => ({ id: '', siteUrl: '', name: '', allowedOrigins: [], defaultSort: 'newest', emailRequired: true, websiteRequired: false, placeholder: '写下评论（仅支持纯文本）', commentLimit: 1000, emptyMessage: '还没有评论\n成为第一个留下评论的人。', smojiEnabled: false, smojiManifestUrl: '', bloggerNickname: '', bloggerEmail: '', bloggerBadge: '[博主]', bloggerPassphrase: '', bloggerPassphraseSet: false, revision: 0 })
const draft = reactive<SiteWrite>(defaults())
const clearErrors = () => Object.keys(errors).forEach((key) => delete errors[key])
function applySite(site: SiteSummary | null) {
  if (!site) return
  creating.value = false
  Object.assign(draft, { ...site, allowedOrigins: [...site.allowedOrigins], bloggerPassphrase: '' })
  originsText.value = site.allowedOrigins.join('\n')
  clearErrors()
}
watch(selectedSite, (site) => { if (!creating.value) applySite(site) }, { immediate: true })
function startCreating() { creating.value = true; Object.assign(draft, defaults()); originsText.value = ''; clearErrors() }
function cancelCreating() { applySite(selectedSite.value ?? sites.value[0] ?? null) }
async function chooseSite(site: SiteSummary) { creating.value = false; await store.selectSite(site.id); applySite(site) }
function displayName(site: SiteSummary) { if (site.name) return site.name; try { return new URL(site.siteUrl).hostname } catch { return site.siteUrl } }
function validate() {
  clearErrors(); draft.id = draft.id.trim(); draft.siteUrl = draft.siteUrl.trim(); draft.name = draft.name.trim(); draft.placeholder = draft.placeholder.trim(); draft.emptyMessage = draft.emptyMessage.trim(); draft.smojiManifestUrl = draft.smojiManifestUrl.trim(); draft.bloggerNickname = draft.bloggerNickname.trim(); draft.bloggerEmail = draft.bloggerEmail.trim(); draft.bloggerBadge = draft.bloggerBadge.trim(); draft.bloggerPassphrase = (draft.bloggerPassphrase || '').trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(draft.id)) errors.id = '站点 ID 格式无效'
  try { const url = new URL(draft.siteUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error() } catch { errors.siteUrl = '站点 URL 格式无效' }
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
      const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
      if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw new Error()
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
  } else if (draft.bloggerPassphrase && ([...draft.bloggerPassphrase].length < 12 || [...draft.bloggerPassphrase].length > 80 || /[\r\n]/.test(draft.bloggerPassphrase))) {
    errors.bloggerPassphrase = '博主口令需为 12 至 80 个字符'
  }
  if ([...draft.bloggerBadge].length > 16 || /[\r\n]/.test(draft.bloggerBadge)) {
    errors.bloggerBadge = '评论区标志不能超过 16 个字符'
  }
  draft.allowedOrigins = [...new Set(origins)]
  return Object.keys(errors).length === 0
}
async function submit() { if (!validate()) return; const saved = await store.saveSite({ ...draft, allowedOrigins: [...draft.allowedOrigins] }, creating.value); if (saved) applySite(saved) }
</script>

<template>
  <section class="page-layout" aria-labelledby="sites-title"><div class="page-column">
    <header class="page-heading"><h1 id="sites-title">站点管理</h1><button class="button button-primary" type="button" :disabled="siteBusy" @click="startCreating">新增站点</button></header>
    <p v-if="siteMessage" class="inline-error page-message" role="alert">{{ siteMessage }}</p>
    <div class="sites-grid">
      <section class="site-list-panel" aria-label="站点列表"><div class="panel-heading"><h2>已注册站点</h2><span class="queue-time">{{ sites.length }} 条</span></div><div v-if="sites.length" class="site-list"><button v-for="site in sites" :key="site.id" class="site-list-item" type="button" :aria-selected="!creating && selectedSiteId === site.id" @click="chooseSite(site)"><strong>{{ displayName(site) }}</strong><small>{{ site.id }} · {{ site.siteUrl }}</small></button></div><p v-else class="queue-empty">当前实例还没有站点</p></section>
      <section class="site-form-panel" aria-labelledby="site-form-title"><div class="form-title"><h2 id="site-form-title">{{ creating ? '新增站点' : '编辑站点' }}</h2></div>
        <form class="site-form" novalidate @submit.prevent="submit">
          <div class="form-row"><label class="form-label" for="site-id">站点 ID</label><div class="field-stack"><input id="site-id" v-model="draft.id" class="input" maxlength="100" :readonly="!creating" :aria-invalid="Boolean(errors.id)"><p v-if="errors.id" class="field-error">{{ errors.id }}</p></div></div>
          <div class="form-row"><label class="form-label" for="site-url">站点 URL</label><div class="field-stack"><input id="site-url" v-model="draft.siteUrl" class="input" type="url" maxlength="2048" :aria-invalid="Boolean(errors.siteUrl)"><p v-if="errors.siteUrl" class="field-error">{{ errors.siteUrl }}</p></div></div>
          <div class="form-row"><label class="form-label" for="site-name">站点名称</label><div class="field-stack"><input id="site-name" v-model="draft.name" class="input" maxlength="120" :aria-invalid="Boolean(errors.name)"><p class="field-help">留空时使用站点 URL 的域名</p><p v-if="errors.name" class="field-error">{{ errors.name }}</p></div></div>
          <div class="form-row"><label class="form-label" for="site-origins">允许来源</label><div class="field-stack"><textarea id="site-origins" v-model="originsText" class="textarea" :aria-invalid="Boolean(errors.origins)" /><p class="field-help">每行一个完整来源</p><p v-if="errors.origins" class="field-error">{{ errors.origins }}</p></div></div>
          <div class="form-row"><span class="form-label">评论排序</span><div class="radio-row"><label class="radio-label"><input v-model="draft.defaultSort" type="radio" value="newest">最新评论</label><label class="radio-label"><input v-model="draft.defaultSort" type="radio" value="oldest">最早评论</label></div></div>
          <div class="form-row"><span class="form-label">字段要求</span><div class="check-row"><label class="check-label"><input v-model="draft.emailRequired" type="checkbox">邮箱必填</label><label class="check-label"><input v-model="draft.websiteRequired" type="checkbox">网站必填</label></div></div>
          <div class="form-row"><label class="form-label" for="site-placeholder">评论占位文案</label><div class="field-stack"><input id="site-placeholder" v-model="draft.placeholder" class="input" maxlength="80" :aria-invalid="Boolean(errors.placeholder)"><p v-if="errors.placeholder" class="field-error">{{ errors.placeholder }}</p></div></div>
          <div class="form-row"><label class="form-label" for="site-limit">评论长度上限</label><div class="field-stack"><input id="site-limit" v-model.number="draft.commentLimit" class="input" type="number" min="1" max="10000" :aria-invalid="Boolean(errors.commentLimit)"><p class="field-help">中文、日文、韩文与其他 Unicode 字符均按一个字符计数</p><p v-if="errors.commentLimit" class="field-error">{{ errors.commentLimit }}</p></div></div>
          <div class="form-row"><label class="form-label" for="site-empty">无评论文案</label><div class="field-stack"><textarea id="site-empty" v-model="draft.emptyMessage" class="textarea" maxlength="240" :aria-invalid="Boolean(errors.emptyMessage)" /><p v-if="errors.emptyMessage" class="field-error">{{ errors.emptyMessage }}</p></div></div>
          <section class="site-subsection" aria-labelledby="smoji-settings-title">
            <div class="site-subsection-heading"><h3 id="smoji-settings-title">表情包</h3><p>启用后，评论区会在访客首次打开表情选择框时动态加载清单。表情图片由清单所在站点直接提供，可能向该站点暴露访客 IP 等请求信息。</p></div>
            <div class="form-row"><span class="form-label">功能状态</span><div class="check-row"><label class="check-label"><input id="smoji-enabled" v-model="draft.smojiEnabled" type="checkbox">启用表情包</label></div></div>
            <div class="form-row"><label class="form-label" for="smoji-manifest-url">Smoji 表情包 URL</label><div class="field-stack"><input id="smoji-manifest-url" v-model="draft.smojiManifestUrl" class="input" type="url" maxlength="2048" placeholder="https://static.example.com/smoji.json" :aria-invalid="Boolean(errors.smojiManifestUrl)"><p class="field-help">只加载一个 Smoji JSON 清单；图片须与清单同源。关闭功能时可保留此地址。</p><p v-if="errors.smojiManifestUrl" class="field-error">{{ errors.smojiManifestUrl }}</p></div></div>
          </section>
          <section class="site-subsection" aria-labelledby="blogger-identity-title">
            <div class="site-subsection-heading"><h3 id="blogger-identity-title">博主身份</h3><p>公开评论只显示下方昵称、可选标志，以及指向站点 URL 的链接。邮箱只用于通知去重和历史评论回填。评论区昵称栏填写口令即可发表为博主。</p></div>
            <div class="form-row"><label class="form-label" for="blogger-nickname">博主昵称</label><div class="field-stack"><input id="blogger-nickname" v-model="draft.bloggerNickname" class="input" maxlength="80" :aria-invalid="Boolean(errors.bloggerNickname || errors.bloggerIdentity)"><p class="field-help">评论区公开显示，并通过站点 URL 链接</p><p v-if="errors.bloggerNickname" class="field-error">{{ errors.bloggerNickname }}</p></div></div>
            <div class="form-row"><label class="form-label" for="blogger-email">博主邮箱</label><div class="field-stack"><input id="blogger-email" v-model="draft.bloggerEmail" class="input" type="email" maxlength="254" :aria-invalid="Boolean(errors.bloggerEmail || errors.bloggerIdentity)"><p class="field-help">仅用于通知去重与历史评论回填，不会公开</p><p v-if="errors.bloggerEmail" class="field-error">{{ errors.bloggerEmail }}</p><p v-if="errors.bloggerIdentity" class="field-error">{{ errors.bloggerIdentity }}</p></div></div>
            <div class="form-row"><label class="form-label" for="blogger-passphrase">博主口令</label><div class="field-stack"><input id="blogger-passphrase" v-model="draft.bloggerPassphrase" class="input" type="password" maxlength="80" autocomplete="new-password" :placeholder="draft.bloggerPassphraseSet ? '已设置，输入新值以更换' : ''" :aria-invalid="Boolean(errors.bloggerPassphrase)"><p class="field-help">12–80 个字符。评论区昵称栏填写此口令即可发表为博主；口令不会回显。已设置时留空表示不更改。</p><p v-if="errors.bloggerPassphrase" class="field-error">{{ errors.bloggerPassphrase }}</p></div></div>
            <div class="form-row"><label class="form-label" for="blogger-badge">评论区标志</label><div class="field-stack"><input id="blogger-badge" v-model="draft.bloggerBadge" class="input" maxlength="16" :aria-invalid="Boolean(errors.bloggerBadge)"><p class="field-help">显示在博主评论昵称之后，例如 [博主] 或 [OP]。留空则不显示。</p><p v-if="errors.bloggerBadge" class="field-error">{{ errors.bloggerBadge }}</p></div></div>
          </section>
          <div class="form-actions"><button v-if="creating" class="button" type="button" @click="cancelCreating">取消</button><button class="button button-primary" type="submit" :disabled="siteBusy || (!creating && !selectedSite)">{{ siteBusy ? '保存中…' : creating ? '创建站点' : '保存站点' }}</button></div>
        </form>
      </section>
    </div>
  </div></section>
</template>
