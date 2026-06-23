/**
 * Layout for the (auth) route group (/login, /invite).
 *
 * IMPORTANT: do NOT reverse-redirect signed-in users to `/` here. Several
 * flows legitimately send a *signed-in* user back to /login with an error
 * context (root → ?error=no_workspace, workspace layout →
 * ?error=account_pending_deletion). A blanket `redirect('/')` in this layout
 * ping-ponged with those redirects → infinite loop, locking users out.
 *
 * The "signed-in user shouldn't sit on a bare /login" UX is handled in the
 * login page itself (client-side), which CAN read the query string and only
 * bounces to the dashboard when there's no error to show.
 */
export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
