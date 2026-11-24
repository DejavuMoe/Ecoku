// Map the docs locale to the comment area's interface language.
export function commentLanguage(lang: string): 'zh-CN' | 'zh-Hant' | 'en' {
  if (lang.toLowerCase().startsWith('en')) return 'en'
  if (lang === 'zh-Hant') return 'zh-Hant'
  return 'zh-CN'
}
