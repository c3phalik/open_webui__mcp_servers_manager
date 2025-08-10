"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Terminal, Network, Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface ServerWithMetadata {
  id: string
  name: string
  uniqueId: string
  shareWithWorkspace: boolean
  config: {
    command?: "npx" | "uvx" | "npm"
    args?: string[]
    type?: "sse" | "streamable-http"
    url?: string
    headers?: Record<string, string>
  }
}

interface MCPServerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "create" | "edit"
  server?: ServerWithMetadata
  onSuccess: () => void
}

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
      } else if (c === " " && current.length > 0) {
        result.push(current)
        current = ""
      } else if (c !== " ") {
        current += c
      }
    }
  }
  if (current.length) result.push(current)
  return result
}

function argsToText(args: string[]): string {
  return args.map(arg => arg.includes(" ") ? `"${arg}"` : arg).join(" ")
}

export function MCPServerModal({ open, onOpenChange, mode, server, onSuccess }: MCPServerModalProps) {
  const [saving, setSaving] = useState(false)
  const [shareWithWorkspace, setShareWithWorkspace] = useState(false)
  
  const [form, setForm] = useState<FormState>({
    kind: "local",
    name: "",
    command: "npx",
    argsText: "",
  })

  // Initialize form when server data changes (for edit mode)
  useEffect(() => {
    if (mode === "edit" && server) {
      setShareWithWorkspace(server.shareWithWorkspace)
      
      if (server.config.command && server.config.args) {
        // Local server
        setForm({
          kind: "local",
          name: server.name,
          command: server.config.command,
          argsText: argsToText(server.config.args)
        })
      } else if (server.config.url) {
        // Remote server
        const headers = Object.entries(server.config.headers || {}).map(([key, value]) => ({ key, value }))
        setForm({
          kind: "url",
          name: server.name,
          type: server.config.type || "sse",
          url: server.config.url,
          headers
        })
      }
    } else if (mode === "create") {
      // Reset form for create mode
      setForm({
        kind: "local",
        name: "",
        command: "npx",
        argsText: "",
      })
      setShareWithWorkspace(false)
    }
  }, [mode, server, open])

  const handleSubmit = async () => {
    try {
      setSaving(true)
      
      let config: {
        command?: "npx" | "uvx" | "npm"
        args?: string[]
        type?: "sse" | "streamable-http"
        url?: string
        headers?: Record<string, string>
      }
      if (form.kind === "local") {
        config = {
          command: form.command,
          args: textToArgs(form.argsText)
        }
      } else {
        config = {
          type: form.type,
          url: form.url,
          headers: Object.fromEntries(
            form.headers.filter(h => h.key.trim() && h.value.trim()).map(h => [h.key, h.value])
          )
        }
      }

      const payload = {
        name: form.name,
        config,
        shareWithWorkspace
      }

      if (mode === "edit" && server) {
        // Update existing server
        const response = await fetch('/api/mcp-servers', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uniqueId: server.uniqueId,
            ...payload
          })
        })

        if (!response.ok) {
          throw new Error('Failed to update server')
        }
        
        toast.success(`Server "${form.name}" updated successfully!`)
      } else {
        // Create new server
        const response = await fetch('/api/mcp-servers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          throw new Error('Failed to create server')
        }
        
        toast.success(`Server "${form.name}" created successfully!`)
      }

      onSuccess()
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving server:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save server')
    } finally {
      setSaving(false)
    }
  }

  const addHeader = () => {
    if (form.kind === "url") {
      setForm({
        ...form,
        headers: [...form.headers, { key: "", value: "" }]
      })
    }
  }

  const removeHeader = (index: number) => {
    if (form.kind === "url") {
      setForm({
        ...form,
        headers: form.headers.filter((_, i) => i !== index)
      })
    }
  }

  const updateHeader = (index: number, field: 'key' | 'value', value: string) => {
    if (form.kind === "url") {
      const newHeaders = [...form.headers]
      newHeaders[index] = { ...newHeaders[index], [field]: value }
      setForm({ ...form, headers: newHeaders })
    }
  }

  const isFormValid = () => {
    if (!form.name.trim()) return false
    
    if (form.kind === "local") {
      return form.argsText.trim().length > 0
    } else {
      try {
        new URL(form.url)
        return true
      } catch {
        return false
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New MCP Server" : `Edit "${server?.name}"`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Server Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Server Name</Label>
            <Input
              id="name"
              placeholder="my-awesome-server"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          {/* Server Type Tabs */}
          <Tabs 
            value={form.kind} 
            onValueChange={(value) => {
              if (value === "local") {
                setForm({
                  kind: "local",
                  name: form.name,
                  command: "npx",
                  argsText: ""
                })
              } else {
                setForm({
                  kind: "url",
                  name: form.name,
                  type: "sse",
                  url: "",
                  headers: []
                })
              }
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Local Command
              </TabsTrigger>
              <TabsTrigger value="url" className="flex items-center gap-2">
                <Network className="h-4 w-4" />
                Remote URL
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="command">Command</Label>
                <Select 
                  value={form.kind === "local" ? form.command : "npx"}
                  onValueChange={(value: "npx" | "uvx" | "npm") => {
                    if (form.kind === "local") {
                      setForm({ ...form, command: value })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="npx">npx</SelectItem>
                    <SelectItem value="uvx">uvx</SelectItem>
                    <SelectItem value="npm">npm</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="args">Arguments</Label>
                <Input
                  id="args"
                  placeholder="@modelcontextprotocol/server-filesystem /path/to/allowed/files"
                  value={form.kind === "local" ? form.argsText : ""}
                  onChange={(e) => {
                    if (form.kind === "local") {
                      setForm({ ...form, argsText: e.target.value })
                    }
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="url" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Connection Type</Label>
                <Select 
                  value={form.kind === "url" ? form.type : "sse"}
                  onValueChange={(value: "sse" | "streamable-http") => {
                    if (form.kind === "url") {
                      setForm({ ...form, type: value })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
                    <SelectItem value="streamable-http">Streamable HTTP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input
                  id="url"
                  placeholder="http://localhost:3001"
                  value={form.kind === "url" ? form.url : ""}
                  onChange={(e) => {
                    if (form.kind === "url") {
                      setForm({ ...form, url: e.target.value })
                    }
                  }}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Headers</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addHeader}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Header
                  </Button>
                </div>

                {form.kind === "url" && form.headers.map((header, index) => (
                  <div key={index} className="flex gap-2 items-center">
                    <Input
                      placeholder="Header name"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                    />
                    <Input
                      placeholder="Header value"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeHeader(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Share with Workspace */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="share"
              checked={shareWithWorkspace}
              onCheckedChange={(checked) => setShareWithWorkspace(!!checked)}
            />
            <Label htmlFor="share">Share with workspace</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!isFormValid() || saving}
          >
            {saving ? "Saving..." : mode === "create" ? "Create Server" : "Update Server"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}