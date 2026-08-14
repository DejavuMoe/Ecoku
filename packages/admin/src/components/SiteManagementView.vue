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
const defaults = (): SiteWrite => ({ id: '', siteUrl: '', name: '', allowedOrigins: [], defaultSort: 'newest', emailRequired: true, websiteRequired: false, placeholder: '写下评论（仅支持纯文本）', commentLimit: 1000, emptyMessage: '还没有评论\n成为第一个留下评论的人。', revision: 0 })
const draft = reactive<SiteWrite>(defaults())
const clearErrors = () => Object.keys(errors).forEach((key) => delete errors[key])
function applySite(site: SiteSummary | null) { if (!site) return; creating.value = false; Object.assign(draft, { ...site, allowedOrigins: [...site.allowedOrigins] }); originsText.value = site.allowedOrigins.join('\n'); clearErrors() }
watch(selectedSite, (site) => { if (!creating.value) applySite(site) }, { immediate: true })
function startCreating() { creating.value = true; Object.assign(draft, defaults()); originsText.value = ''; clearErrors() }
function cancelCreating() { applySite(selectedSite.value ?? sites.value[0] ?? null) }
async function chooseSite(site: SiteSummary) { creating.value = false; await store.selectSite(site.id); applySite(site) }
function displayName(site: SiteSummary) { if (site.name) return site.name; try { return new URL(site.siteUrl).hostname } catch { return site.siteUrl } }
function validate() {
  clearErrors(); draft.id = draft.id.trim(); draft.siteUrl = draft.siteUrl.trim(); draft.name = draft.name.trim(); draft.placeholder = draft.placeholder.trim(); draft.emptyMessage = draft.emptyMessage.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(draft.id)) errors.id = '站点 ID 格式无效'
  try { const url = new URL(draft.siteUrl); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error() } catch { errors.siteUrl = '站点 URL 格式无效' }
  if ([...draft.name].length > 120 || /[\r\n]/.test(draft.name)) errors.name = '站点名称不能超过 120 个字符'
  const origins = originsText.value.split(/[\r\n,]+/).map((value) => value.trim().replace(/\/$/, '')).filter(Boolean)
  if (!origins.length || origins.length > 32) errors.origins = '请填写 1 至 32 个允许来源'
  for (const origin of origins) { try { const url = new URL(origin); if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) throw new Error() } catch { errors.origins = '允许来源格式无效' } }
  if (!draft.placeholder || [...draft.placeholder].length > 80 || /[\r\n]/.test(draft.placeholder)) errors.placeholder = '评论占位文案需为 1 至 80 个字符'
  if (!Number.isInteger(draft.commentLimit) || draft.commentLimit < 1 || draft.commentLimit > 10000) errors.commentLimit = '评论长度上限需为 1 至 10000'
  if (!draft.emptyMessage || [...draft.emptyMessage].length > 240) errors.emptyMessage = '无评论文案需为 1 至 240 个字符'
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
          <div class="form-actions"><button v-if="creating" class="button" type="button" @click="cancelCreating">取消</button><button class="button button-primary" type="submit" :disabled="siteBusy || (!creating && !selectedSite)">{{ siteBusy ? '保存中…' : creating ? '创建站点' : '保存站点' }}</button></div>
        </form>
      </section>
    </div>
  </div></section>
</template>
