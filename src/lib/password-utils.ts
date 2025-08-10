/**
 * Password generation utilities for secure auto-generated passwords
 */

// Character sets for password generation (excluding ambiguous characters)
const LOWERCASE = 'abcdefghjkmnpqrstuvwxyz' // removed: i, l, o
const UPPERCASE = 'ABCDEFGHJKMNPQRSTUVWXYZ' // removed: I, L, O
const NUMBERS = '23456789' // removed: 0, 1
const SYMBOLS = '!@#$%^&*+-=?'

const ALL_CHARS = LOWERCASE + UPPERCASE + NUMBERS + SYMBOLS

/**
 * Generate a cryptographically secure random password
 * @param length Password length (default: 16)
 * @returns Generated password string
 */
export function generateSecurePassword(length: number = 16): string {
  if (length < 8) {
    throw new Error('Password length must be at least 8 characters')
  }

  // Use crypto.getRandomValues for secure random number generation
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)

  let password = ''
  
  // Ensure at least one character from each set
  const guaranteedChars = [
    LOWERCASE[Math.floor(Math.random() * LOWERCASE.length)],
    UPPERCASE[Math.floor(Math.random() * UPPERCASE.length)], 
    NUMBERS[Math.floor(Math.random() * NUMBERS.length)],
    SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
  ]

  // Fill the remaining length with random characters
  for (let i = 0; i < length - 4; i++) {
    const randomIndex = array[i] % ALL_CHARS.length
    password += ALL_CHARS[randomIndex]
  }

  // Add guaranteed characters and shuffle
  password += guaranteedChars.join('')
  
  // Shuffle the password to randomize character positions
  return shuffleString(password)
}

/**
 * Shuffle a string's characters randomly
 * @param str String to shuffle
 * @returns Shuffled string
 */
function shuffleString(str: string): string {
  const array = str.split('')
  
  // Fisher-Yates shuffle algorithm
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  
  return array.join('')
}

/**
 * Validate password strength
 * @param password Password to validate
 * @returns Object with validation results
 */
export function validatePasswordStrength(password: string) {
  const checks = {
    length: password.length >= 8,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumbers: /\d/.test(password),
    hasSymbols: /[!@#$%^&*+\-=?]/.test(password)
  }

  const score = Object.values(checks).filter(Boolean).length
  const strength = score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong'

  return {
    ...checks,
    score,
    strength,
    isValid: score >= 4
  }
}