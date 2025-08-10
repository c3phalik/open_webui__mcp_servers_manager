import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminRouteMiddleware } from '@/lib/auth-middleware'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

interface RouteContext {
  params: {
    userId: string
  }
}

export const PUT = adminRouteMiddleware(async (request: NextRequest, context: RouteContext, userContext) => {
  try {
    const { userId } = await context.params
    const { name, email, role } = await request.json()
    
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if email is already taken by another user
    if (email.toLowerCase() !== existingUser.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      })

      if (emailTaken) {
        return NextResponse.json(
          { error: 'Email is already in use by another user' },
          { status: 409 }
        )
      }
    }

    // Prevent removing admin from the last admin user
    if (role !== 'admin' && existingUser.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: { role: 'admin' }
      })
      
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove admin privileges from the last admin user' },
          { status: 400 }
        )
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim()
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        _count: {
          select: { mcpServers: true }
        }
      }
    })

    // Update role if changed using Better Auth internal API
    if (role && role !== updatedUser.role) {
      const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
      
      const response = await fetch(`${baseUrl}/api/auth/admin/set-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(await headers())
        },
        body: JSON.stringify({
          userId: userId,
          role: role
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Better Auth role update error:', errorData)
        return NextResponse.json(
          { error: errorData.error || 'Failed to update role using Better Auth' },
          { status: 500 }
        )
      }
      
      // Refetch user to get updated role
      const userWithUpdatedRole = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          emailVerified: true,
          createdAt: true,
          _count: {
            select: { mcpServers: true }
          }
        }
      })

      return NextResponse.json({ 
        user: {
          ...userWithUpdatedRole,
          isAdmin: userWithUpdatedRole?.role === 'admin'
        }
      })
    }

    return NextResponse.json({ 
      user: {
        ...updatedUser,
        isAdmin: updatedUser.role === 'admin'
      }
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
})

export const DELETE = adminRouteMiddleware(async (request: NextRequest, context: RouteContext, userContext) => {
  try {
    const { userId } = await context.params
    
    // Check if user exists and get server count
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        _count: {
          select: { mcpServers: true }
        }
      }
    })

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    // Prevent deleting the last admin user
    if (user.role === 'admin') {
      const adminCount = await prisma.user.count({
        where: { role: 'admin' }
      })
      
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last admin user' },
          { status: 400 }
        )
      }
    }

    // Delete user's MCP servers first
    await prisma.mcpServer.deleteMany({
      where: { userId }
    })

    // Delete user directly using Prisma (since auth.api.admin is client-side only)
    await prisma.user.delete({
      where: { id: userId }
    })

    return NextResponse.json({ 
      message: 'User deleted successfully',
      deletedServers: user._count.mcpServers
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    )
  }
})