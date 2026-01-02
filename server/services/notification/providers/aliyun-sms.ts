// server/services/notification/providers/aliyun-sms.ts
import type { NotificationMessage } from '../sender'
import crypto from 'crypto'

export const aliyunSmsProvider = {
  async send(config: { 
    accessKeyId: string
    accessKeySecret: string
    signName: string
    templateCode: string
    phoneNumbers: string
  }, message: NotificationMessage) {
    if (!config.accessKeyId || !config.accessKeySecret) {
      throw new Error('Aliyun SMS access key ID and secret are required')
    }

    if (!config.signName || !config.templateCode || !config.phoneNumbers) {
      throw new Error('Sign name, template code, and phone numbers are required')
    }

    const params: Record<string, string> = {
      AccessKeyId: config.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: config.phoneNumbers,
      SignName: config.signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: Math.random().toString(36).substring(2),
      SignatureVersion: '1.0',
      TemplateCode: config.templateCode,
      TemplateParam: JSON.stringify({
        name: message.monitorName,
        status: message.status === 'up' ? 'UP' : 'DOWN'
      }),
      Timestamp: new Date().toISOString(),
      Version: '2017-05-25'
    }

    // Sort and encode parameters
    const sortedParams = Object.keys(params).sort().map(key => 
      `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    ).join('&')

    // Create signature
    const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(sortedParams)}`
    const signature = crypto
      .createHmac('sha1', `${config.accessKeySecret}&`)
      .update(stringToSign)
      .digest('base64')

    params.Signature = signature

    await $fetch('https://dysmsapi.aliyuncs.com/', {
      method: 'POST',
      body: new URLSearchParams(params).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })
  }
}
