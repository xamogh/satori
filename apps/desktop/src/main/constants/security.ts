export const APP_PROTOCOL_SCHEME = 'app'
export const APP_PROTOCOL_HOST = 'bundle'
export const APP_PROTOCOL_ORIGIN = `${APP_PROTOCOL_SCHEME}://${APP_PROTOCOL_HOST}`
export const APP_PROTOCOL_ROOT_URL = `${APP_PROTOCOL_ORIGIN}/`

export const ALLOWED_EXTERNAL_PROTOCOLS = ['https:', 'mailto:'] as const
