"use client"

import { useEffect, useMemo, useState } from "react"
import { z } from "zod"
import { mcpConfigSchema } from "@/lib/mcp-schema"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Plus, Save, RefreshCcw, Trash2, Terminal, Network, Shield, LinkIcon, Copy } from 'lucide-react'
import { toast } from "sonner"

type MCPConfig = z.infer<typeof mcpConfigSchema>

type HeaderKV = { key: string; value: string }

type LocalCommand = {
  kind: "local"
  name: string
  command: "npx" | "uvx" | "npm"
  argsText: string // user-editable string; will be parsed into args[]
}

type UrlServer = {
  kind: "url"
  name: string
  type: "sse" | "streamable-http"
  url: string
  headers: HeaderKV[]
}

type EditableServer = LocalCommand | UrlServer

function argsToText(args: string[]) {
  return args.join(" ")
}

// Split args string into string[] (supports quoted segments)
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
        if (current.length) {
          // starting a quoted segment mid-token
        }
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

function toEditableServers(config: MCPConfig): EditableServer[] {
  const entries = Object.entries(config?.mcpServers ?? {})
  return entries.map(([name, value]) => {
    if ("command" in value) {
      const command =
        value.command === "npx" || value.command === "uvx" || value.command === "npm"
          ? value.command
          : "npx"
      return {
        kind: "local",
        name,
        command,
        argsText: argsToText(Array.isArray(value.args) ? value.args : []),
      } as LocalCommand
    } else {
      return {
        kind: "url",
        name,
        type: value.type === "streamable-http" ? "streamable-http" : ("sse" as const),
        url: value.url ?? "",
        headers: Object.entries(value.headers ?? {}).map(([k, v]) => ({ key: k, value: String(v) })),
      } as UrlServer
    }
  })
}

function fromEditableServers(servers: EditableServer[]): MCPConfig {
  const mcpServers: Record<string, { command: "npx" | "uvx" | "npm"; args: string[]; } | { type: "sse" | "streamable-http"; url: string; headers?: Record<string, string>; }> = {}
  for (const s of servers) {
    if (!s.name) continue
    if (s.kind === "local") {
      mcpServers[s.name] = {
        command: s.command,
        args: textToArgs(s.argsText || ""),
      }
    } else {
      const headers: Record<string, string> = {}
      for (const kv of s.headers) {
        if (kv.key) headers[kv.key] = kv.value
      }
      mcpServers[s.name] = {
        type: s.type,
        url: s.url,
        ...(Object.keys(headers).length ? { headers } : {}),
      }
    }
  }
  return { mcpServers }
}

function validateEditableServers(servers: EditableServer[]) {
  // Build config and validate with Zod
  const config = fromEditableServers(servers)
  const parsed = mcpConfigSchema.safeParse(config)
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`)
    return { success: false as const, messages: msgs }
  }
  // Check unique names
  const names = servers.map((s) => s.name.trim()).filter(Boolean)
  const dup = names.find((n, i) => names.indexOf(n) !== i)
  if (dup) return { success: false as const, messages: [`Duplicate server name "${dup}"`] }
  // Check headers keys uniqueness per server
  for (const s of servers) {
    if (s.kind === "url") {
      const keys = s.headers.map((h) => h.key).filter(Boolean)
      const dupKey = keys.find((k, i) => keys.indexOf(k) !== i)
      if (dupKey) return { success: false as const, messages: [`Duplicate header key "${dupKey}" in ${s.name}`] }
    }
  }
  return { success: true as const, value: config }
}

function createEmptyLocal(): LocalCommand {
  return { kind: "local", name: "new_local", command: "npx", argsText: "" }
}
function createEmptyUrl(): UrlServer {
  return { kind: "url", name: "new_url", type: "sse", url: "", headers: [{ key: "", value: "" }] }
}

export default function MCPConfigEditor({
  initialConfig = { mcpServers: {} },
}: {
  initialConfig?: MCPConfig
}) {
  const [servers, setServers] = useState<EditableServer[]>(() => toEditableServers(initialConfig))
  const [loading, setLoading] = useState(false)
  const [showJson, setShowJson] = useState(false)

  useEffect(() => {
    setServers(toEditableServers(initialConfig))
  }, [initialConfig])

  const jsonPreview = useMemo(() => {
    return JSON.stringify(fromEditableServers(servers), null, 2)
  }, [servers])

  async function handleReload() {
    try {
      setLoading(true)
      const res = await fetch("/api/mcp-config", { cache: "no-store" })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as MCPConfig
      setServers(toEditableServers(data))
      toast.success("Reloaded", { description: "Loaded config from disk." })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error("Reload failed", { description: message })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    const validation = validateEditableServers(servers)
    if (!validation.success) {
      toast.error("Validation errors", {
        description: validation.messages.join(" | "),
      })
      return
    }
    try {
      setLoading(true)
      const res = await fetch("/api/mcp-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validation.value),
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success("Saved", { description: "Configuration saved." })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error("Save failed", { description: message })
    } finally {
      setLoading(false)
    }
  }

  function updateServer(index: number, patch: Partial<EditableServer>) {
    setServers((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], ...patch } as EditableServer
      return next
    })
  }

  function removeServer(index: number) {
    setServers((prev) => prev.filter((_, i) => i !== index))
  }

  function duplicateServer(index: number) {
    setServers((prev) => {
      const copy = { ...prev[index] } as EditableServer
      // Ensure unique name
      const base = copy.name || (copy.kind === "local" ? "local" : "url")
      let n = 2
      let candidate = `${base}_${n}`
      const names = new Set(prev.map((s) => s.name))
      while (names.has(candidate)) {
        n++
        candidate = `${base}_${n}`
      }
      copy.name = candidate
      return [...prev, copy]
    })
  }

  function addLocal() {
    setServers((prev) => [...prev, createEmptyLocal()])
  }
  function addUrl() {
    setServers((prev) => [...prev, createEmptyUrl()])
  }

  function addHeader(i: number) {
    setServers((prev) => {
      const next = [...prev]
      const s = next[i]
      if (s.kind === "url") {
        s.headers = [...s.headers, { key: "", value: "" }]
      }
      return next
    })
  }
  function updateHeader(i: number, hi: number, patch: Partial<HeaderKV>) {
    setServers((prev) => {
      const next = [...prev]
      const s = next[i]
      if (s.kind === "url") {
        const headers = [...s.headers]
        headers[hi] = { ...headers[hi], ...patch }
        s.headers = headers
      }
      return next
    })
  }
  function removeHeader(i: number, hi: number) {
    setServers((prev) => {
      const next = [...prev]
      const s = next[i]
      if (s.kind === "url") {
        const headers = [...s.headers]
        headers.splice(hi, 1)
        s.headers = headers.length ? headers : [{ key: "", value: "" }]
      }
      return next
    })
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(jsonPreview)
      toast.success("Copied", { description: "JSON copied to clipboard." })
    } catch {
      toast.error("Copy failed", { description: "Unable to copy to clipboard." })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-xl">Servers</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={addLocal}>
              <Terminal className="mr-2 h-4 w-4" />
              {'Add Local (npx/uvx/npm)'}
            </Button>
            <Button variant="secondary" onClick={addUrl}>
              <Network className="mr-2 h-4 w-4" />
              {'Add URL (sse/streamable-http)'}
            </Button>
            <Separator orientation="vertical" className="mx-1 hidden md:block" />
            <Button variant="outline" onClick={() => setShowJson((s) => !s)}>
              <Shield className="mr-2 h-4 w-4" />
              {showJson ? "Hide JSON" : "Show JSON"}
            </Button>
            <Button variant="outline" onClick={copyJson}>
              <Copy className="mr-2 h-4 w-4" />
              Copy JSON
            </Button>
            <Button variant="outline" onClick={handleReload} disabled={loading}>
              <RefreshCcw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              Reload from Disk
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              <Save className={cn("mr-2 h-4 w-4", loading && "animate-pulse")} />
              Save Configuration
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {showJson && (
            <pre className="rounded-md bg-muted p-4 text-xs overflow-auto max-h-[400px]">{jsonPreview}</pre>
          )}
          <div className="grid gap-6">
            {servers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No servers yet. Add one to get started.</div>
            ) : null}
            {servers.map((s, i) => (
              <Card key={`${s.kind}-${i}`} className="border-muted">
                <CardHeader className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {s.kind === "local" ? (
                      <Badge variant="secondary" className="gap-1">
                        <Terminal className="h-3.5 w-3.5" /> Local Command
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="gap-1">
                        <LinkIcon className="h-3.5 w-3.5" /> URL Server
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor={`name-${i}`}>Server Name (key)</Label>
                      <Input
                        id={`name-${i}`}
                        placeholder="e.g., memory, time, mcp_sse"
                        value={s.name}
                        onChange={(e) => updateServer(i, { name: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        This will be the key under {'"mcpServers"'} in the JSON file.
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor={`kind-${i}`}>Kind</Label>
                      <Select
                        value={s.kind}
                        onValueChange={(val: "local" | "url") => {
                          if (val === s.kind) return
                          // Convert while preserving name
                          if (val === "local") {
                            updateServer(i, { kind: "local", command: "npx", argsText: "" } as Partial<EditableServer>)
                          } else {
                            updateServer(i, { kind: "url", type: "sse", url: "", headers: [{ key: "", value: "" }] } as Partial<EditableServer>)
                          }
                        }}
                      >
                        <SelectTrigger id={`kind-${i}`}>
                          <SelectValue placeholder="Select kind" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="local">Local (npx/uvx/npm)</SelectItem>
                          <SelectItem value="url">URL (sse/streamable-http)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Tabs value={s.kind} onValueChange={(val) => {
                    if (val === "local" || val === "url") {
                      if (val !== s.kind) {
                        if (val === "local") {
                          updateServer(i, { kind: "local", command: "npx", argsText: "" } as Partial<EditableServer>)
                        } else {
                          updateServer(i, { kind: "url", type: "sse", url: "", headers: [{ key: "", value: "" }] } as Partial<EditableServer>)
                        }
                      }
                    }
                  }}>
                    <TabsList>
                      <TabsTrigger value="local">Local Command</TabsTrigger>
                      <TabsTrigger value="url">URL Server</TabsTrigger>
                    </TabsList>
                    <TabsContent value="local" className="space-y-4">
                      {s.kind === "local" && (
                        <>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="grid gap-2">
                              <Label htmlFor={`cmd-${i}`}>Command</Label>
                              <Select
                                value={s.command}
                                onValueChange={(v: "npx" | "uvx" | "npm") => updateServer(i, { command: v } as Partial<EditableServer>)}
                              >
                                <SelectTrigger id={`cmd-${i}`}>
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
                              <Label htmlFor={`args-${i}`}>Args</Label>
                              <Input
                                id={`args-${i}`}
                                placeholder={'Example: -y @modelcontextprotocol/server-memory'}
                                value={s.argsText}
                                onChange={(e) => updateServer(i, { argsText: e.target.value })}
                              />
                              <p className="text-xs text-muted-foreground">
                                Space-separated; quotes are supported to group values.
                              </p>
                            </div>
                          </div>
                        </>
                      )}
                    </TabsContent>
                    <TabsContent value="url" className="space-y-4">
                      {s.kind === "url" && (
                        <>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="grid gap-2">
                              <Label htmlFor={`type-${i}`}>Type</Label>
                              <Select
                                value={s.type}
                                onValueChange={(v: "sse" | "streamable-http") => updateServer(i, { type: v } as Partial<EditableServer>)}
                              >
                                <SelectTrigger id={`type-${i}`}>
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="sse">sse</SelectItem>
                                  <SelectItem value="streamable-http">streamable-http</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="md:col-span-2 grid gap-2">
                              <Label htmlFor={`url-${i}`}>URL</Label>
                              <Input
                                id={`url-${i}`}
                                inputMode="url"
                                placeholder="http://127.0.0.1:8001/sse"
                                value={s.url}
                                onChange={(e) => updateServer(i, { url: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label>Headers</Label>
                              <Button variant="outline" size="sm" onClick={() => addHeader(i)}>
                                <Plus className="mr-2 h-4 w-4" /> Add header
                              </Button>
                            </div>
                            <div className="grid gap-2">
                              {s.headers.map((h, hi) => (
                                <div key={hi} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                  <Input
                                    placeholder="Header key e.g., Authorization"
                                    value={h.key}
                                    onChange={(e) => updateHeader(i, hi, { key: e.target.value })}
                                  />
                                  <Input
                                    placeholder="Header value e.g., Bearer token"
                                    value={h.value}
                                    onChange={(e) => updateHeader(i, hi, { value: e.target.value })}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeHeader(i, hi)}
                                    className="justify-self-start md:justify-self-auto"
                                    aria-label="Remove header"
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
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => duplicateServer(i)}>
                      Duplicate
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeServer(i)}>
                      <Trash2 className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
      <div className="text-sm text-muted-foreground">
        Operations supported:
        <ul className="list-disc pl-5 mt-2 space-y-1">
          <li>
            Run MCP server on your machine: choose {"Local (npx/uvx/npm)"} and specify command and args.
          </li>
          <li>
            Add MCP server from a URL: choose {"URL (sse/streamable-http)"} with URL and optional headers.
          </li>
        </ul>
      </div>
    </div>
  )
}
