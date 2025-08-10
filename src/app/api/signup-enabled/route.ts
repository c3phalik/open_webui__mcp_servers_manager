import { NextResponse } from 'next/server'
import { promises as fs } from 'fs'

const SETTINGS_FILE = '/tmp/mcp-settings.json'

export async function GET() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8')
    const settings = JSON.parse(data)
    return NextResponse.json({ signupEnabled: settings.signupEnabled ?? true })
  } catch {
    // File doesn't exist, signup is enabled by default
    return NextResponse.json({ signupEnabled: true })
  }
}