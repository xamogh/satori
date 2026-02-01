import { Schema } from 'effect'

export class InvalidCredentialsError extends Schema.TaggedError<InvalidCredentialsError>(
  'InvalidCredentialsError'
)('InvalidCredentialsError', { message: Schema.String }) {}
