// server/services/notification/providers/twilio.ts
export interface TwilioConfig {
  accountSid: string
  authToken: string
  fromNumber: string
  toNumber: string
}

export const twilioProvider = {
  name: 'Twilio SMS',
  
  async send(config: TwilioConfig, title: string, message: string): Promise<void> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`
    
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')
    
    const body = new URLSearchParams({
      From: config.fromNumber,
      To: config.toNumber,
      Body: `${title}\n\n${message}`
    })

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Twilio notification failed: ${errorData.message || response.status}`)
    }
  }
}
