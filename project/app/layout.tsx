import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import DbHealthCheck from '@/components/DbHealthCheck'
import QueryProvider from '@/components/QueryProvider'

export const metadata: Metadata = {
  title: 'Bidsquire - Professional Auction Management Platform',
  description: 'Streamline your auction workflow from research to final listing with Bidsquire\'s comprehensive management platform.',
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/images/favicon.png',
    shortcut: '/images/favicon.png',
    apple: '/images/favicon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthProvider>
            <DbHealthCheck />
            {children}
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  )
}