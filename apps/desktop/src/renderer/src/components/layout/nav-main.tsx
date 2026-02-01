import * as React from "react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar"

export type NavItem<K extends string> = {
  readonly key: K
  readonly label: string
  readonly icon: React.ReactNode
}

export type NavMainProps<K extends string> = {
  readonly items: ReadonlyArray<NavItem<K>>
  readonly activeKey: K
  readonly onNavigate: (key: K) => void
}

export const NavMain = <K extends string>({
  items,
  activeKey,
  onNavigate,
}: NavMainProps<K>): React.JSX.Element => (
  <SidebarGroup>
    <SidebarGroupLabel>Navigation</SidebarGroupLabel>
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.key}>
          <SidebarMenuButton
            onClick={() => onNavigate(item.key)}
            isActive={item.key === activeKey}
            tooltip={item.label}
          >
            {item.icon}
            <span>{item.label}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  </SidebarGroup>
)
