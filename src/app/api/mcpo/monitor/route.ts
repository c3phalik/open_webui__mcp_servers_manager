import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import mcpoManager, { StatusChange } from '@/lib/mcpo-manager'

export const GET = adminMiddleware(async (request: NextRequest, userContext) => {
  // Set up Server-Sent Events headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  })

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Send initial status
      const initialStatus = mcpoManager.getStatus()
      const data = JSON.stringify({
        type: 'status',
        data: initialStatus,
        timestamp: new Date().toISOString()
      })
      controller.enqueue(`data: ${data}\n\n`)

      // Set up status change listener
      const statusChangeHandler = (change: StatusChange) => {
        const eventData = JSON.stringify({
          type: 'statusChange',
          data: {
            ...change,
            currentStatus: mcpoManager.getStatus()
          },
          timestamp: new Date().toISOString()
        })
        
        try {
          controller.enqueue(`data: ${eventData}\n\n`)
        } catch (err) {
          // Connection might be closed
          console.error('SSE write error:', err)
        }
      }

      // Register the listener
      mcpoManager.onStatusChange(statusChangeHandler)

      // Send periodic status updates every 30 seconds
      const statusInterval = setInterval(() => {
        try {
          const currentStatus = mcpoManager.getStatus()
          const heartbeat = JSON.stringify({
            type: 'heartbeat',
            data: {
              status: currentStatus.status,
              uptime: currentStatus.uptime,
              processId: currentStatus.processId,
              validServers: currentStatus.validServers,
              invalidServers: currentStatus.invalidServers
            },
            timestamp: new Date().toISOString()
          })
          controller.enqueue(`data: ${heartbeat}\n\n`)
        } catch (err) {
          console.error('SSE heartbeat error:', err)
        }
      }, 30000)

      // Handle connection close
      const cleanup = () => {
        mcpoManager.offStatusChange(statusChangeHandler)
        clearInterval(statusInterval)
      }

      // Cleanup when connection closes
      request.signal.addEventListener('abort', cleanup)

      return cleanup
    },

    cancel() {
      // This will be called if the connection is closed
      console.log('SSE connection closed')
    }
  })

  return new NextResponse(stream, { headers })
})