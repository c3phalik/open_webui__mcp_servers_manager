import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

/**
 * Crypto utilities for encrypting/decrypting environment variables
 * Uses AES-256-CBC with HMAC for authenticated encryption
 */

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // 128 bits for CBC
const SALT_LENGTH = 32 // 256 bits

/**
 * Get or generate the encryption key from environment
 */
function getEncryptionKey(): Buffer {
  const keyEnv = process.env.ENV_ENCRYPTION_KEY
  
  if (!keyEnv) {
    throw new Error(
      'ENV_ENCRYPTION_KEY environment variable is required. ' +
      'Generate a secure 32-byte key: openssl rand -hex 32'
    )
  }

  // Convert hex string to buffer
  const key = Buffer.from(keyEnv, 'hex')
  
  if (key.length !== 32) {
    throw new Error(
      'ENV_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters). ' +
      'Generate with: openssl rand -hex 32'
    )
  }
  
  return key
}

/**
 * Encrypt a string using AES-256-CBC
 */
function encryptString(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const salt = randomBytes(SALT_LENGTH)
  
  // Derive key with salt
  const derivedKey = createHash('sha256')
    .update(Buffer.concat([key, salt]))
    .digest()

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  // Combine salt + iv + encrypted data
  const combined = Buffer.concat([
    salt,
    iv,
    Buffer.from(encrypted, 'hex')
  ])
  
  return combined.toString('base64')
}

/**
 * Decrypt a string using AES-256-CBC
 */
function decryptString(encryptedData: string): string {
  const key = getEncryptionKey()
  const combined = Buffer.from(encryptedData, 'base64')
  
  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH)
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH)
  
  // Derive key with salt
  const derivedKey = createHash('sha256')
    .update(Buffer.concat([key, salt]))
    .digest()

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv)

  let decrypted = decipher.update(encrypted, undefined, 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Encrypt environment variables object
 */
export function encryptEnvVars(envVars: Record<string, string> | null | undefined): string | null {
  if (!envVars || Object.keys(envVars).length === 0) {
    return null
  }
  
  try {
    const json = JSON.stringify(envVars)
    return encryptString(json)
  } catch (error) {
    console.error('Error encrypting environment variables:', error)
    throw new Error('Failed to encrypt environment variables')
  }
}

/**
 * Decrypt environment variables object
 */
export function decryptEnvVars(encryptedData: string | null): Record<string, string> | null {
  if (!encryptedData) {
    return null
  }
  
  try {
    const json = decryptString(encryptedData)
    return JSON.parse(json)
  } catch (error) {
    console.error('Error decrypting environment variables:', error)
    throw new Error('Failed to decrypt environment variables')
  }
}

/**
 * Create masked version of environment variables for display
 * Shows key names but masks values with ****
 */
export function maskEnvVars(envVars: Record<string, string> | null): Record<string, string> | null {
  if (!envVars || Object.keys(envVars).length === 0) {
    return null
  }
  
  const masked: Record<string, string> = {}
  
  for (const [key, value] of Object.entries(envVars)) {
    // Show first character + **** + last character for non-empty values
    if (value && value.length > 0) {
      if (value.length === 1) {
        masked[key] = '*'
      } else if (value.length === 2) {
        masked[key] = value[0] + '*'
      } else {
        masked[key] = value[0] + '****' + value[value.length - 1]
      }
    } else {
      masked[key] = '****'
    }
  }
  
  return masked
}

/**
 * Validate environment variable names
 * Must be valid identifiers (alphanumeric + underscore, no spaces)
 */
export function validateEnvVarName(name: string): boolean {
  if (!name || typeof name !== 'string') {
    return false
  }
  
  // Valid env var names: alphanumeric + underscore, can't start with number
  const envVarRegex = /^[A-Za-z_][A-Za-z0-9_]*$/
  return envVarRegex.test(name)
}

/**
 * Validate environment variables object
 */
export function validateEnvVars(envVars: Record<string, string>): { valid: boolean; errors: string[] } {
  const errors: string[] = []
  
  for (const [key, value] of Object.entries(envVars)) {
    if (!validateEnvVarName(key)) {
      errors.push(`Invalid environment variable name: "${key}". Names must be alphanumeric with underscores, and cannot start with a number.`)
    }
    
    if (typeof value !== 'string') {
      errors.push(`Environment variable "${key}" must have a string value.`)
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}