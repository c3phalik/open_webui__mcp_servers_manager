import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import mcpoManager from '@/lib/mcpo-manager'

export const POST = adminMiddleware(async (request: NextRequest, userContext) => {
  try {
    await mcpoManager.start()
    
    return NextResponse.json({
      success: true,
      message: 'MCPO started successfully'
    })
  } catch (error) {
    console.error('Failed to start MCPO:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
})