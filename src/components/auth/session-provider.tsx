"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"

interface User {
  id: string
  name?: string
  email: string
  emailVerified: boolean
  image?: string | null
}

interface SessionContextType {
  user: User | null
  isLoading: boolean
  isAdmin: boolean
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  isLoading: true,
  isAdmin: false
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!isPending) {
      setIsLoading(false)
      if (session?.user) {
        // Check if user is admin by checking organization membership
        checkAdminStatus(session.user.id)
      }
    }
  }, [session, isPending])

  const checkAdminStatus = async (userId: string) => {
    try {
      const response = await fetch('/api/auth/check-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (response.ok) {
        const { isAdmin } = await response.json()
        setIsAdmin(isAdmin)
      }
    } catch (error) {
      console.error('Failed to check admin status:', error)
    }
  }

  return (
    <SessionContext.Provider
      value={{
        user: session?.user || null,
        isLoading: isLoading,
        isAdmin
      }}
    >
      {children}
    </SessionContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(SessionContext)
  if (!context) {
    throw new Error("useAuth must be used within SessionProvider")
  }
  return context
}

export function useRequireAuth() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login")
    }
  }, [user, isLoading, router])

  return { user, isLoading }
}

export function useRequireAdmin() {
  const { user, isLoading, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login")
      } else if (!isAdmin) {
        router.push("/") // Redirect non-admins to homepage
      }
    }
  }, [user, isLoading, isAdmin, router])

  return { user, isLoading, isAdmin }
}