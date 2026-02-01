import { KeyRound } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Alert, AlertDescription } from '../ui/alert'
import { FormFieldError } from '../forms/FormFieldError'
import type { FormApiFor } from '../../utils/formTypes'

export type AuthFormValues = {
  readonly email: string
  readonly password: string
}

export type AuthScreenProps = {
  readonly appName: string
  readonly mode: 'unauthenticated' | 'locked'
  readonly form: FormApiFor<AuthFormValues>
  readonly error: string | null
}

export const AuthScreen = ({
  appName,
  mode,
  form,
  error,
}: AuthScreenProps): React.JSX.Element => (
  <div className="relative flex min-h-screen items-center justify-center p-6">
    {/* Gradient background */}
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/20" />
    <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
    <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

    <Card className="relative z-10 w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <KeyRound className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">{appName}</CardTitle>
        <CardDescription>
          {mode === 'locked'
            ? 'Session expired. Please sign in again.'
            : 'Sign in to continue to your account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void form.handleSubmit()
          }}
          className="grid gap-4"
        >
          <form.Field name="email">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Email</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
                <FormFieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          <form.Field name="password">
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={field.name}>Password</Label>
                <Input
                  id={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Enter your password"
                  type="password"
                  autoComplete="current-password"
                />
                <FormFieldError errors={field.state.meta.errors} />
              </div>
            )}
          </form.Field>

          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form.Subscribe
            selector={(state) => ({
              canSubmit: state.canSubmit,
              isSubmitting: state.isSubmitting
            })}
          >
            {({ canSubmit, isSubmitting }) => (
              <Button type="submit" disabled={!canSubmit} className="w-full">
                {isSubmitting ? 'Signing in...' : 'Sign in'}
              </Button>
            )}
          </form.Subscribe>
        </form>
      </CardContent>
    </Card>
  </div>
)
