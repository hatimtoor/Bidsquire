import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/sonner'
import DbHealthCheck from '@/components/DbHealthCheck'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Bidsquire - Professional Auction Management Platform',
  description: 'Streamline your auction workflow from research to final listing with Bidsquire\'s comprehensive management platform.',
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/images/bidsquire-logo.png',
    shortcut: '/images/bidsquire-logo.png',
    apple: '/images/bidsquire-logo.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <DbHealthCheck />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}