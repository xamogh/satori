import type { SchemaIssue } from '@satori/ipc-contract/ipc/contract'
import { KeyRound } from 'lucide-react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SchemaIssueList } from '../SchemaIssueList'
import { Alert, AlertDescription } from '../ui/alert'

export type AuthScreenProps = {
  readonly appName: string
  readonly mode: 'unauthenticated' | 'locked'
  readonly email: string
  readonly password: string
  readonly issues: ReadonlyArray<SchemaIssue>
  readonly error: string | null
  readonly onEmailChange: (email: string) => void
  readonly onPasswordChange: (password: string) => void
  readonly onSubmit: () => void
}

export const AuthScreen = ({
  appName,
  mode,
  email,
  password,
  issues,
  error,
  onEmailChange,
  onPasswordChange,
  onSubmit
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
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="you@example.com"
            type="email"
            autoComplete="email"
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Enter your password"
            type="password"
            autoComplete="current-password"
          />
        </div>

        <SchemaIssueList issues={issues} />
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button onClick={onSubmit} className="w-full">
          Sign in
        </Button>
      </CardContent>
    </Card>
  </div>
)
