import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const DELETE = adminMiddleware(async (request: NextRequest, { params }: { params: { pid: string } }) => {
  try {
    const pid = parseInt(params.pid)
    
    if (isNaN(pid) || pid <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid PID provided',
          message: `PID must be a positive integer, got: ${params.pid}`
        },
        { status: 400 }
      )
    }

    // First check if the process exists and is actually an MCPO process
    try {
      const { stdout: checkOutput } = await execAsync(`ps -p ${pid} -o comm=`)
      if (!checkOutput.toLowerCase().includes('mcpo') && !checkOutput.toLowerCase().includes('node')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Process is not an MCPO process',
            message: `Process ${pid} does not appear to be related to MCPO`
          },
          { status: 400 }
        )
      }
    } catch (checkError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Process not found',
          message: `Process with PID ${pid} does not exist`
        },
        { status: 404 }
      )
    }

    // Kill the process
    const { stdout, stderr } = await execAsync(`kill -TERM ${pid}`)
    
    if (stderr && !stderr.includes('No such process')) {
      console.warn(`Warning killing process ${pid}:`, stderr)
    }

    // Wait a moment then check if it's still running
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    let processStillExists = true
    try {
      await execAsync(`ps -p ${pid}`)
    } catch {
      processStillExists = false
    }

    // If still exists, try SIGKILL
    if (processStillExists) {
      try {
        await execAsync(`kill -KILL ${pid}`)
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (killError) {
        console.warn(`Error with SIGKILL on ${pid}:`, killError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Signal sent to process ${pid}`,
      pid: pid,
      stdout: stdout || '',
      stderr: stderr || null
    })
    
  } catch (error) {
    console.error(`Error killing process ${params.pid}:`, error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: `Failed to kill process ${params.pid}`
      },
      { status: 500 }
    )
  }
})