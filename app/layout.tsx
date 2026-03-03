import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuthProvider } from "@/components/auth-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "VolleyScore - Marcador de Voleibol",
  description: "Aplicación para seguimiento de partidos de voleibol amateur",
    generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: "#FF6B6B",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} font-sans antialiased`}>
        <AuthProvider>
          <main className="min-h-svh">{children}</main>
        </AuthProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}
