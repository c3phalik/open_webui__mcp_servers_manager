import { NextRequest, NextResponse } from 'next/server'
import mcpoManager from '@/lib/mcpo-manager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitParam = searchParams.get('limit')
    const limit = limitParam ? parseInt(limitParam, 10) : 100
    
    // Validate limit parameter
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid limit parameter. Must be a positive integer.' },
        { status: 400 }
      )
    }
    
    // Cap limit to prevent excessive memory usage
    const cappedLimit = Math.min(limit, 1000)
    
    const logs = mcpoManager.getLogs(cappedLimit)
    const status = mcpoManager.getStatus()
    
    return NextResponse.json({
      logs,
      totalLogs: logs.length,
      requestedLimit: limit,
      actualLimit: cappedLimit,
      mcpoStatus: {
        status: status.status,
        processId: status.processId,
        uptime: status.uptime,
        lastError: status.lastError
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error getting MCPO logs:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        error: errorMessage,
        logs: [],
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}