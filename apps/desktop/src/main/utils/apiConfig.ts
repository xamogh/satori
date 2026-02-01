import { Effect } from 'effect'
import { ApiConfigError } from '../errors'
import { API_BASE_URL_ENV } from '../constants/api'

export type ApiConfig = {
  readonly baseUrl: string
}

export const getApiConfig = (): Effect.Effect<ApiConfig, ApiConfigError> =>
  Effect.suspend(() => {
    const baseUrlRaw = process.env[API_BASE_URL_ENV]

    if (typeof baseUrlRaw !== 'string' || baseUrlRaw.length === 0) {
      return Effect.fail(
        new ApiConfigError({
          message: `Missing ${API_BASE_URL_ENV}`,
          cause: 'Missing API configuration'
        })
      )
    }

    const baseUrl = baseUrlRaw.endsWith('/') ? baseUrlRaw.slice(0, -1) : baseUrlRaw

    return Effect.succeed({ baseUrl })
  })
