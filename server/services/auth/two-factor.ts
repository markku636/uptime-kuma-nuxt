// server/services/auth/two-factor.ts
import { authenticator } from 'otplib'
import QRCode from 'qrcode'

export interface TwoFactorSetup {
  secret: string
  uri: string
  qrCode: string
}

export interface TwoFactorVerifyResult {
  valid: boolean
  message: string
}

/**
 * Generate a new 2FA secret and QR code for setup
 */
export async function generateTwoFactorSetup(username: string, issuer: string = 'Uptime Kuma'): Promise<TwoFactorSetup> {
  // Generate secret
  const secret = authenticator.generateSecret()
  
  // Generate OTP Auth URI
  const uri = authenticator.keyuri(username, issuer, secret)
  
  // Generate QR code as data URL
  const qrCode = await QRCode.toDataURL(uri)
  
  return {
    secret,
    uri,
    qrCode
  }
}

/**
 * Verify a TOTP token against a secret
 */
export function verifyTwoFactorToken(token: string, secret: string): TwoFactorVerifyResult {
  try {
    // Validate token format
    if (!token || token.length !== 6 || !/^\d+$/.test(token)) {
      return {
        valid: false,
        message: 'Invalid token format. Token must be 6 digits.'
      }
    }
    
    const isValid = authenticator.verify({ token, secret })
    
    return {
      valid: isValid,
      message: isValid ? 'Token verified successfully' : 'Invalid token'
    }
  } catch (error: any) {
    return {
      valid: false,
      message: error.message || 'Token verification failed'
    }
  }
}

/**
 * Generate backup codes for 2FA recovery
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  
  for (let i = 0; i < count; i++) {
    // Generate 8 character alphanumeric codes
    const code = Array(8)
      .fill(0)
      .map(() => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excludes ambiguous characters
        return chars.charAt(Math.floor(Math.random() * chars.length))
      })
      .join('')
    
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`)
  }
  
  return codes
}

/**
 * Verify a backup code (one-time use)
 */
export function verifyBackupCode(inputCode: string, storedCodes: string[]): { valid: boolean; usedIndex: number } {
  const normalizedInput = inputCode.toUpperCase().replace(/-/g, '')
  
  for (let i = 0; i < storedCodes.length; i++) {
    const normalizedStored = storedCodes[i].toUpperCase().replace(/-/g, '')
    
    if (normalizedInput === normalizedStored) {
      return { valid: true, usedIndex: i }
    }
  }
  
  return { valid: false, usedIndex: -1 }
}
