export type FormFieldErrorProps = {
  readonly errors?: ReadonlyArray<unknown>
}

export const FormFieldError = ({ errors }: FormFieldErrorProps): React.JSX.Element | null => {
  const message = errors?.[0]
  if (!message) {
    return null
  }

  return <p className="text-sm text-destructive">{String(message)}</p>
}
