import { Shell } from '@/components/godmode/Shell'

interface WorkspaceLayoutProps {
  children: React.ReactNode
  params: Promise<{ workspace: string }>
}

export default async function WorkspaceLayout({
  children,
  params,
}: WorkspaceLayoutProps) {
  const { workspace } = await params
  return <Shell workspace={workspace}>{children}</Shell>
}
