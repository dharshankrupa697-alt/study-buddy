import type { Metadata } from "next"
import "./globals.css"
import AppShell from "@/components/layout/AppShell"

export const metadata: Metadata = {
  title: "StudyBuddy — AI Study Assistant",
  description: "Focus monitoring, AI tutoring, and goal tracking",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin:0, background:"#0a0a0a", color:"white" }}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}