import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from '@/lib/auth-middleware'

export async function GET() {
  try {
    // Get current session
    const session = await getServerSession()
    
    // Get all users with admin status
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    })

    const adminUsers = users.filter(u => u.role === 'admin')
    
    return NextResponse.json({
      currentSession: session ? {
        userId: session.user.id,
        email: session.user.email
      } : null,
      totalUsers: users.length,
      adminUsers: adminUsers.length,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        isAdmin: u.role === 'admin',
        role: u.role,
        createdAt: u.createdAt
      }))
    })
  } catch (error) {
    console.error('Debug admin status error:', error)
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    )
  }
}