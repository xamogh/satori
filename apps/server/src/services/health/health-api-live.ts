import { HttpApiBuilder } from '@effect/platform'
import { Effect } from 'effect'
import { Api } from '@satori/api-contract/api/api-definition'

export const HealthApiLive = HttpApiBuilder.group(Api, 'health', (handlers) =>
  Effect.succeed(handlers.handle('health', () => Effect.succeed({ ok: true })))
)
