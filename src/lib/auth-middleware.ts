import { NextRequest, NextResponse } from "next/server"
import { auth } from "./auth"
import { headers } from "next/headers"
import { UserContext } from "./mcp-service"
import { prisma } from "./prisma"

export async function getServerSession() {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    })
    return session
  } catch (error) {
    return null
  }
}

export async function requireAuth() {
  const session = await getServerSession()
  if (!session) {
    throw new Error("Authentication required")
  }
  return session
}

export async function getUserContext(): Promise<UserContext | null> {
  const session = await getServerSession()
  if (!session) {
    return null
  }

  // Get user role from database since it might not be in session
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true }
  })

  // Use Better Auth's role system - check if user has admin role
  const isAdmin = user?.role === 'admin'
  
  // Debug: Log the admin check
  console.log(`Admin check for user ${session.user.id}: role=${user?.role}, isAdmin=${isAdmin}`)

  return {
    userId: session.user.id,
    isAdmin: isAdmin
  }
}

export async function requireUserContext(): Promise<UserContext> {
  const userContext = await getUserContext()
  if (!userContext) {
    throw new Error("Authentication required")
  }
  return userContext
}

export async function requireAdmin() {
  const userContext = await requireUserContext()
  
  if (!userContext.isAdmin) {
    throw new Error("Admin access required")
  }
  
  return userContext
}

export function authMiddleware(handler: (req: NextRequest, userContext: UserContext) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      const userContext = await requireUserContext()
      return handler(req, userContext)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Authentication failed" }, { status: 401 })
    }
  }
}

export function adminMiddleware(handler: (req: NextRequest, userContext: UserContext) => Promise<NextResponse>) {
  return async (req: NextRequest) => {
    try {
      const userContext = await requireAdmin()
      return handler(req, userContext)
    } catch (error) {
      const status = error instanceof Error && error.message === "Admin access required" ? 403 : 401
      return NextResponse.json({ error: error instanceof Error ? error.message : "Access denied" }, { status })
    }
  }
}

// Middleware for dynamic routes that need both userContext and route params
export function adminRouteMiddleware<T = Record<string, string>>(
  handler: (req: NextRequest, context: { params: Promise<T> }, userContext: UserContext) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<T> }) => {
    try {
      const userContext = await requireAdmin()
      return handler(req, context, userContext)
    } catch (error) {
      const status = error instanceof Error && error.message === "Admin access required" ? 403 : 401
      return NextResponse.json({ error: error instanceof Error ? error.message : "Access denied" }, { status })
    }
  }
}