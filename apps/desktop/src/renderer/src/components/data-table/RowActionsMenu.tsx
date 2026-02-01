import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

export type RowAction = {
  readonly id: string
  readonly label: string
  readonly onSelect: () => void
  readonly destructive?: boolean
}

export type RowActionsMenuProps = {
  readonly label?: string
  readonly actions: ReadonlyArray<RowAction>
  readonly className?: string
}

export const RowActionsMenu = ({
  label = "Open menu",
  actions,
  className,
}: RowActionsMenuProps): React.JSX.Element => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8 p-0 data-[state=open]:bg-muted", className)}
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">{label}</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-[160px]">
      {(() => {
        const firstDestructiveIndex = actions.findIndex((action) => action.destructive === true)
        const shouldInsertSeparator = firstDestructiveIndex > 0

        return actions.flatMap((action, index) => {
          const items: ReadonlyArray<React.ReactNode> =
            shouldInsertSeparator && index === firstDestructiveIndex
              ? [<DropdownMenuSeparator key="separator" />]
              : []

          return [
            ...items,
            <DropdownMenuItem
              key={action.id}
              onSelect={action.onSelect}
              className={
                action.destructive ? "text-destructive focus:text-destructive" : undefined
              }
            >
              {action.label}
            </DropdownMenuItem>,
          ]
        })
      })()}
    </DropdownMenuContent>
  </DropdownMenu>
)
