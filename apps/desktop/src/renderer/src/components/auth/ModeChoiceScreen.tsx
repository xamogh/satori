import { Cloud, HardDrive } from 'lucide-react'
import { Alert, AlertDescription } from '../ui/alert'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'

export type ModeChoiceScreenProps = {
  readonly appName: string
  readonly error: string | null
  readonly loadingMode: 'sync' | 'local' | null
  readonly onSelectSync: () => void
  readonly onSelectLocal: () => void
}

export const ModeChoiceScreen = ({
  appName,
  error,
  loadingMode,
  onSelectSync,
  onSelectLocal
}: ModeChoiceScreenProps): React.JSX.Element => (
  <div className="relative flex min-h-screen items-center justify-center p-6">
    <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/20" />
    <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
    <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />

    <Card className="relative z-10 w-full max-w-2xl shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">{appName}</CardTitle>
        <CardDescription>Choose how you want to run the app on this device.</CardDescription>
      </CardHeader>

      <CardContent className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          onClick={onSelectSync}
          disabled={loadingMode !== null}
          className="group rounded-xl border bg-background p-5 text-left transition hover:border-primary/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Cloud className="h-5 w-5" />
            <h3 className="text-base font-semibold">Sync with Server</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Sign in with your server account and keep your data synced across devices.
          </p>
          <Button className="mt-4 w-full" disabled={loadingMode !== null}>
            {loadingMode === 'sync' ? 'Setting up...' : 'Use Sync Mode'}
          </Button>
        </button>

        <button
          type="button"
          onClick={onSelectLocal}
          disabled={loadingMode !== null}
          className="group rounded-xl border bg-background p-5 text-left transition hover:border-primary/50 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <div className="mb-3 flex items-center gap-2 text-primary">
            <HardDrive className="h-5 w-5" />
            <h3 className="text-base font-semibold">Run Local-Only</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Keep everything on this device and work without depending on the server.
          </p>
          <Button className="mt-4 w-full" disabled={loadingMode !== null}>
            {loadingMode === 'local' ? 'Setting up...' : 'Use Local Mode'}
          </Button>
        </button>

        {error ? (
          <Alert variant="destructive" className="md:col-span-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  </div>
)
