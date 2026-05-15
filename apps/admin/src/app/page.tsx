import { redirect } from 'next/navigation'

// Root redirect: go to login (middleware will handle auth)
export default function RootPage() {
  redirect('/login')
}
