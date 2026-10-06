import './demo.css'
import Ecoku, { type EcokuTheme } from './ecoku'

const app = document.querySelector<HTMLElement>('#app')
if (!app) throw new Error('Missing #app container')

const parameters = new URLSearchParams(window.location.search)
// The demo trusts its local API, never a server selected by a shared URL.
const serverURL = 'http://127.0.0.1:12123/'
const siteId = parameters.get('siteId') || 'p3-auto'
const pageKey = parameters.get('pageKey') || 'browser-demo'
const requestedTheme = parameters.get('theme')
const theme: EcokuTheme = requestedTheme === 'light' || requestedTheme === 'dark' ? requestedTheme : 'auto'

const page = document.createElement('main')
page.className = 'demo-page'
const context = document.createElement('header')
context.className = 'demo-context'
const kicker = document.createElement('p')
kicker.className = 'demo-kicker'
kicker.textContent = 'Ecoku 本地验收页面'
const title = document.createElement('h1')
title.textContent = '纯文本线程评论'
const description = document.createElement('p')
description.className = 'demo-description'
description.textContent = `站点 ${siteId} · 页面 ${pageKey}`
context.append(kicker, title, description)
const comments = document.createElement('div')
comments.id = 'comments'
const startupError = document.createElement('p')
startupError.className = 'demo-error'
startupError.setAttribute('role', 'alert')
startupError.hidden = true
page.append(context, startupError, comments)
app.replaceChildren(page)

const client = new Ecoku({
  container: comments,
  serverURL,
  siteId,
  pageKey,
  pageSize: 3,
  theme,
})

client.init().catch(() => {
  startupError.textContent = '评论组件初始化失败，请检查本地验收参数。'
  startupError.hidden = false
})
