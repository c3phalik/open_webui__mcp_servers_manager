import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authMiddleware } from '@/lib/auth-middleware'

export const POST = authMiddleware(async (request: NextRequest, userContext) => {
  return NextResponse.json({
    isAdmin: userContext.isAdmin,
    userId: userContext.userId
  })
})