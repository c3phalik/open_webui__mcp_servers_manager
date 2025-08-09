"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  Terminal, 
  Globe, 
  Plus, 
  Search, 
  Server, 
  Copy, 
  Check, 
  ExternalLink, 
  Settings2, 
  Zap,
  Command,
  Network,
  ArrowRight,
  Filter
} from 'lucide-react'
import { toast } from "sonner"
import MCPOStatusCompact from "./mcpo-status-compact"

interface ServerConfig {
  command?: string
  args?: string[]
  type?: 'sse' | 'streamable-http'
  url?: string
  headers?: Record<string, string>
}

interface ServerWithMetadata {
  id: string
  name: string
  uniqueId: string
  shareWithWorkspace: boolean
  config: ServerConfig
}

interface Props {
  initialConfig: {
    mcpServers: Record<string, ServerConfig>
  }
  servers?: ServerWithMetadata[]
}

export default function ServersList({ initialConfig, servers }: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedName, setCopiedName] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<"all" | "local" | "remote" | "shared">("all")
  
  // Use servers prop if provided, otherwise fallback to initialConfig
  const serversList = servers || Object.entries(initialConfig.mcpServers ?? {}).map(([name, config]) => ({
    id: '', // No ID for legacy format
    name,
    uniqueId: '', // No uniqueId for legacy format  
    shareWithWorkspace: false,
    config
  }))

  const filteredServers = useMemo(() => {
    return serversList.filter((server) => {
      const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (server.config.command && server.config.command.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (server.config.url && server.config.url.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const isLocal = "command" in server.config
      const matchesType = filterType === "all" || 
        (filterType === "local" && isLocal) || 
        (filterType === "remote" && !isLocal) ||
        (filterType === "shared" && server.shareWithWorkspace)
      
      return matchesSearch && matchesType
    })
  }, [serversList, searchQuery, filterType])

  const copyToClipboard = (name: string, config: ServerConfig) => {
    const configJson = JSON.stringify({ [name]: config }, null, 2)
    navigator.clipboard.writeText(configJson)
    setCopiedName(name)
    toast.success("Copied to clipboard!")
    setTimeout(() => setCopiedName(null), 2000)
  }

  const stats = {
    total: serversList.length,
    local: serversList.filter(s => "command" in s.config).length,
    remote: serversList.filter(s => !("command" in s.config)).length,
    shared: serversList.filter(s => s.shareWithWorkspace).length
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Server className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  MCP Servers
                </h1>
              </div>
              <p className="text-muted-foreground max-w-xl">
                Manage your Model Context Protocol servers. Configure local command-based servers or connect to remote endpoints.
              </p>
              
              {/* Stats */}
              <div className="flex gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-sm text-muted-foreground">{stats.total} Total</span>
                </div>
                <div className="flex items-center gap-2">
                  <Terminal className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stats.local} Local</span>
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stats.remote} Remote</span>
                </div>
                <div className="flex items-center gap-2">
                  <Settings2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stats.shared} Shared</span>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="group">
                <Link href="/create">
                  <Plus className="mr-2 h-5 w-5 group-hover:rotate-90 transition-transform" />
                  Create New Server
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* MCPO Status Section */}
        <div className="mb-8 max-w-md">
          <MCPOStatusCompact />
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search servers by name, command, or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filterType === "all" ? "default" : "outline"}
              size="default"
              onClick={() => setFilterType("all")}
              className="h-11"
            >
              <Filter className="mr-2 h-4 w-4" />
              All
            </Button>
            <Button
              variant={filterType === "local" ? "default" : "outline"}
              size="default"
              onClick={() => setFilterType("local")}
              className="h-11"
            >
              <Terminal className="mr-2 h-4 w-4" />
              Local
            </Button>
            <Button
              variant={filterType === "remote" ? "default" : "outline"}
              size="default"
              onClick={() => setFilterType("remote")}
              className="h-11"
            >
              <Globe className="mr-2 h-4 w-4" />
              Remote
            </Button>
            <Button
              variant={filterType === "shared" ? "default" : "outline"}
              size="default"
              onClick={() => setFilterType("shared")}
              className="h-11"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Shared
            </Button>
          </div>
        </div>

        {/* Servers Grid */}
        {filteredServers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Server className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {searchQuery ? "No servers found" : "No servers configured"}
              </h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                {searchQuery 
                  ? "Try adjusting your search or filters"
                  : "Get started by creating your first MCP server configuration"
                }
              </p>
              {!searchQuery && (
                <Button asChild>
                  <Link href="/create">
                    <Plus className="mr-2 h-4 w-4" />
                    Create Your First Server
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServers.map((server) => {
              const isLocal = "command" in server.config
              return (
                <Card 
                  key={server.uniqueId || server.name}
                  className="group relative overflow-hidden hover:shadow-md transition-shadow duration-200 border-muted"
                >
                  {/* Subtle gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/3 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  
                  <CardHeader className="relative pb-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isLocal ? (
                          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
                            <Terminal className="h-3 w-3" />
                            Local
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
                            <Globe className="h-3 w-3" />
                            {server.config.type === 'sse' ? 'SSE' : 'HTTP'}
                          </Badge>
                        )}
                        {server.shareWithWorkspace && (
                          <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs">
                            <Settings2 className="h-2.5 w-2.5" />
                            Shared
                          </Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.preventDefault()
                          copyToClipboard(server.name, server.config)
                        }}
                      >
                        {copiedName === server.name ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    
                    <CardTitle className="text-lg mb-1 flex items-center gap-2">
                      {isLocal ? (
                        <Command className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Network className="h-4 w-4 text-muted-foreground" />
                      )}
                      {server.name}
                    </CardTitle>
                    
                    <CardDescription className="line-clamp-2 text-sm">
                      {isLocal ? (
                        <>
                          <code className="text-xs font-medium">{server.config.command}</code>
                          {server.config.args && server.config.args.length > 0 && (
                            <span className="ml-2 text-xs">
                              {server.config.args.slice(0, 2).join(" ")}
                              {server.config.args.length > 2 && "..."}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-xs break-all">
                          {server.config.url}
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  
                  <CardContent className="relative pt-2 space-y-2">
                    {/* Show additional info more compactly */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {isLocal && server.config.args && server.config.args.length > 2 && (
                          <span>{server.config.args.length} args</span>
                        )}
                        {!isLocal && server.config.headers && Object.keys(server.config.headers).length > 0 && (
                          <span>{Object.keys(server.config.headers).length} headers</span>
                        )}
                      </div>
                      <Link
                        href={`/servers/${server.uniqueId || encodeURIComponent(server.name)}`}
                        className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                      >
                        Edit
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}