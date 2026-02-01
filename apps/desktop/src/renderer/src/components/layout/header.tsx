import * as React from "react"
import { cn } from "../../lib/utils"
import { Separator } from "../ui/separator"
import { SidebarTrigger } from "../ui/sidebar"
import { Search } from "../search"
import { ThemeSwitch } from "../theme-switch"

export type HeaderProps = {
  readonly searchValue: string
  readonly onSearchValueChange: (value: string) => void
}

export const Header = ({
  searchValue,
  onSearchValueChange,
}: HeaderProps): React.JSX.Element => {
  const [scrolled, setScrolled] = React.useState(false)

  React.useEffect(() => {
    const handleScroll = (): void => {
      setScrolled(window.scrollY > 0)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    <header
      className={cn(
        "sticky top-0 z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur transition-shadow",
        scrolled && "shadow-sm"
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Search value={searchValue} onValueChange={onSearchValueChange} />
      <div className="ml-auto flex items-center gap-2">
        <ThemeSwitch />
      </div>
    </header>
  )
}
