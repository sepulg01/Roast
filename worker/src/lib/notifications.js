import { hmacSha256Hex } from './utils.js';

const NOTIFIABLE_EVENTS = new Set([
  'draft_created',
  'payment_link_created',
  'order_contact_requested',
  'pending_transfer',
  'paid',
  'payment_failed',
  'manual_review'
]);

export function shouldNotifyEvent(eventType) {
  return NOTIFIABLE_EVENTS.has(eventType);
}

export async function notifyOperationalEvent(env, payload) {
  if (!env.APPS_SCRIPT_WEBHOOK_URL || !env.APPS_SCRIPT_SHARED_SECRET) {
    return false;
  }

  const payloadString = JSON.stringify(payload);
  const signature = await hmacSha256Hex(env.APPS_SCRIPT_SHARED_SECRET, payloadString);
  const response = await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      payload,
      signature
    })
  });

  return response.ok;
}
