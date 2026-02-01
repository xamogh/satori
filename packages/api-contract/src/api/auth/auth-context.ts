import { Context } from 'effect'
import type { UserRole } from '@satori/domain/auth/schemas'

export type AuthPrincipal = {
  readonly userId: string
  readonly email: string
  readonly role: UserRole
}

export class AuthContext extends Context.Tag('satori/auth/AuthContext')<
  AuthContext,
  AuthPrincipal
>() {}
