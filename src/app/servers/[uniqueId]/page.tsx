import { notFound } from "next/navigation"
import Link from "next/link"
import MCPEditForm from "@/components/mcp-edit-form"
import { Button } from "@/components/ui/button"
import { MCPService } from "@/lib/mcp-service"
import { ArrowLeft } from "lucide-react"
import { isValidUniqueId } from "@/lib/slug-utils"

export default async function ServerEditPage({
  params,
}: {
  params: Promise<{ uniqueId: string }>
}) {
  const { uniqueId } = await params
  
  // Validate unique ID format
  if (!isValidUniqueId(uniqueId)) {
    notFound()
  }

  // Load server by unique ID
  const server = await MCPService.getServerByUniqueId(uniqueId)
  if (!server) {
    notFound()
  }

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

        <MCPEditForm server={server} />
      </div>
    </main>
  )
}
