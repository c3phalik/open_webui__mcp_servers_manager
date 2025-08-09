"use client"

import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { useRouter } from "next/navigation"
import { mcpConfigSchema } from "@/lib/mcp-schema"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Terminal, Network, Plus, Trash2, Save } from 'lucide-react'
import { Card, CardContent } from "@/components/ui/card"

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

export default function MCPEditForm({
  server,
  initialName = "",
  initialConfig = { mcpServers: {} } as MCPConfig,
}: {
  server?: {
    id: string
    name: string
    uniqueId: string
    shareWithWorkspace: boolean
    config: { command: string; args: string[] } | { type: string; url: string; headers?: Record<string, string> }
  }
  initialName?: string
  initialConfig?: MCPConfig
}) {
  const router = useRouter()
  const [existing, setExisting] = useState<MCPConfig>(initialConfig)
  const [shareWithWorkspace, setShareWithWorkspace] = useState(server?.shareWithWorkspace ?? false)
  
  // Use server prop if available, otherwise fallback to initialConfig
  const name = server?.name ?? initialName
  const config = server?.config ?? initialConfig.mcpServers?.[initialName]

  const [form, setForm] = useState<FormState>(() => {
    if (config && "command" in config) {
      return {
        kind: "local",
        name,
        command: config.command,
        argsText: (config.args ?? []).join(" "),
      }
    }
    const headersArray: HeaderKV[] = config && "headers" in config && config.headers
      ? Object.entries(config.headers).map(([k, v]) => ({ key: k, value: String(v) }))
      : [{ key: "", value: "" }]
    return {
      kind: "url",
      name,
      type: (config && "type" in config ? config.type : "sse") as "sse" | "streamable-http",
      url: (config && "url" in config ? config.url : "") as string,
      headers: headersArray,
    }
  })
  const originalName = name
  const serverUniqueId = server?.uniqueId

  // Refresh existing config to ensure uniqueness checks are up-to-date
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/mcp-config", { cache: "no-store" })
        if (res.ok) {
          setExisting(await res.json())
        }
      } catch {
        // ignore
      }
    }
    fetchConfig()
  }, [])

  const nameError = useMemo(() => {
    const n = form.name.trim()
    if (!n) return "Name is required"
    if (n !== originalName && existing.mcpServers && Object.prototype.hasOwnProperty.call(existing.mcpServers, n)) {
      return `A server named "${n}" already exists`
    }
    return ""
  }, [form.name, existing, originalName])

  function setPartial(patch: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...patch } as FormState))
  }

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

  async function handleSave(e: React.FormEvent) {
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
      let updatedServer
      if (serverUniqueId) {
        // Update existing server
        updatedServer = await fetch("/api/mcp-servers", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uniqueId: serverUniqueId,
            name: serverName,
            config,
            shareWithWorkspace
          }),
        })
      } else {
        // This is a fallback for legacy mode - should not normally happen
        // Fall back to the old API
        const nextConfig: MCPConfig = { mcpServers: { ...(existing.mcpServers ?? {}) } }
        if (originalName && originalName in nextConfig.mcpServers) {
          delete nextConfig.mcpServers[originalName]
        }
        nextConfig.mcpServers[serverName] = config
        
        const res = await fetch("/api/mcp-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextConfig),
        })
        if (!res.ok) throw new Error(await res.text())
        toast.success("Saved", { description: "Configuration updated." })
        router.push("/")
        router.refresh()
        return
      }
      
      if (!updatedServer.ok) throw new Error(await updatedServer.text())
      
      const result = await updatedServer.json()
      toast.success("Saved", { description: "Server updated successfully." })
      
      // Navigate to the updated server (might have new uniqueId if name changed)
      router.push(`/servers/${result.uniqueId}`)
      router.refresh()
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error("Save failed", { description: message })
    }
  }

  async function handleDelete() {
    try {
      if (serverUniqueId) {
        // Delete using new API
        const res = await fetch("/api/mcp-servers", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uniqueId: serverUniqueId }),
        })
        if (!res.ok) throw new Error(await res.text())
      } else {
        // Fallback for legacy mode
        const nextConfig: MCPConfig = { mcpServers: { ...(existing.mcpServers ?? {}) } }
        if (originalName in nextConfig.mcpServers) {
          delete nextConfig.mcpServers[originalName]
        }
        const res = await fetch("/api/mcp-config", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(nextConfig),
        })
        if (!res.ok) throw new Error(await res.text())
      }
      
      toast.success("Deleted", { description: `Removed "${originalName}".` })
      router.push("/")
      router.refresh()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error("Delete failed", { description: message })
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Edit Server: {originalName}</h2>
          <p className="text-muted-foreground">
            Update the configuration for this server. Changes will be saved to the database.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 shrink-0">
          <Button 
            type="submit" 
            form="mcp-edit-form"
            size="lg"
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => router.push("/")}
            size="lg"
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleDelete}
            size="lg"
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card className="border-muted shadow-sm">
        <CardContent className="p-8">
          <form id="mcp-edit-form" onSubmit={handleSave} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Server Name (key)</Label>
              <Input
                id="name"
                placeholder="e.g., memory, time, mcp_sse"
                value={form.name}
                onChange={(e) => setPartial({ name: e.target.value })}
              />
              {nameError ? <p className="text-xs text-red-600">{nameError}</p> : null}
            </div>
            <div className="grid gap-2">
              <div className="flex items-center space-x-2 pt-6">
                <input
                  id="shareWithWorkspace"
                  type="checkbox"
                  checked={shareWithWorkspace}
                  onChange={(e) => setShareWithWorkspace(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="shareWithWorkspace" className="text-sm font-normal">
                  Share with workspace
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                Allow other users in your workspace to access this server
              </p>
            </div>
          </div>

          <Tabs value={form.kind} onValueChange={(v) => resetToKind(v as "local" | "url")}>
            <TabsList>
              <TabsTrigger value="local" className="gap-2">
                <Terminal className="h-4 w-4" /> Local
              </TabsTrigger>
              <TabsTrigger value="url" className="gap-2">
                <Network className="h-4 w-4" /> URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="space-y-4">
              {form.kind === "local" && (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="command">Command</Label>
                      <Select
                        value={form.command}
                        onValueChange={(v: "npx" | "uvx" | "npm") => setPartial({ command: v })}
                      >
                        <SelectTrigger id="command">
                          <SelectValue placeholder="Select command" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="npx">npx</SelectItem>
                          <SelectItem value="uvx">uvx</SelectItem>
                          <SelectItem value="npm">npm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label htmlFor="args">Args</Label>
                      <Input
                        id="args"
                        placeholder='Example: -y @modelcontextprotocol/server-memory'
                        value={form.argsText}
                        onChange={(e) => setPartial({ argsText: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">Space-separated; quotes are supported.</p>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              {form.kind === "url" && (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={form.type}
                        onValueChange={(v: "sse" | "streamable-http") => setPartial({ type: v })}
                      >
                        <SelectTrigger id="type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sse">sse</SelectItem>
                          <SelectItem value="streamable-http">streamable-http</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <Label htmlFor="url">URL</Label>
                      <Input
                        id="url"
                        inputMode="url"
                        placeholder="http://127.0.0.1:8001/sse"
                        value={form.kind === "url" ? form.url : ""}
                        onChange={(e) => form.kind === "url" && setPartial({ url: e.target.value } as Partial<UrlForm>)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Headers</Label>
                      <Button type="button" variant="outline" size="sm" onClick={addHeader}>
                        <Plus className="mr-2 h-4 w-4" /> Add header
                      </Button>
                    </div>
                    <div className="grid gap-2">
                      {(form.kind === "url" ? (form.headers ?? []) : []).map((h, idx) => (
                        <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                          <Input
                            placeholder="Header key e.g., Authorization"
                            value={h.key}
                            onChange={(e) => updateHeader(idx, { key: e.target.value })}
                          />
                          <Input
                            placeholder="Header value e.g., Bearer token"
                            value={h.value}
                            onChange={(e) => updateHeader(idx, { value: e.target.value })}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label="Remove header"
                            onClick={() => removeHeader(idx)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Remove header</span>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
