"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { getUser } from "@/lib/supabase"
import LandingPage from "@/components/LandingPage"

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    getUser().then(user => {
      if (user) router.replace("/dashboard")
    })
  }, [])

  return <LandingPage />
}
