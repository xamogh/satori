import { HttpApiEndpoint, HttpApiGroup } from "@effect/platform"
import { AuthSignInRequestSchema } from "@satori/domain/auth/schemas"
import { BadRequest, InternalServerError, Unauthorized } from "../http-errors"
import { AuthSessionSchema } from "./auth-model"

export const authApiGroup = HttpApiGroup.make("auth").add(
  HttpApiEndpoint.post("signIn", "/auth/sign-in")
    .setPayload(AuthSignInRequestSchema)
    .addSuccess(AuthSessionSchema)
    .addError(Unauthorized)
    .addError(BadRequest)
    .addError(InternalServerError)
)
