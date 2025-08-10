import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { userId } = body
    
    // If no userId provided, make the first user admin
    if (!userId) {
      const firstUser = await prisma.user.findFirst({
        orderBy: { createdAt: 'asc' }
      })
      
      if (!firstUser) {
        return NextResponse.json(
          { error: 'No users found to make admin' },
          { status: 404 }
        )
      }
      
      // Update the first user to admin
      const updatedUser = await prisma.user.update({
        where: { id: firstUser.id },
        data: { role: 'admin' }
      })
      
      return NextResponse.json({ 
        message: 'First user made admin successfully',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role
        }
      })
    }

    // If userId provided, make that specific user admin
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: 'admin' }
    })

    return NextResponse.json({ 
      message: 'User made admin successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        role: updatedUser.role
      }
    })
  } catch (error) {
    console.error('Make admin error:', error)
    return NextResponse.json(
      { error: 'Failed to make user admin' },
      { status: 500 }
    )
  }
}