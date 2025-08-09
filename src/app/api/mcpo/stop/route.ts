import { NextResponse } from 'next/server'
import mcpoManager from '@/lib/mcpo-manager'

export async function POST() {
  try {
    await mcpoManager.stop()
    
    return NextResponse.json({
      success: true,
      message: 'MCPO stopped successfully'
    })
  } catch (error) {
    console.error('Failed to stop MCPO:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}