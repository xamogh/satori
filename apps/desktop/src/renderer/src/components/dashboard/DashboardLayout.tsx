import * as React from 'react'
import { SidebarProvider, SidebarInset } from '../ui/sidebar'
import { AppSidebar } from '../layout/app-sidebar'
import { Header } from '../layout/header'

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
  children
}: DashboardLayoutProps<K>): React.JSX.Element => (
  <SidebarProvider>
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-background focus:p-2 focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>
    <AppSidebar
      appName={appName}
      navItems={navItems}
      activeKey={activeKey}
      onNavigate={onNavigate}
      userEmail={userEmail}
      userRole={userRole}
      onSignOut={onSignOut}
    />
    <SidebarInset>
      <Header searchValue={searchValue} onSearchValueChange={onSearchValueChange} />
      <main id="main-content" className="flex-1 overflow-x-hidden min-w-0 p-4 md:p-6">
        {children}
      </main>
    </SidebarInset>
  </SidebarProvider>
)
