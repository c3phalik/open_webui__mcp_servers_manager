"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Separator } from "@/components/ui/separator"
import { 
  Terminal, 
  Globe, 
  Plus, 
  Search, 
  Server, 
  Copy, 
  Check,
  Users2, 
  Command,
  Network,
  Filter,
  X,
  ChevronDown,
  MoreVertical,
  Link,
  Settings,
  Trash2,
  AlertTriangle,
  Grid3X3,
  TableProperties
} from 'lucide-react'
import { toast } from "sonner"
import { Loader2, Edit } from 'lucide-react'
import MCPOStatusCompact from "./mcpo-status-compact"
import { MCPServerModal } from "./mcp-server-modal"

interface ServerConfig {
  command?: "npx" | "uvx" | "npm"
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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface Props {}

export default function ServersList({}: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedItem, setCopiedItem] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<"all" | "local" | "remote">("all")
  const [showSharedOnly, setShowSharedOnly] = useState(false)
  const [servers, setServers] = useState<ServerWithMetadata[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<"create" | "edit">("create")
  const [selectedServer, setSelectedServer] = useState<ServerWithMetadata | undefined>()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [serverToDelete, setServerToDelete] = useState<ServerWithMetadata | null>(null)
  const [confirmationInput, setConfirmationInput] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards")
  
  useEffect(() => {
    fetchServers()
  }, [])

  const fetchServers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/mcp-servers')
      if (response.ok) {
        const data = await response.json()
        setServers(data)
      }
    } catch (error) {
      console.error('Error fetching servers:', error)
    } finally {
      setIsLoading(false)
    }
  }
  
  const serversList = servers

  const filteredServers = useMemo(() => {
    return serversList.filter((server) => {
      const matchesSearch = server.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (server.config.command && server.config.command.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (server.config.url && server.config.url.toLowerCase().includes(searchQuery.toLowerCase()))
      
      const isLocal = "command" in server.config
      const matchesType = filterType === "all" || 
        (filterType === "local" && isLocal) || 
        (filterType === "remote" && !isLocal)
      
      const matchesShared = !showSharedOnly || server.shareWithWorkspace
      
      return matchesSearch && matchesType && matchesShared
    })
  }, [serversList, searchQuery, filterType, showSharedOnly])

  const copyServerUrl = (server: ServerWithMetadata) => {
    // Get MCPO URL from environment or default
    const mcpoUrl = `${process.env.NEXT_PUBLIC_URL}:${process.env.NEXT_PUBLIC_MCPO_PORT}`
    console.log("MCPO PORT", process.env.NEXT_PUBLIC_MCPO_PORT)

    const mcpoDocsUrl = `${mcpoUrl}/docs`
    const mcpoOpenApiUrl = `${mcpoUrl}/openapi.json`
    const serverUrl = `${mcpoUrl}/${server.uniqueId}`
    navigator.clipboard.writeText(serverUrl)
    setCopiedItem(`url-${server.uniqueId}`)
    toast.success("Server URL copied to clipboard!")
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const copyServerConfig = (name: string, config: ServerConfig) => {
    const configJson = JSON.stringify({ [name]: config }, null, 2)
    navigator.clipboard.writeText(configJson)
    setCopiedItem(`config-${name}`)
    toast.success("Server config copied to clipboard!")
    setTimeout(() => setCopiedItem(null), 2000)
  }

  const openCreateModal = () => {
    setModalMode("create")
    setSelectedServer(undefined)
    setModalOpen(true)
  }

  const openEditModal = (server: ServerWithMetadata) => {
    setModalMode("edit")
    setSelectedServer(server)
    setModalOpen(true)
  }

  const handleModalSuccess = () => {
    // Refresh server list
    fetchServers()
  }

  const handleDeleteClick = (server: ServerWithMetadata) => {
    setServerToDelete(server)
    setDeleteDialogOpen(true)
  }

  const handleDeleteClose = () => {
    setConfirmationInput('')
    setDeleteDialogOpen(false)
    setServerToDelete(null)
  }

  const handleDeleteConfirm = async () => {
    if (!serverToDelete || confirmationInput !== serverToDelete.name) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/mcp-servers/${serverToDelete.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success("Server deleted successfully!")
        fetchServers() // Refresh the list
        handleDeleteClose()
      } else {
        toast.error("Failed to delete server")
      }
    } catch (error) {
      console.error('Error deleting server:', error)
      toast.error("Failed to delete server")
    } finally {
      setIsDeleting(false)
    }
  }

  const isConfirmationValid = serverToDelete && confirmationInput === serverToDelete.name

  const stats = {
    total: serversList.length,
    local: serversList.filter(s => "command" in s.config).length,
    remote: serversList.filter(s => !("command" in s.config)).length,
    shared: serversList.filter(s => s.shareWithWorkspace).length
  }

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Loading servers...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-6 mb-6">
            <div className="space-y-3">
              <div>
                <h1 className="text-4xl font-bold tracking-tight">
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
                  <Users2 className="h-3 w-3 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stats.shared} Shared</span>
                </div>
              </div>
            </div>

            {/* MCPO Status Widget */}
            <div className="flex-shrink-0">
              <MCPOStatusCompact />
            </div>
          </div>
          
          {/* Separator */}
          <Separator className="mb-12" />
        </div>

        {/* Search and Filter Bar */}
        <div className="mb-4 flex flex-col lg:flex-row gap-3">
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search servers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-10 h-11"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </Button>
            )}
          </div>
          <div className="flex gap-3 flex-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="default" className="h-11 min-w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  {filterType === "all" && "All Servers"}
                  {filterType === "local" && "Local"}
                  {filterType === "remote" && "Remote"}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => setFilterType("all")}>
                  <Filter className="mr-2 h-4 w-4" />
                  All Servers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("local")}>
                  <Terminal className="mr-2 h-4 w-4" />
                  Local Servers
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterType("remote")}>
                  <Globe className="mr-2 h-4 w-4" />
                  Remote Servers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <div className="flex items-center gap-2 px-3 border rounded-md h-11">
              <Switch
                id="shared-only"
                checked={showSharedOnly}
                onCheckedChange={setShowSharedOnly}
              />
              <Label htmlFor="shared-only" className="text-sm font-medium cursor-pointer">
                <div className="flex items-center gap-2">
                  <Users2 className="h-4 w-4" />
                  Shared only
                </div>
              </Label>
            </div>
            
            <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as "cards" | "table")}>
              <TabsList className="h-11">
                <TabsTrigger value="cards" className="gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Cards
                </TabsTrigger>
                <TabsTrigger value="table" className="gap-2">
                  <TableProperties className="h-4 w-4" />
                  Table
                </TabsTrigger>
              </TabsList>
            </Tabs>
            
            <div className="ml-auto">
              <Button size="default" className="h-11 group" onClick={openCreateModal}>
                <Plus className="mr-2 h-4 w-4 group-hover:rotate-90 transition-transform" />
                Create New Server
              </Button>
            </div>
          </div>
        </div>

        {/* Servers Display */}
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
                <Button onClick={openCreateModal}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Server
                </Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === "cards" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServers.map((server) => {
              const isLocal = "command" in server.config
              return (
                <Card 
                  key={server.uniqueId || server.name}
                  className="group relative overflow-hidden hover:shadow-md transition-shadow duration-200 border cursor-pointer"
                  onClick={() => openEditModal(server)}
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
                            <Users2 className="h-2.5 w-2.5" />
                            Shared
                          </Badge>
                        )}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation()
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            copyServerUrl(server)
                          }}>
                            {copiedItem === `url-${server.uniqueId}` ? (
                              <Check className="mr-2 h-4 w-4 text-green-500" />
                            ) : (
                              <Link className="mr-2 h-4 w-4" />
                            )}
                            Copy Server URL
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            copyServerConfig(server.name, server.config)
                          }}>
                            {copiedItem === `config-${server.name}` ? (
                              <Check className="mr-2 h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="mr-2 h-4 w-4" />
                            )}
                            Copy Config
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            openEditModal(server)
                          }}>
                            <Settings className="mr-2 h-4 w-4" />
                            Edit Server
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteClick(server)
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Server
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                      <div className="text-xs text-primary/60 group-hover:text-primary transition-colors">
                        Click to edit
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
            
            {/* Empty state card at end of grid */}
            <Card 
              className="border-dashed border hover:border-primary/50 transition-colors cursor-pointer group"
              onClick={openCreateModal}
            >
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="p-3 bg-muted rounded-full mb-3 group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  Add New Server
                </span>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Table View */
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[250px]">Name</TableHead>
                  <TableHead className="w-[100px]">Type</TableHead>
                  <TableHead>Configuration</TableHead>
                  <TableHead className="w-[100px]">Shared</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredServers.map((server) => {
                  const isLocal = "command" in server.config
                  return (
                    <TableRow 
                      key={server.uniqueId || server.name}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openEditModal(server)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isLocal ? (
                            <Command className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Network className="h-4 w-4 text-muted-foreground" />
                          )}
                          {server.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isLocal ? (
                          <Badge variant="secondary" className="gap-1.5">
                            <Terminal className="h-3 w-3" />
                            Local
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1.5">
                            <Globe className="h-3 w-3" />
                            {server.config.type === 'sse' ? 'SSE' : 'HTTP'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-md truncate text-sm text-muted-foreground">
                          {isLocal ? (
                            <>
                              <code className="text-xs font-medium">{server.config.command}</code>
                              {server.config.args && server.config.args.length > 0 && (
                                <span className="ml-2">
                                  {server.config.args.slice(0, 2).join(" ")}
                                  {server.config.args.length > 2 && "..."}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="break-all">{server.config.url}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {server.shareWithWorkspace && (
                          <Badge variant="outline" className="gap-1.5">
                            <Users2 className="h-2.5 w-2.5" />
                            Shared
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => {
                                e.stopPropagation()
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              copyServerUrl(server)
                            }}>
                              {copiedItem === `url-${server.uniqueId}` ? (
                                <Check className="mr-2 h-4 w-4 text-green-500" />
                              ) : (
                                <Link className="mr-2 h-4 w-4" />
                              )}
                              Copy Server URL
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              copyServerConfig(server.name, server.config)
                            }}>
                              {copiedItem === `config-${server.name}` ? (
                                <Check className="mr-2 h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="mr-2 h-4 w-4" />
                              )}
                              Copy Config
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(server)
                            }}>
                              <Settings className="mr-2 h-4 w-4" />
                              Edit Server
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteClick(server)
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Server
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
                
                {/* Add server row at end of table */}
                <TableRow>
                  <TableCell colSpan={5} className="h-16">
                    <button
                      onClick={openCreateModal}
                      className="w-full flex items-center justify-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add New Server
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {/* MCP Server Modal */}
        <MCPServerModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          mode={modalMode}
          server={selectedServer}
          onSuccess={handleModalSuccess}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={handleDeleteClose}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Delete MCP Server
              </DialogTitle>
            </DialogHeader>
            
            {serverToDelete && (
              <div className="space-y-4 py-4">
                {/* Warning Message */}
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-red-800">
                        This action cannot be undone
                      </p>
                      <p className="text-sm text-red-700">
                        You are about to permanently delete the MCP server{' '}
                        <span className="font-medium">&ldquo;{serverToDelete.name}&rdquo;</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Confirmation Input */}
                <div className="space-y-2">
                  <Label htmlFor="confirmation" className="text-sm font-medium">
                    To confirm deletion, type the server name:
                  </Label>
                  <Input
                    id="confirmation"
                    type="text"
                    placeholder={serverToDelete.name}
                    value={confirmationInput}
                    onChange={(e) => setConfirmationInput(e.target.value)}
                    disabled={isDeleting}
                    className="border-red-300 focus:border-red-500 focus:ring-red-500"
                  />
                </div>

                {/* Additional Warnings */}
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• The server configuration will be permanently deleted</p>
                  <p>• Any applications using this server will lose access</p>
                  <p>• This action cannot be reversed</p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleDeleteClose}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={!isConfirmationValid || isDeleting}
                className="gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete Server
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}