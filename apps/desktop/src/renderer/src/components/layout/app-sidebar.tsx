import * as React from 'react'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '../ui/sidebar'
import { NavMain, type NavItem } from './nav-main'
import { NavUser } from './nav-user'

export type AppSidebarProps<K extends string> = React.ComponentProps<typeof Sidebar> & {
  readonly appName: string
  readonly navItems: ReadonlyArray<NavItem<K>>
  readonly activeKey: K
  readonly onNavigate: (key: K) => void
  readonly userEmail: string
  readonly userRole: string
  readonly onSignOut: () => void
}

export const AppSidebar = <K extends string>({
  appName,
  navItems,
  activeKey,
  onNavigate,
  userEmail,
  userRole,
  onSignOut,
  ...props
}: AppSidebarProps<K>): React.JSX.Element => (
  <Sidebar collapsible="icon" {...props}>
    <SidebarHeader>
      <div className="flex h-12 items-center gap-2 px-2">
        <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <span className="text-sm font-bold">S</span>
        </div>
        <div className="grid flex-1 text-left text-sm leading-tight">
          <span className="truncate font-semibold">{appName}</span>
          <span className="truncate text-xs text-sidebar-foreground/60">Admin console</span>
        </div>
      </div>
    </SidebarHeader>
    <SidebarContent>
      <NavMain items={navItems} activeKey={activeKey} onNavigate={onNavigate} />
    </SidebarContent>
    <SidebarFooter>
      <NavUser email={userEmail} role={userRole} onSignOut={onSignOut} />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
)
