import { Schema } from "effect"
import { ErrorCauseSchema } from "@satori/shared/utils/errorCause"

export class WindowCreationError extends Schema.TaggedError<WindowCreationError>(
  "WindowCreationError"
)("WindowCreationError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class IpcError extends Schema.TaggedError<IpcError>("IpcError")(
  "IpcError",
  {
    message: Schema.String,
    channel: Schema.String,
    cause: ErrorCauseSchema,
  }
) {}

export class FileLoadError extends Schema.TaggedError<FileLoadError>(
  "FileLoadError"
)("FileLoadError", {
  message: Schema.String,
  path: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class ApiConfigError extends Schema.TaggedError<ApiConfigError>(
  "ApiConfigError"
)("ApiConfigError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class ApiAuthError extends Schema.TaggedError<ApiAuthError>("ApiAuthError")(
  "ApiAuthError",
  {
  message: Schema.String,
  statusCode: Schema.Number,
  cause: ErrorCauseSchema,
  }
) {}

export class AuthStorageError extends Schema.TaggedError<AuthStorageError>(
  "AuthStorageError"
)("AuthStorageError", {
  message: Schema.String,
  path: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>(
  "UnauthorizedError"
)("UnauthorizedError", {
  message: Schema.String,
}) {}

export class LockedError extends Schema.TaggedError<LockedError>("LockedError")(
  "LockedError",
  {
    message: Schema.String,
  }
) {}

export class LocalDbOpenError extends Schema.TaggedError<LocalDbOpenError>(
  "LocalDbOpenError"
)("LocalDbOpenError", {
  message: Schema.String,
  path: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class LocalDbMigrationError extends Schema.TaggedError<LocalDbMigrationError>(
  "LocalDbMigrationError"
)("LocalDbMigrationError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class LocalDbQueryError extends Schema.TaggedError<LocalDbQueryError>(
  "LocalDbQueryError"
)("LocalDbQueryError", {
  message: Schema.String,
  query: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class EntityNotFoundError extends Schema.TaggedError<EntityNotFoundError>(
  "EntityNotFoundError"
)("EntityNotFoundError", {
  message: Schema.String,
  entity: Schema.String,
  id: Schema.String,
}) {}

export class OutboxEncodeError extends Schema.TaggedError<OutboxEncodeError>(
  "OutboxEncodeError"
)("OutboxEncodeError", {
  message: Schema.String,
  cause: ErrorCauseSchema,
}) {}
