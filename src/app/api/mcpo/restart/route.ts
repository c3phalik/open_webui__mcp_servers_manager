import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import mcpoManager from '@/lib/mcpo-manager'

export const POST = adminMiddleware(async (request: NextRequest, userContext) => {
  try {
    // Pass user context for config generation
    await mcpoManager.restart()
    
    const status = mcpoManager.getStatus()
    
    return NextResponse.json({
      success: true,
      message: 'MCPO restarted successfully',
      status: status.status,
      processId: status.processId,
      configFile: status.configFile,
      validServers: status.validServers,
      invalidServers: status.invalidServers
    })
    
  } catch (error) {
    console.error('Error restarting MCPO:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        status: mcpoManager.getStatus().status
      },
      { status: 500 }
    )
  }
})