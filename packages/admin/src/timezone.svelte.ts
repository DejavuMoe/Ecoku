// Admin timestamps use the instance display time zone (the container `TZ`), the same zone as
// the public comments and notifications. The server sends it with the login configuration.
export const DEFAULT_ADMIN_TIME_ZONE = 'Asia/Shanghai'

export const adminTimeZone = $state<{ value: string }>({ value: DEFAULT_ADMIN_TIME_ZONE })

export function resolveAdminTimeZone(value: unknown): string {
  const timeZone = typeof value === 'string' ? value.trim() : ''
  if (!timeZone) return DEFAULT_ADMIN_TIME_ZONE
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return DEFAULT_ADMIN_TIME_ZONE
  }
}

export function setAdminTimeZone(value: unknown): void {
  adminTimeZone.value = resolveAdminTimeZone(value)
}
