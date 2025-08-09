import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MCPService } from "@/lib/mcp-service"
import MCPCreateForm from "@/components/mcp-create-form"

async function loadConfig() {
  try {
    return await MCPService.getAllServers()
  } catch (error) {
    console.error('Error loading MCP servers:', error)
    return { mcpServers: {} }
  }
}

export default async function CreatePage() {
  const initialConfig = await loadConfig()
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Servers
            </Link>
          </Button>
        </div>
        <MCPCreateForm initialConfig={initialConfig} />
      </div>
    </main>
  )
}
