import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'

export const HealthResponseSchema = Schema.Struct({
  ok: Schema.Boolean
})

export type HealthResponse = Schema.Schema.Type<typeof HealthResponseSchema>

export const healthApiGroup = HttpApiGroup.make('health').add(
  HttpApiEndpoint.get('health', '/health').addSuccess(HealthResponseSchema)
)
