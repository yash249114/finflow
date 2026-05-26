import { LayoutClient } from './layout-client'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <LayoutClient>{children}</LayoutClient>
}
