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

export const POST = adminRouteMiddleware(async (request: NextRequest, context: RouteContext, userContext) => {
  try {
    const { userId } = await context.params
    console.log('Reset password request for userId:', userId)
    
    // Get the password from request body (sent by modal)
    const { newPassword } = await request.json()
    
    if (!newPassword) {
      console.log('No password provided in request')
      return NextResponse.json(
        { error: 'New password is required' },
        { status: 400 }
      )
    }
    
    console.log('Using provided password, length:', newPassword.length)
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true
      }
    })

    if (!user) {
      console.log('User not found:', userId)
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    console.log('Found user:', user.email)

    // Use Better Auth server-side API directly
    console.log('Calling Better Auth server API...')
    try {
      const result = await auth.api.setUserPassword({
        body: {
          newPassword: newPassword,
          userId: userId
        },
        headers: await headers()
      })
      
      console.log('Better Auth result:', result)
    } catch (error) {
      console.error('Better Auth admin API error:', error)
      // Fallback to direct database update if Better Auth admin API fails
      console.log('Falling back to direct password update...')
      
      // Hash password and update directly
      const bcrypt = await import('bcryptjs')
      const hashedPassword = await bcrypt.hash(newPassword, 12)
      
      // Update password in account table
      const updatedAccount = await prisma.account.updateMany({
        where: {
          userId: userId,
          providerId: 'credential'
        },
        data: {
          password: hashedPassword
        }
      })
      
      console.log('Direct password update result:', updatedAccount)
      
      if (updatedAccount.count === 0) {
        return NextResponse.json(
          { error: 'No password account found for this user' },
          { status: 404 }
        )
      }
      
      // Revoke all sessions to force re-login
      await prisma.session.deleteMany({
        where: { userId: userId }
      })
    }

    return NextResponse.json({ 
      message: 'Password reset successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
})