"use client"

import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { mcpConfigSchema } from "@/lib/mcp-schema"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Terminal, Network, Plus, Trash2 } from 'lucide-react'

type MCPConfig = z.infer<typeof mcpConfigSchema>
type HeaderKV = { key: string; value: string }

type LocalForm = {
  kind: "local"
  name: string
  command: "npx" | "uvx" | "npm"
  argsText: string
}
type UrlForm = {
  kind: "url"
  name: string
  type: "sse" | "streamable-http"
  url: string
  headers: HeaderKV[]
}
type FormState = LocalForm | UrlForm

function textToArgs(input: string): string[] {
  const result: string[] = []
  let current = ""
  let quote: '"' | "'" | null = null
  for (let i = 0; i < input.length; i++) {
    const c = input[i]
    if (quote) {
      if (c === quote) {
        quote = null
      } else if (c === "\\" && input[i + 1] === quote) {
        current += quote
        i++
      } else {
        current += c
      }
    } else {
      if (c === '"' || c === "'") {
        quote = c
      } else if (/\s/.test(c)) {
        if (current.length) {
          result.push(current)
          current = ""
        }
      } else {
        current += c
      }
    }
  }
  if (current.length) result.push(current)
  return result
}

export default function MCPCreateForm({ initialConfig = { mcpServers: {} } as MCPConfig }) {
  const router = useRouter()
  const [existing, setExisting] = useState<MCPConfig>(initialConfig)
  const [saving, setSaving] = useState(false)
  const [shareWithWorkspace, setShareWithWorkspace] = useState(false)
  const [form, setForm] = useState<FormState>({
    kind: "local",
    name: "",
    command: "npx",
    argsText: "",
  })

  function resetToKind(newKind: "local" | "url") {
    if (newKind === "local") {
      setForm({
        kind: "local",
        name: form.name,
        command: "npx",
        argsText: "",
      })
    } else {
      setForm({
        kind: "url",
        name: form.name,
        type: "sse",
        url: "",
        headers: [{ key: "", value: "" }],
      })
    }
  }

  // Ensure we have the latest config from API
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/mcp-config", { cache: "no-store" })
        if (res.ok) {
          setExisting(await res.json())
        }
      } catch {
        // ignore; fallback to initialConfig
      }
    }
    fetchConfig()
  }, [])

  const nameError = useMemo(() => {
    const n = form.name.trim()
    if (!n) return "Name is required"
    if (existing.mcpServers && Object.prototype.hasOwnProperty.call(existing.mcpServers, n)) {
      return `A server named "${n}" already exists`
    }
    return ""
  }, [form.name, existing])

  function setPartial(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch } as FormState))
  }

  function addHeader() {
    if (form.kind === "url") {
      const headers = Array.isArray(form.headers) ? form.headers : []
      setForm({ ...form, headers: [...headers, { key: "", value: "" }] })
    }
  }
  function updateHeader(idx: number, patch: Partial<HeaderKV>) {
    if (form.kind === "url") {
      const headers = Array.isArray(form.headers) ? [...form.headers] : [{ key: "", value: "" }]
      headers[idx] = { ...headers[idx], ...patch }
      setForm({ ...form, headers })
    }
  }
  function removeHeader(idx: number) {
    if (form.kind === "url") {
      const headers = Array.isArray(form.headers) ? [...form.headers] : []
      headers.splice(idx, 1)
      setForm({ ...form, headers: headers.length ? headers : [{ key: "", value: "" }] })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (nameError) {
      toast.error("Fix errors", { description: nameError })
      return
    }
    
    const serverName = form.name.trim()
    if (!serverName) {
      toast.error("Server name is required")
      return
    }
    
    // Build config object
    let config: { command: string; args: string[] } | { type: string; url: string; headers?: Record<string, string> }
    if (form.kind === "local") {
      config = {
        command: form.command,
        args: textToArgs(form.argsText || ""),
      }
    } else {
      const headers: Record<string, string> = {}
      for (const kv of form.headers) {
        if (kv.key && kv.key.trim()) {
          headers[kv.key.trim()] = kv.value
        }
      }
      config = {
        type: form.type,
        url: form.url,
        ...(Object.keys(headers).length ? { headers } : {}),
      }
    }

    try {
      setSaving(true)
      const res = await fetch("/api/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: serverName,
          config,
          shareWithWorkspace
        }),
      })
      
      if (!res.ok) throw new Error(await res.text())
      
      const newServer = await res.json()
      toast.success("Created", { description: "Server created successfully." })
      
      // Navigate to the new server's edit page
      router.push(`/servers/${newServer.uniqueId}`)
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error("Creation failed", { description: message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Create New Server</h2>
          <p className="text-muted-foreground">
            Configure a new MCP server. Choose between local command execution or remote URL endpoints.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <Button 
            type="submit" 
            form="mcp-create-form"
            disabled={saving || !!nameError}
            size="lg"
            className="gap-2"
          >
            {saving ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Creating Server...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Create Server
              </>
            )}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push("/")}
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </div>

      <Card className="border-muted shadow-sm">
        <CardContent className="p-8">
          <form id="mcp-create-form" onSubmit={handleSubmit} className="space-y-8">
            {/* Server Name Section */}
            <div className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-base font-medium">Server Name</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  A unique identifier for your server configuration
                </p>
              </div>
              <Input
                id="name"
                placeholder="e.g., memory, time, mcp_sse"
                value={form.name}
                onChange={(e) => setPartial({ name: e.target.value })}
                className={`h-11 ${nameError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {nameError && (
                <div className="flex items-center gap-2 text-red-600">
                  <div className="h-1 w-1 rounded-full bg-red-600"></div>
                  <p className="text-sm">{nameError}</p>
                </div>
              )}
            </div>

            {/* Sharing Section */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  id="shareWithWorkspace"
                  type="checkbox"
                  checked={shareWithWorkspace}
                  onChange={(e) => setShareWithWorkspace(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="shareWithWorkspace" className="text-base font-medium">
                  Share with workspace
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Allow other users in your workspace to access this server
              </p>
            </div>

            {/* Server Type Selection */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium">Server Type</Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose how your server will be accessed
                </p>
              </div>
              
              <Tabs value={form.kind} onValueChange={(v) => resetToKind(v as "local" | "url")}>
                <TabsList className="grid w-full grid-cols-2 h-12">
                  <TabsTrigger value="local" className="gap-2 h-10">
                    <Terminal className="h-4 w-4" /> 
                    Local Command
                  </TabsTrigger>
                  <TabsTrigger value="url" className="gap-2 h-10">
                    <Network className="h-4 w-4" /> 
                    Remote URL
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="local" className="space-y-6 mt-6">
                  {form.kind === "local" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Terminal className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Local Command Configuration</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Execute MCP servers locally using command-line tools like npx or uvx
                        </p>
                      </div>
                      
                      <div className="grid gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="command" className="font-medium">Command</Label>
                          <Select
                            value={form.command}
                            onValueChange={(v: "npx" | "uvx" | "npm") => setPartial({ command: v })}
                          >
                            <SelectTrigger id="command" className="h-11">
                              <SelectValue placeholder="Select command" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="npx">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                                  npx
                                </div>
                              </SelectItem>
                              <SelectItem value="uvx">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                                  uvx
                                </div>
                              </SelectItem>
                              <SelectItem value="npm">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-red-500"></div>
                                  npm
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="args" className="font-medium">Arguments</Label>
                          <Input
                            id="args"
                            placeholder='e.g., -y @modelcontextprotocol/server-memory'
                            value={form.argsText}
                            onChange={(e) => setPartial({ argsText: e.target.value })}
                            className="h-11 font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            Space-separated arguments. Use quotes for arguments containing spaces.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="url" className="space-y-6 mt-6">
                  {form.kind === "url" && (
                    <div className="space-y-6">
                      <div className="p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Network className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">Remote URL Configuration</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Connect to remote MCP servers via SSE or HTTP endpoints
                        </p>
                      </div>

                      <div className="grid gap-6 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label htmlFor="type" className="font-medium">Connection Type</Label>
                          <Select
                            value={form.type}
                            onValueChange={(v: "sse" | "streamable-http") => setPartial({ type: v })}
                          >
                            <SelectTrigger id="type" className="h-11">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sse">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                  Server-Sent Events
                                </div>
                              </SelectItem>
                              <SelectItem value="streamable-http">
                                <div className="flex items-center gap-2">
                                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                                  Streamable HTTP
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="md:col-span-2 space-y-2">
                          <Label htmlFor="url" className="font-medium">Server URL</Label>
                          <Input
                            id="url"
                            type="url"
                            placeholder="http://127.0.0.1:8001/sse"
                            value={form.kind === "url" ? form.url : ""}
                            onChange={(e) => form.kind === "url" && setPartial({ url: e.target.value } as Partial<UrlForm>)}
                            className="h-11 font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">
                            The endpoint URL for your remote MCP server
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <Label className="font-medium">Custom Headers</Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Add authentication tokens or custom headers
                            </p>
                          </div>
                          <Button 
                            type="button" 
                            variant="outline" 
                            size="sm" 
                            onClick={addHeader}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" /> 
                            Add Header
                          </Button>
                        </div>
                        
                        {(form.kind === "url" ? (form.headers ?? []) : []).length > 0 && (
                          <div className="space-y-3">
                            {(form.kind === "url" ? (form.headers ?? []) : []).map((h, idx) => (
                              <Card key={idx} className="p-4 border-muted">
                                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-center">
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Header Name</Label>
                                    <Input
                                      placeholder="e.g., Authorization"
                                      value={h.key}
                                      onChange={(e) => updateHeader(idx, { key: e.target.value })}
                                      className="h-10"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">Header Value</Label>
                                    <Input
                                      placeholder="e.g., Bearer token123"
                                      value={h.value}
                                      onChange={(e) => updateHeader(idx, { value: e.target.value })}
                                      className="h-10 font-mono text-sm"
                                    />
                                  </div>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Remove header"
                                    onClick={() => removeHeader(idx)}
                                    className="h-10 w-10 text-red-500 hover:text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>

          </form>
        </CardContent>
      </Card>
    </div>
  )
}
