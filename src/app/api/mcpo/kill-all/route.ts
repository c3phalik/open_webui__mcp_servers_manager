import { NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export const POST = adminMiddleware(async () => {
  try {
    // Execute pkill command to kill all mcpo processes
    const { stdout, stderr } = await execAsync('pkill -f mcpo')
    
    // pkill returns exit code 1 if no processes were found, which is not an error
    // So we don't throw on stderr, just log it
    if (stderr) {
      console.log('pkill stderr (may be normal):', stderr)
    }

    return NextResponse.json({
      success: true,
      message: 'Kill signal sent to all MCPO processes pkill -9 -f mcpopkill -9 -f mcpo',
      stdout: stdout || 'No output from pkill command',
      stderr: stderr || null
    })
    
  } catch (error) {
    console.error('Error killing MCPO processes:', error)
    
    // Check if the error is because no processes were found
    if (error instanceof Error && error.message.includes('Command failed')) {
      return NextResponse.json({
        success: true,
        message: 'No MCPO processes found to kill',
        stdout: '',
        stderr: error.message
      })
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        message: 'Failed to kill MCPO processes'
      },
      { status: 500 }
    )
  }
})