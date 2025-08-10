import { z } from "zod"

const localCommandSchema = z.object({
  command: z.enum(["npx", "uvx", "npm"], {
    message: "command must be one of npx, uvx, or npm",
  }),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
})

const urlServerSchema = z.object({
  type: z.enum(["sse", "streamable-http"], {
    message: "type must be sse or streamable-http",
  }),
  url: z.string().regex(/^https?:\/\/.+/, {
    message: "url must be a valid HTTP or HTTPS URL",
  }),
  headers: z.record(z.string(), z.string().min(1, "header value must be non-empty")).optional(),
})

const mcpServerSchema = z.union([localCommandSchema, urlServerSchema])

export const mcpConfigSchema = z.object({
  mcpServers: z
    .record(
      z.string().min(1, "Server name must not be empty"),
      mcpServerSchema
    )
    .default({}),
})
