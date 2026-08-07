// netlify/functions/send-telegram.js
// Sends a message to the admin Telegram chat

async function netlifyHandler(req, context) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Parse the message from the request body
  let body;
  try {
    body = await req.json().catch(() => ({}));
  } catch (err) {
    return new Response('Invalid JSON', { status: 400 });
  }

  const message = body.message;
  if (!message) {
    return new Response('Missing message', { status: 400 });
  }

  // Get Telegram credentials from environment variables
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    console.error('Telegram credentials missing');
    return new Response('Telegram not configured', { status: 500 });
  }

  // Send message to Telegram
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',  // allows bold, italic, etc.
      }),
    });
    const data = await response.json();
    if (!data.ok) {
      console.error('Telegram error:', data);
      return new Response(JSON.stringify(data), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('OK', { status: 200 });
  } catch (err) {
    console.error('Telegram request failed:', err);
    return new Response(err.message, { status: 500 });
  }
};


import { runNetlifyHandler } from './_lib/vercel-adapter.js';

export default async function handler(req, res) {
  return runNetlifyHandler(req, res, netlifyHandler);
}
