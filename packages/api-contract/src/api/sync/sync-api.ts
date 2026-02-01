import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { SyncRequestSchema, SyncResponseSchema } from '@satori/domain/sync/schemas'
import { BadRequest, InternalServerError, Unauthorized } from '../http-errors'

export const syncApiGroup = HttpApiGroup.make('sync').add(
  HttpApiEndpoint.post('sync', '/sync')
    .setPayload(SyncRequestSchema)
    .addSuccess(SyncResponseSchema)
    .addError(Unauthorized)
    .addError(BadRequest)
    .addError(InternalServerError)
)
