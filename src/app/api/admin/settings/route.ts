import { NextRequest, NextResponse } from 'next/server'
import { adminMiddleware } from '@/lib/auth-middleware'

// For simplicity, we'll use environment variables or a simple JSON file for settings
// In production, you might want to use a database table for system settings
import { promises as fs } from 'fs'

const SETTINGS_FILE = '/tmp/mcp-settings.json'

interface SystemSettings {
  signupEnabled: boolean
}

const DEFAULT_SETTINGS: SystemSettings = {
  signupEnabled: true
}

async function getSettings(): Promise<SystemSettings> {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
  } catch {
    // File doesn't exist or is invalid, return defaults
    return DEFAULT_SETTINGS
  }
}

async function saveSettings(settings: SystemSettings): Promise<void> {
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2))
}

export const GET = adminMiddleware(async () => {
  try {
    const settings = await getSettings()
    return NextResponse.json({ settings })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    )
  }
})

export const POST = adminMiddleware(async (request: NextRequest) => {
  try {
    const { signupEnabled } = await request.json()
    
    if (typeof signupEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'signupEnabled must be a boolean' },
        { status: 400 }
      )
    }

    const currentSettings = await getSettings()
    const newSettings = { ...currentSettings, signupEnabled }
    
    await saveSettings(newSettings)
    
    return NextResponse.json({ settings: newSettings })
  } catch (error) {
    console.error('Error updating settings:', error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
})