import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { WebSocketProvider } from '@/contexts/WebSocketContext'
import ErrorBoundary from '@/components/ErrorBoundary'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Osprey Trading Assistant',
  description: 'AI-powered trading assistant with human approval',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ErrorBoundary>
          <AuthProvider>
            <WebSocketProvider>
              {children}
            </WebSocketProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  )
}