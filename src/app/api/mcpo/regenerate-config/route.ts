import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import mcpoManager from '@/lib/mcpo-manager'

export const POST = adminMiddleware(async (request: NextRequest, userContext) => {
  try {
    const configPath = await mcpoManager.generateConfig()
    
    if (!configPath) {
      return NextResponse.json(
        { error: 'Failed to generate configuration' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      configPath,
      message: 'Configuration regenerated successfully'
    })
  } catch (error) {
    console.error('Failed to regenerate config:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
})