import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import mcpoManager from '@/lib/mcpo-manager'

export const GET = adminMiddleware(async (request: NextRequest, userContext) => {
  try {
    const status = mcpoManager.getStatus()
    
    if (status.status !== 'running') {
      return NextResponse.json(
        {
          mcpoRunning: false,
          error: 'MCPO is not currently running',
          status: status.status
        },
        { status: 503 }
      )
    }
    
    const baseUrl = 'http://localhost:8001'
    const validServers = mcpoManager.getValidServers()
    
    // Generate URLs for each valid server
    const serverUrls: { [key: string]: any } = {}
    
    for (const serverId of validServers) {
      serverUrls[serverId] = {
        serverId,
        baseUrl: `${baseUrl}/${serverId}`,
        docsUrl: `${baseUrl}/${serverId}/docs`,
        openApiUrl: `${baseUrl}/${serverId}/openapi.json`,
        schemaUrl: `${baseUrl}/${serverId}/schema`
      }
    }
    
    return NextResponse.json({
      mcpoRunning: true,
      baseUrl,
      totalServers: validServers.length,
      servers: serverUrls,
      globalEndpoints: {
        docs: `${baseUrl}/docs`,
        health: `${baseUrl}/health`,
        openapi: `${baseUrl}/openapi.json`
      },
      status: {
        processId: status.processId,
        uptime: status.uptime,
        validServers: status.validServers,
        invalidServers: status.invalidServers
      }
    })
    
  } catch (error) {
    console.error('Error getting MCPO URLs:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        mcpoRunning: false,
        error: errorMessage
      },
      { status: 500 }
    )
  }
})