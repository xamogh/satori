import { useCallback, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import { AuthScreen } from '../components/auth/AuthScreen'
import { DashboardContainer } from './DashboardContainer'
import { AuthSignInRequestSchema } from '@satori/ipc-contract/ipc/contract'
import { AuthStore } from '../services/AuthStore'
import type { AuthFormValues } from '../components/auth/AuthScreen'
import { createSchemaFormValidator } from '../utils/formValidation'

export const AppContainer = (): React.JSX.Element => {
  const authState = useSyncExternalStore(
    AuthStore.subscribe,
    AuthStore.getSnapshot,
    AuthStore.getSnapshot
  )
  const [error, setError] = useState<string | null>(null)

  const signInDefaults: AuthFormValues = {
    email: '',
    password: ''
  }

  const signInForm = useForm({
    defaultValues: signInDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(
        AuthSignInRequestSchema,
        (values: AuthFormValues) => Either.right(values)
      )
    },
    onSubmit: ({ value, formApi }) => {
      setError(null)
      return AuthStore.signIn(value).then(
        (result) => {
          if (result._tag === 'Ok') {
            formApi.setFieldValue('password', '')
            return
          }

          setError(result.error.message)
        },
        (reason) => setError(String(reason))
      )
    }
  })

  const signOut = useCallback((): void => {
    setError(null)
    AuthStore.signOut().then(
      (result) => {
        if (result._tag === 'Ok') return
        setError(result.error.message)
      },
      (reason) => setError(String(reason))
    )
  }, [])

  if (authState._tag === 'Loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (authState._tag !== 'Authenticated') {
    return (
      <AuthScreen
        appName="Satori Desktop"
        mode={authState._tag === 'Locked' ? 'locked' : 'unauthenticated'}
        form={signInForm}
        error={error}
      />
    )
  }

  return <DashboardContainer auth={authState} onSignOut={signOut} appError={error} />
}
