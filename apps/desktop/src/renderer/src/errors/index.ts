import { Schema } from "effect"
import { IpcErrorSchema } from "@satori/ipc-contract/ipc/contract"

export class ApiError extends Schema.TaggedError<ApiError>("ApiError")(
  "ApiError",
  {
    message: Schema.String,
    statusCode: Schema.Number,
    cause: Schema.Unknown,
  }
) {}

export class ValidationError extends Schema.TaggedError<ValidationError>(
  "ValidationError"
)("ValidationError", {
  message: Schema.String,
  field: Schema.String,
  cause: Schema.Unknown,
}) {}

export class IpcCommunicationError extends Schema.TaggedError<IpcCommunicationError>(
  "IpcCommunicationError"
)("IpcCommunicationError", {
  message: Schema.String,
  channel: Schema.String,
  cause: Schema.Unknown,
}) {}

export class IpcRemoteError extends Schema.TaggedError<IpcRemoteError>(
  "IpcRemoteError"
)("IpcRemoteError", {
  message: Schema.String,
  error: IpcErrorSchema,
}) {}
