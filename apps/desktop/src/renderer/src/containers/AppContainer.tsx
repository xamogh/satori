import { useCallback, useState, useSyncExternalStore } from 'react'
import { useForm } from '@tanstack/react-form'
import { Either } from 'effect'
import {
  AuthSignInRequestSchema,
  LocalAuthCredentialsSchema,
  type AuthMode,
  type SchemaIssue
} from '@satori/ipc-contract/ipc/contract'
import { AuthScreen, type AuthFormValues } from '../components/auth/AuthScreen'
import {
  LocalOnboardingScreen,
  type LocalOnboardingFormValues
} from '../components/auth/LocalOnboardingScreen'
import { ModeChoiceScreen } from '../components/auth/ModeChoiceScreen'
import { DashboardContainer } from './DashboardContainer'
import { AppModeStore } from '../services/AppModeStore'
import { AuthStore } from '../services/AuthStore'
import { createSchemaFormValidator } from '../utils/formValidation'

const appName = 'Satori Desktop'

const signInDefaults: AuthFormValues = {
  email: '',
  password: ''
}

const localOnboardingDefaults: LocalOnboardingFormValues = {
  username: '',
  password: '',
  confirmPassword: ''
}

export const AppContainer = (): React.JSX.Element => {
  const modeState = useSyncExternalStore(
    AppModeStore.subscribe,
    AppModeStore.getSnapshot,
    AppModeStore.getSnapshot
  )

  const authState = useSyncExternalStore(
    AuthStore.subscribe,
    AuthStore.getSnapshot,
    AuthStore.getSnapshot
  )

  const [error, setError] = useState<string | null>(null)
  const [loadingMode, setLoadingMode] = useState<AuthMode | null>(null)

  const syncSignInForm = useForm({
    defaultValues: signInDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(AuthSignInRequestSchema, (values: AuthFormValues) =>
        Either.right(values)
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

  const localSignInForm = useForm({
    defaultValues: signInDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(
        LocalAuthCredentialsSchema,
        (values: AuthFormValues) =>
          Either.right({
            username: values.email,
            password: values.password
          }),
        {
          fieldNameMap: {
            username: 'email'
          }
        }
      )
    },
    onSubmit: ({ value, formApi }) => {
      setError(null)
      return AuthStore.localSignIn({ username: value.email, password: value.password }).then(
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

  const localOnboardingForm = useForm({
    defaultValues: localOnboardingDefaults,
    validators: {
      onSubmit: createSchemaFormValidator(
        LocalAuthCredentialsSchema,
        (values: LocalOnboardingFormValues) => {
          if (values.password !== values.confirmPassword) {
            const issue: SchemaIssue = {
              path: ['confirmPassword'],
              message: 'Passwords must match.'
            }

            return Either.left([issue] as const)
          }

          return Either.right({
            username: values.username,
            password: values.password
          })
        }
      )
    },
    onSubmit: ({ value, formApi }) => {
      setError(null)

      return AppModeStore.localOnboard({
        username: value.username,
        password: value.password
      }).then(
        (result) => {
          if (result._tag === 'Ok') {
            formApi.reset(localOnboardingDefaults)
            return AuthStore.refresh().then(() => undefined)
          }

          setError(result.error.message)
          return undefined
        },
        (reason) => {
          setError(String(reason))
          return undefined
        }
      )
    }
  })

  const selectMode = useCallback((mode: AuthMode): void => {
    setError(null)
    setLoadingMode(mode)

    AppModeStore.selectMode(mode).then(
      (result) => {
        setLoadingMode(null)

        if (result._tag === 'Err') {
          setError(result.error.message)
          return
        }

        void AuthStore.refresh()
      },
      (reason) => {
        setLoadingMode(null)
        setError(String(reason))
      }
    )
  }, [])

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

  if (modeState._tag === 'Loading' || authState._tag === 'Loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    )
  }

  if (modeState._tag === 'Unconfigured') {
    return (
      <ModeChoiceScreen
        appName={appName}
        error={error}
        loadingMode={loadingMode}
        onSelectSync={() => selectMode('sync')}
        onSelectLocal={() => selectMode('local')}
      />
    )
  }

  if (modeState._tag === 'ConfiguredLocal' && !modeState.localAccountExists) {
    return <LocalOnboardingScreen appName={appName} error={error} form={localOnboardingForm} />
  }

  if (authState._tag !== 'Authenticated') {
    if (modeState._tag === 'ConfiguredLocal') {
      return (
        <AuthScreen
          appName={appName}
          mode={authState._tag === 'Locked' ? 'locked' : 'unauthenticated'}
          form={localSignInForm}
          error={error}
          identityLabel="Username"
          identityPlaceholder="Enter your username"
          identityInputType="text"
          identityAutoComplete="username"
          unauthenticatedDescription="Sign in with your local account to continue."
          lockedDescription="Session expired. Please sign in again."
          submitLabel="Sign in locally"
          submittingLabel="Signing in..."
        />
      )
    }

    return (
      <AuthScreen
        appName={appName}
        mode={authState._tag === 'Locked' ? 'locked' : 'unauthenticated'}
        form={syncSignInForm}
        error={error}
      />
    )
  }

  return (
    <DashboardContainer
      auth={authState}
      onSignOut={signOut}
      appError={error}
      syncEnabled={modeState._tag === 'ConfiguredSync'}
    />
  )
}
