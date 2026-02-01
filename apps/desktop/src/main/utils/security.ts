import { is } from '@electron-toolkit/utils'
import { ALLOWED_EXTERNAL_PROTOCOLS, APP_PROTOCOL_ORIGIN } from '../constants/security'

const parseUrl = (raw: string): URL | null => {
  try {
    return new URL(raw)
  } catch {
    return null
  }
}

export const getAllowedRendererOrigins = (): ReadonlyArray<string> => {
  const appOrigin = APP_PROTOCOL_ORIGIN

  if (!is.dev) {
    return [appOrigin]
  }

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  const devOrigin = devUrl ? (parseUrl(devUrl)?.origin ?? null) : null
  return devOrigin ? [devOrigin, appOrigin] : [appOrigin]
}

export const isAllowedRendererUrl = (raw: string): boolean => {
  const origin = parseUrl(raw)?.origin ?? null
  if (origin === null) {
    return false
  }

  return getAllowedRendererOrigins().includes(origin)
}

export const isSafeOpenExternalUrl = (raw: string): boolean => {
  const url = parseUrl(raw)
  if (url === null) {
    return false
  }

  return (ALLOWED_EXTERNAL_PROTOCOLS as readonly string[]).includes(url.protocol)
}
