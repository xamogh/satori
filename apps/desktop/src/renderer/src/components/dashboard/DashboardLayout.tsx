import * as React from "react"
import { Menu, Search } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Separator } from "../ui/separator"
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet"
import { Avatar, AvatarFallback } from "../ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu"

export type DashboardNavItem<K extends string> = {
  readonly key: K
  readonly label: string
  readonly icon: React.ReactNode
}

export type DashboardLayoutProps<K extends string> = {
  readonly appName: string
  readonly navItems: ReadonlyArray<DashboardNavItem<K>>
  readonly activeKey: K
  readonly onNavigate: (key: K) => void
  readonly searchValue: string
  readonly onSearchValueChange: (value: string) => void
  readonly userEmail: string
  readonly userRole: string
  readonly onSignOut: () => void
  readonly children: React.ReactNode
}

const initialsFromEmail = (email: string): string => {
  const local = email.split("@")[0] ?? ""
  const letters = local.replaceAll(/[^a-z0-9]/giu, "").slice(0, 2)
  return letters.length === 0 ? "U" : letters.toUpperCase()
}

const SidebarNav = <K extends string>({
  appName,
  navItems,
  activeKey,
  onNavigate,
}: Pick<DashboardLayoutProps<K>, "appName" | "navItems" | "activeKey" | "onNavigate">): React.JSX.Element => (
  <div className="flex h-full max-h-screen flex-col gap-2 bg-sidebar text-sidebar-foreground">
    <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
      <div className="text-sm font-semibold">{appName}</div>
    </div>
    <nav className="grid gap-1 px-2 py-2">
      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onNavigate(item.key)}
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
            "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            item.key === activeKey
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70"
          )}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            {item.icon}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
    <div className="mt-auto px-4 py-4">
      <div className="text-xs text-sidebar-foreground/60">
        Local-first · Effect Schema · IPC-safe
      </div>
    </div>
  </div>
)

export const DashboardLayout = <K extends string>({
  appName,
  navItems,
  activeKey,
  onNavigate,
  searchValue,
  onSearchValueChange,
  userEmail,
  userRole,
  onSignOut,
  children,
}: DashboardLayoutProps<K>): React.JSX.Element => (
  <div className="min-h-screen bg-background">
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-sidebar-border md:block">
        <SidebarNav
          appName={appName}
          navItems={navItems}
          activeKey={activeKey}
          onNavigate={onNavigate}
        />
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-4 md:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0">
              <SidebarNav
                appName={appName}
                navItems={navItems}
                activeKey={activeKey}
                onNavigate={onNavigate}
              />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) => onSearchValueChange(event.target.value)}
                placeholder="Search…"
                className="pl-8"
              />
            </div>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Avatar>
                  <AvatarFallback>{initialsFromEmail(userEmail)}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="grid gap-0.5">
                  <div className="text-sm font-medium">{userEmail}</div>
                  <div className="text-xs font-normal text-muted-foreground">
                    {userRole}
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onSignOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  </div>
)
