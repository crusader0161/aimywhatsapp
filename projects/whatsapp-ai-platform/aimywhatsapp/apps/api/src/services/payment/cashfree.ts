import axios from 'axios'
import crypto from 'crypto'
import { nanoid } from 'nanoid'

const ENV = process.env.CASHFREE_ENV || 'sandbox'

const BASE_URL = ENV === 'production'
  ? 'https://api.cashfree.com/pg'
  : 'https://sandbox.cashfree.com/pg'

const APP_ID = ENV === 'production'
  ? process.env.CASHFREE_APP_ID_PROD!
  : process.env.CASHFREE_APP_ID_SANDBOX!

const SECRET_KEY = ENV === 'production'
  ? process.env.CASHFREE_SECRET_KEY_PROD!
  : process.env.CASHFREE_SECRET_KEY_SANDBOX!

export interface CreatePaymentLinkParams {
  amount: number
  purpose: string
  customerName: string
  customerPhone: string
  customerEmail?: string
  expiryHours?: number
}

export interface PaymentLinkResult {
  linkId: string
  linkUrl: string
  status: string
}

export async function createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
  const linkId = `AIMY-${nanoid(10).toUpperCase()}`

  const expiryDate = new Date()
  expiryDate.setHours(expiryDate.getHours() + (params.expiryHours || 48))

  // Clean phone: extract 10-digit Indian mobile
  const cleanPhone = params.customerPhone
    .replace(/^\+91/, '')
    .replace(/\D/g, '')
    .slice(-10)

  const response = await axios.post(`${BASE_URL}/links`, {
    link_id: linkId,
    link_amount: params.amount,
    link_currency: 'INR',
    link_purpose: params.purpose,
    customer_details: {
      customer_phone: cleanPhone || '9999999999',
      customer_name: params.customerName || 'Customer',
      customer_email: params.customerEmail || 'noreply@memoriesindia.com',
    },
    link_notify: { send_sms: false, send_email: false },
    link_partial_payments: false,
    link_expiry_time: expiryDate.toISOString(),
  }, {
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': APP_ID,
      'x-client-secret': SECRET_KEY,
      'Content-Type': 'application/json',
    },
  })

  return {
    linkId: response.data.link_id,
    linkUrl: response.data.link_url,
    status: response.data.link_status,
  }
}

export function verifyWebhookSignature(rawBody: string, signature: string, timestamp: string): boolean {
  try {
    const data = timestamp + rawBody
    const hmac = crypto.createHmac('sha256', SECRET_KEY)
    hmac.update(data)
    return hmac.digest('base64') === signature
  } catch {
    return false
  }
}
