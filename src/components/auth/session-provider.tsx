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
  isCheckingAdmin: boolean
  isAdmin: boolean
}

const SessionContext = createContext<SessionContextType>({
  user: null,
  isLoading: true,
  isCheckingAdmin: false,
  isAdmin: false
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(false)

  useEffect(() => {
    if (!isPending) {
      setIsLoading(false)
      if (session?.user) {
        // Start admin check
        setIsCheckingAdmin(true)
        checkAdminStatus(session.user.id)
      } else {
        // No user, reset admin state
        setIsAdmin(false)
        setIsCheckingAdmin(false)
      }
    }
  }, [session, isPending])

  const checkAdminStatus = async (userId: string) => {
    try {
      console.log('Checking admin status for user:', userId)
      const response = await fetch('/api/auth/check-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (response.ok) {
        const { isAdmin } = await response.json()
        console.log('Admin status check result:', isAdmin)
        setIsAdmin(isAdmin)
      } else {
        console.error('Admin status check failed with status:', response.status)
      }
    } catch (error) {
      console.error('Failed to check admin status:', error)
    } finally {
      setIsCheckingAdmin(false)
    }
  }

  return (
    <SessionContext.Provider
      value={{
        user: session?.user || null,
        isLoading: isLoading,
        isCheckingAdmin: isCheckingAdmin,
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
  const { user, isLoading, isCheckingAdmin, isAdmin } = useAuth()
  const router = useRouter()

  useEffect(() => {
    // Wait for both session loading AND admin check to complete
    const isFullyLoaded = !isLoading && !isCheckingAdmin
    
    if (isFullyLoaded) {
      console.log('Admin check complete - user:', !!user, 'isAdmin:', isAdmin)
      
      if (!user) {
        console.log('No user found, redirecting to login')
        router.push("/login")
      } else if (!isAdmin) {
        console.log('User is not admin, redirecting to homepage')
        router.push("/") // Redirect non-admins to homepage
      } else {
        console.log('User is admin, access granted')
      }
    } else {
      console.log('Still loading - session loading:', isLoading, 'admin checking:', isCheckingAdmin)
    }
  }, [user, isLoading, isCheckingAdmin, isAdmin, router])

  return { user, isLoading: isLoading || isCheckingAdmin, isAdmin }
}