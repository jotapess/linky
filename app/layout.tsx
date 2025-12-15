import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from './theme-provider'
import { DeleteModeProvider } from './delete-mode-context'

export const metadata: Metadata = {
  title: 'Useful Links',
  description: 'A collection of useful links from around the internet',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ThemeProvider>
          <DeleteModeProvider>
            {children}
          </DeleteModeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

