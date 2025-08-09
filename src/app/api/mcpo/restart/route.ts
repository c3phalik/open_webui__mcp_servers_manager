import { NextRequest, NextResponse } from 'next/server'
import mcpoManager from '@/lib/mcpo-manager'

export async function POST(request: NextRequest) {
  try {
    // Optional: Add authentication check here
    // const authHeader = request.headers.get('authorization')
    // if (!authHeader || authHeader !== `Bearer ${process.env.API_KEY}`) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

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
}