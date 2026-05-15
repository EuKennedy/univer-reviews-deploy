import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://univerreviews.com'),
  title: {
    default: 'UniverReviews — Reviews com IA para e-commerce que converte',
    template: '%s · UniverReviews',
  },
  description:
    'Plataforma SaaS de reviews com inteligência artificial para WooCommerce. Moderação automática, widget < 20KB, programa de recompensas.',
  robots: { index: true, follow: true },
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className="scroll-smooth">
      <head>
        <meta name="color-scheme" content="dark" />
      </head>
      <body className="bg-[#0d0d0d] text-white antialiased">
        {children}
      </body>
    </html>
  )
}
