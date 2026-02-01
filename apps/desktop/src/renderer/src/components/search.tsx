import * as React from 'react'
import { Search as SearchIcon } from 'lucide-react'
import { Input } from './ui/input'

export type SearchProps = {
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly placeholder?: string
}

export const Search = ({
  value,
  onValueChange,
  placeholder = 'Search...'
}: SearchProps): React.JSX.Element => (
  <div className="relative w-full max-w-md">
    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
    <Input
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      placeholder={placeholder}
      className="h-9 pl-8"
    />
  </div>
)
