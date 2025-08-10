import { NextRequest, NextResponse } from "next/server"
import { mcpConfigSchema } from "@/lib/mcp-schema"
import { MCPService } from "@/lib/mcp-service"
import { authMiddleware, adminMiddleware } from "@/lib/auth-middleware"

// Route Handler for reading and writing the MCP config using database

export const GET = authMiddleware(async (request: NextRequest, userContext) => {
  try {
    const config = await MCPService.getAllServers(userContext)
    return NextResponse.json(config)
  } catch (err: unknown) {
    console.error('Error fetching MCP servers:', err)
    const message = err instanceof Error ? err.message : String(err)
    return new NextResponse(message, { status: 500 })
  }
})

export const PUT = adminMiddleware(async (req: NextRequest, userContext) => {
  try {
    const body = await req.json()
    const parsed = mcpConfigSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400 })
    }
    
    await MCPService.replaceAllServers(parsed.data)
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    console.error('Error updating MCP servers:', err)
    const message = err instanceof Error ? err.message : String(err)
    return new NextResponse(message, { status: 500 })
  }
})
