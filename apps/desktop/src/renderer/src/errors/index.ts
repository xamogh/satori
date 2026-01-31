import { Schema } from "effect"
import { ErrorCauseSchema } from "@satori/shared/utils/errorCause"
import { IpcErrorSchema } from "@satori/shared/ipc/contract"

export class ApiError extends Schema.TaggedError<ApiError>("ApiError")(
  "ApiError",
  {
    message: Schema.String,
    statusCode: Schema.Number,
    cause: ErrorCauseSchema,
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>(
  "ValidationError"
)("ValidationError", {
  message: Schema.String,
  field: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class IpcCommunicationError extends Schema.TaggedError<IpcCommunicationError>(
  "IpcCommunicationError"
)("IpcCommunicationError", {
  message: Schema.String,
  channel: Schema.String,
  cause: ErrorCauseSchema,
}) {}

export class IpcRemoteError extends Schema.TaggedError<IpcRemoteError>(
  "IpcRemoteError"
)("IpcRemoteError", {
  message: Schema.String,
  error: IpcErrorSchema,
}) {}
