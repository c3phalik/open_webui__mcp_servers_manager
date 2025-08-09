import { NextRequest, NextResponse } from 'next/server'
import { MCPService } from '@/lib/mcp-service'
import { z } from 'zod'

// Schema for server operations
const createServerSchema = z.object({
  name: z.string().min(1),
  config: z.union([
    z.object({
      command: z.enum(["npx", "uvx", "npm"]),
      args: z.array(z.string())
    }),
    z.object({
      type: z.enum(['sse', 'streamable-http']),
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional()
    })
  ]),
  shareWithWorkspace: z.boolean().default(false)
})

const updateServerSchema = z.object({
  uniqueId: z.string(),
  name: z.string().min(1),
  config: z.union([
    z.object({
      command: z.enum(["npx", "uvx", "npm"]),
      args: z.array(z.string())
    }),
    z.object({
      type: z.enum(['sse', 'streamable-http']),
      url: z.string().url(),
      headers: z.record(z.string(), z.string()).optional()
    })
  ]),
  shareWithWorkspace: z.boolean().default(false)
})

const deleteServerSchema = z.object({
  uniqueId: z.string()
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, config, shareWithWorkspace } = createServerSchema.parse(body)
    
    const server = await MCPService.createServer(name, config, shareWithWorkspace)
    return NextResponse.json(server)
  } catch (error) {
    console.error('Error creating server:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { uniqueId, name, config, shareWithWorkspace } = updateServerSchema.parse(body)
    
    const server = await MCPService.updateServer(uniqueId, name, config, shareWithWorkspace)
    return NextResponse.json(server)
  } catch (error) {
    console.error('Error updating server:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { uniqueId } = deleteServerSchema.parse(body)
    
    await MCPService.deleteServer(uniqueId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting server:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}