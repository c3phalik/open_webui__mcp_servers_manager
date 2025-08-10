import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { adminMiddleware } from '@/lib/auth-middleware'
import { generateSecurePassword } from '@/lib/password-utils'
import { auth } from '@/lib/auth'
import { headers } from 'next/headers'

export const GET = adminMiddleware(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search') || ''
    
    const skip = (page - 1) * limit
    
    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } }
          ]
        }
      : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ])

    // Transform users to include isAdmin for backward compatibility
    const transformedUsers = users.map(user => ({
      ...user,
      isAdmin: user.role === 'admin'
    }))

    return NextResponse.json({
      users: transformedUsers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
})

export const PATCH = adminMiddleware(async (request: NextRequest) => {
  try {
    const { userId, role } = await request.json()
    
    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      )
    }

    // Don't allow removing admin from the last admin user
    if (role !== 'admin') {
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

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true
      }
    })

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

export const POST = adminMiddleware(async (request: NextRequest) => {
  try {
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

    // Generate secure password
    const password = generateSecurePassword(16)

    // Create user using Better Auth signUp method
    const result = await auth.api.signUpEmail({
      body: {
        email: email.toLowerCase().trim(),
        password: password,
        name: name.trim()
      }
    })

    if (!result.user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      )
    }

    // Set email as verified directly in database
    await prisma.user.update({
      where: { id: result.user.id },
      data: { 
        emailVerified: true
      }
    })

    // Set admin role if requested using Better Auth internal API
    if (role === 'admin') {
      const baseUrl = process.env.BETTER_AUTH_URL || 'http://localhost:3000'
      
      const response = await fetch(`${baseUrl}/api/auth/admin/set-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...Object.fromEntries(await headers())
        },
        body: JSON.stringify({
          userId: result.user.id,
          role: 'admin'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Better Auth role set error:', errorData)
        return NextResponse.json(
          { error: errorData.error || 'User created but failed to set admin role' },
          { status: 500 }
        )
      }
    }

    // Get user with count data
    const userData = await prisma.user.findUnique({
      where: { id: result.user.id },
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
        ...userData,
        isAdmin: userData?.role === 'admin'
      },
      password: password // Return plain password for admin to copy
    })
  } catch (error) {
    console.error('Error creating user:', error)
    
    // Handle specific Better Auth errors
    if (error && typeof error === 'object' && 'message' in error) {
      const message = error.message as string
      if (message.includes('already exists') || message.includes('duplicate')) {
        return NextResponse.json(
          { error: 'User with this email already exists' },
          { status: 409 }
        )
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
})