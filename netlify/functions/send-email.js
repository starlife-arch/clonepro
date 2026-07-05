// netlify/functions/send-email.js
// Uses Nodemailer + Brevo SMTP (transactional emails)

import nodemailer from 'nodemailer';
import { formatSender, resolveSender, senderNameForAddress } from './_lib/senders.js';



const REQUIRED_FROM_BY_TYPE = {
  balance_adjustment: 'noreply@starlifeadvert.com',
  virtual_card_ready: 'cards@starlifeadvert.com',
  card_transaction: 'cards@starlifeadvert.com',
  investment_confirmed: 'investments@starlifeadvert.com',
  stake_confirmed: 'stakes@starlifeadvert.com',
  account_suspended: 'security@starlifeadvert.com',
  account_unsuspended: 'security@starlifeadvert.com',
  loan_rejected: 'loans@starlifeadvert.com',
  ticket_closed: 'support@starlifeadvert.com',
  kyc_submitted: 'verify@starlifeadvert.com',
  kyc_approved: 'verify@starlifeadvert.com',
  kyc_rejected: 'verify@starlifeadvert.com',
  campaign_selected: 'noreply@starlifeadvert.com',
  campaign_rejected: 'noreply@starlifeadvert.com',
};

const REQUIRED_FROM_NAME_BY_TYPE = {
  balance_adjustment: 'Starlife Advert',
  virtual_card_ready: 'Starlife Advert Cards',
  card_transaction: 'Starlife Advert Cards',
  investment_confirmed: 'Starlife Advert Investments',
  stake_confirmed: 'Starlife Shareholder Program',
  account_suspended: 'Starlife Advert Security',
  account_unsuspended: 'Starlife Advert Security',
  loan_rejected: 'Starlife Advert Loans',
  ticket_closed: 'Starlife Advert Support',
  kyc_submitted: 'Starlife Advert Verify',
  kyc_approved: 'Starlife Advert Verify',
  kyc_rejected: 'Starlife Advert Verify',
  campaign_selected: 'Starlife Advert',
  campaign_rejected: 'Starlife Advert',
};

function hardcodedSender(type) {
  const addr = REQUIRED_FROM_BY_TYPE[type];
  if (!addr) return null;
  const name = senderNameForAddress(addr, REQUIRED_FROM_NAME_BY_TYPE[type]);
  return formatSender(name, addr);
}

const DEFAULT_FROM_KEY_FOR_TYPE = {
  otp: 'verify',
  welcome: 'verify',
  deposit_pending: 'deposits',
  deposit_approved: 'deposits',
  deposit_rejected: 'deposits',
  withdrawal_pending: 'withdrawals',
  withdrawal_approved: 'withdrawals',
  withdrawal_rejected: 'withdrawals',
  transaction_notice: 'transfers',
  starlife_credit: 'noreply',
  purchase_confirmation: 'cards',
  p2p_trade: 'p2p',
  account_suspended: 'security',
  account_unsuspended: 'security',
  ticket_created: 'support',
  ticket_reply: 'support',
  ticket_closed: 'support',
  investment_adjustment: 'investments',
  stake_adjustment: 'stakes',
  funds_held: 'noreply',
  funds_released: 'noreply',
  loan_limit_updated: 'loans',
  loan_approved: 'loans',
  loan_repaid: 'loans',
  loan_overdue: 'loans',
  loan_penalty_applied: 'loans',
  card_blocked: 'cards',
  card_unblocked: 'cards',
  card_transaction: 'cards',
  blue_badge_subscribed: 'cards',
  campaign_selected: 'noreply',
  campaign_rejected: 'noreply',
  balance_adjustment: 'broadcast',
  virtual_card_ready: 'cards',
  investment_confirmed: 'investments',
  stake_confirmed: 'stakes',
  loan_rejected: 'loans',
  kyc_submitted: 'verify',
  kyc_approved: 'verify',
  kyc_rejected: 'verify',
  prediction_bet_placed: 'games',
  prediction_result_won: 'games',
  prediction_result_lost: 'games',
  free_prize_won: 'games',
  game_wallet_transfer_in: 'games',
  game_wallet_transfer_out: 'games',
  game_wallet_low_balance: 'games',
  battle_royale_win: 'games',
  battle_royale_result: 'games',
};

export default async (req, context) => {
  // 1. Security – verify the token sent by the proxy
  const token = req.headers.get('x-api-token');
  if (token !== process.env.EMAIL_API_TOKEN) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { type, to, data = {}, fromKey } = await req.json().catch(() => ({}));
  if (!to) {
    return new Response('Missing recipient', { status: 400 });
  }

  // 2. Create SMTP transporter using Brevo
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_PASS,
    },
  });

  // 3. Define email subject and HTML based on type
  const esc = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  const money = (amount, currency = 'USD') => `${esc(currency)} ${Number(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const appUrl = process.env.SITE_URL || process.env.URL || 'https://starlifeadvert.netlify.app';
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@starlifeadvert.com';
  const settlementEmail = process.env.SETTLEMENT_EMAIL || supportEmail;
  const brand = {
    name: 'Starlife Advert Us Agency',
    from: 'Starlife Advert',
    url: appUrl,
    supportEmail,
    settlementEmail,
  };

  const firstName = (value) => {
    const raw = String(value || '').trim();
    return raw ? raw.split(/\s+/)[0] : 'Member';
  };
  const greetingName = firstName(data.name || data.userName || 'Member');

  const fmtDateParts = (value) => {
    const dt = value ? new Date(value) : new Date();
    const safe = Number.isNaN(dt.getTime()) ? new Date() : dt;
    return {
      date: data.date || safe.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }),
      time: data.time || safe.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
      day: data.day || safe.toLocaleDateString('en-US', { weekday: 'long' }),
    };
  };
  const rows = (items) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:14px 0;background:#f8fbf9;border:1px solid #dce8df;border-radius:12px;overflow:hidden">${items.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `<tr><td style="padding:10px 12px;color:#53645a">${esc(label)}</td><td style="padding:10px 12px;text-align:right;font-weight:600">${esc(value)}</td></tr>`).join('')}</table>`;
  const txRows = (extra = []) => {
    const parts = fmtDateParts(data.timestamp);
    return rows([
      ['Transaction ID', data.transactionId || data.txId || data.tradeId],
      ['Amount', data.amountText || money(data.amount, data.currency || 'USD')],
      ['Date', parts.date],
      ['Time', parts.time],
      ['Day', parts.day],
      ...extra,
      ['Status', data.status],
    ]);
  };

  const layout = (title, body, preheader = '') => `
    <!doctype html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
      <title>${esc(title)}</title>
    </head>
    <body style="margin:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#17231b">
      <div style="display:none;max-height:0;overflow:hidden;color:transparent">${esc(preheader || title)}</div>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;padding:24px 12px">
        <tr><td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dce8df;box-shadow:0 10px 28px rgba(10,40,18,.08)">
            <tr><td style="background:linear-gradient(135deg,#073b1a,#0bbf58);padding:22px 24px;color:#fff">
              <div style="font-size:22px;font-weight:800;letter-spacing:.2px">${esc(brand.name)}</div>
              <div style="font-size:13px;opacity:.9;margin-top:4px">Secure member notification</div>
            </td></tr>
            <tr><td style="padding:26px 24px">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#073b1a">${esc(title)}</h1>
              ${body}
            </td></tr>
            <tr><td style="background:#f0f7f2;padding:16px 24px;color:#53645a;font-size:12px;line-height:1.6">
              Sent from ${esc(brand.name)}.<br>
              <a href="${esc(brand.url)}" style="color:#087d3a;text-decoration:none">Login</a> &nbsp;/&nbsp;
              <a href="mailto:${esc(brand.supportEmail)}" style="color:#087d3a;text-decoration:none">Support</a> &nbsp;/&nbsp;
              <a href="mailto:${esc(brand.settlementEmail)}" style="color:#087d3a;text-decoration:none">Contact Us</a>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>`;

  let subject = '';
  let html = '';

  switch (type) {
    case 'balance_adjustment': {
      const added = data.direction === 'add' || data.action === 'add' || data.type === 'add' || (data.direction !== 'deduct' && data.action !== 'deduct' && Number(data.amount || 0) >= 0);
      const actionWord = added ? 'added' : 'deducted';
      const amount = Math.abs(Number(data.amount || 0));
      subject = 'Your balance has been updated';
      html = layout('Balance updated', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(brand.name)} has ${actionWord} funds ${added ? 'to' : 'from'} your account balance.</p>
        ${rows([
          ['Action', actionWord],
          ['Amount', money(amount, data.currency || 'USD')],
          ['New Balance', money(data.newBalance, data.currency || 'USD')],
          ['Reason', data.reason || 'Admin adjustment'],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">If you have any questions about this update, please contact support.</p>
      `);
      break;
    }
    case 'virtual_card_ready': {
      subject = 'Your Virtual Card is Ready';
      html = layout('Your virtual card is ready', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your Starlife virtual card has been created successfully and is ready to use.</p>
        ${rows([
          ['Card Number', data.maskedNumber || ('**** **** **** ' + (data.last4 || '----'))],
          ['Expiry', data.expiry],
          ['Type', data.cardType || 'Virtual Card'],
          ['Activation Status', data.activationStatus || data.status || 'Active'],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">Use your card details and PIN only on trusted payment forms. Keep your CVV and PIN private, and manage card limits or blocking from your dashboard.</p>
      `);
      break;
    }
    case 'investment_confirmed':
    case 'stake_confirmed': {
      const isStake = type === 'stake_confirmed';
      subject = isStake ? 'Stake Confirmed' : 'Investment Confirmed';
      html = layout(subject, `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your ${isStake ? 'shareholder stake' : 'investment'} has been confirmed successfully.</p>
        ${rows([
          ['Plan Name', data.planName || (isStake ? 'Shareholder Stake' : '2% Daily Investment Plan')],
          ['Amount', money(data.amount, data.currency || 'USD')],
          ['Expected Returns', data.expectedReturns || (isStake ? 'Shareholder pool distributions' : '2% daily while active')],
          ['Start Date', data.startDate || fmtDateParts(data.timestamp).date],
          ['Maturity Date', data.maturityDate || (isStake ? '6-month earnings lock from first stake' : 'Open-ended while active')],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">You can track this from your dashboard at any time.</p>
      `);
      break;
    }
    case 'loan_rejected': {
      subject = 'Loan Application Unsuccessful';
      html = layout('Loan application unsuccessful', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">We’re sorry, but your loan application was not approved at this time.</p>
        ${rows([
          ['Loan Amount Requested', money(data.amount, data.currency || 'USD')],
          ['Rejection Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">You may contact support for more information or try again later when eligible.</p>
      `);
      break;
    }
    case 'kyc_submitted':
      subject = 'KYC Documents Received';
      html = layout('KYC documents received', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your KYC documents have been received and are now under review.</p>
        <p style="margin:0;font-size:15px;line-height:1.6">Typical review time is 24–48 hours. We’ll notify you when the review is complete.</p>
      `);
      break;
    case 'kyc_approved':
      subject = 'KYC Verification Approved ✓';
      html = layout('KYC verification approved', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Congratulations — your identity verification has been approved.</p>
        <p style="margin:0;font-size:15px;line-height:1.6">Your account is now fully verified and all eligible platform features are unlocked.</p>
      `);
      break;
    case 'kyc_rejected':
      subject = 'KYC Verification Unsuccessful';
      html = layout('KYC verification unsuccessful', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your KYC verification was rejected.</p>
        ${rows([['Reason', data.reason || 'The submitted documents could not be verified.']])}
        <p style="margin:0;font-size:15px;line-height:1.6">Please resubmit clear and correct documents from your Profile so our team can review them again.</p>
      `);
      break;
    case 'otp': {
      subject = `${data.actionLabel || 'Starlife'} verification code`;
      html = layout('Your verification code', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Dear ${esc(greetingName)},</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6">Use this one-time code to continue with <strong>${esc(data.actionLabel || 'your request')}</strong>.</p>
        <div style="font-size:34px;letter-spacing:8px;font-weight:800;text-align:center;background:#eefaf1;border:1px dashed #0bbf58;border-radius:12px;padding:16px;color:#073b1a">${esc(data.code)}</div>
        <p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#5b6c62">This code expires in <strong>3 minutes</strong>, can be used once, and should never be shared with anyone. If you did not request it, please contact support immediately.</p>
      `, 'Your Starlife one-time verification code expires in 3 minutes.');
      break;
    }
    case 'welcome':
      subject = 'Welcome to Starlife Advert!';
      html = layout('Welcome to Starlife Advert', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Dear ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Thank you for joining ${esc(brand.name)}. Your account is ready.</p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.6">Start investing, track your activity, and keep your account protected with your withdrawal PIN and email OTP.</p>
        <p style="margin:0"><a href="${esc(brand.url)}" style="display:inline-block;background:#0bbf58;color:#fff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700">Go to Dashboard →</a></p>
      `);
      break;
    case 'deposit_pending': {
      subject = 'Deposit Confirmation – Pending Approval';
      html = layout('Deposit confirmation', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">We received your deposit request. It is pending verification.</p>
        ${txRows([
          ['Payment Method', data.method],
          ['User Reference', data.userReference || data.reference || data.transactionId],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">We will notify you once it is approved.</p>
      `);
      break;
    }
    case 'deposit_approved':
      subject = 'Deposit Approved!';
      html = layout('Deposit approved', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your deposit has been approved and added to your balance.</p>
        ${txRows([
          ['Payment Method', data.method],
          ['User Reference', data.userReference || data.reference],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">You can now continue using Starlife services.</p>
      `);
      break;
    case 'deposit_rejected':
      subject = 'Deposit Update';
      html = layout('Deposit update', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your deposit was rejected.</p>
        ${txRows([
          ['Payment Method', data.method],
          ['User Reference', data.userReference || data.reference],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">Reason: ${esc(data.reason || 'Please contact support for more information.')}</p>
      `);
      break;
    case 'withdrawal_pending': {
      subject = 'Withdrawal Details';
      html = layout('Withdrawal details', `
        <p style="margin:0 0 14px;font-size:15px;line-height:1.6">Dear ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(brand.name)} has received your withdrawal request.</p>
        ${txRows([
          ['Withdrawal Method', data.method],
          ['Destination Details', data.destination || data.detailsMasked || data.details],
          ['Net Amount', money(data.net || data.amount, data.currency || 'USD')],
        ])}
        <p style="margin:0 0 10px;font-size:15px;line-height:1.6">Settlement is processed in <strong>T + 48 hours</strong> excluding Saturday, Sunday and Holidays.</p>
        <p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#6a5b00"><strong>Note:</strong> Bank charges may apply depending on your withdrawal method or receiving institution.</p>
        <p style="margin:0;font-size:14px;line-height:1.6">For settlement queries, please contact <a href="mailto:${esc(brand.supportEmail)}" style="color:#087d3a">${esc(brand.supportEmail)}</a>.</p>
      `);
      break;
    }
    case 'withdrawal_approved':
      subject = 'Withdrawal Processed';
      html = layout('Withdrawal processed', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your withdrawal has been marked as paid.</p>
        ${txRows([
          ['Withdrawal Method', data.method],
          ['Destination Details', data.destination || data.detailsMasked || data.details],
        ])}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6a5b00">Bank charges may apply. Settlement timelines exclude Saturday, Sunday and Holidays.</p>
      `);
      break;
    case 'withdrawal_rejected':
      subject = 'Withdrawal Update';
      html = layout('Withdrawal update', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your withdrawal request was rejected and refunded where applicable.</p>
        ${txRows([
          ['Withdrawal Method', data.method],
          ['Destination Details', data.destination || data.detailsMasked || data.details],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">Reason: ${esc(data.reason || 'Please contact support.')}</p>
      `);
      break;
    case 'transaction_notice': {
      const direction = data.direction === 'received' ? 'received' : 'sent';
      subject = direction === 'received' ? 'Payment Received' : 'Payment Sent';
      html = layout(subject, `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${direction === 'received' ? `You received a ${esc(data.transactionType || 'transaction')}.` : `You sent a ${esc(data.transactionType || 'transaction')}.`}</p>
        ${txRows([
          [direction === 'received' ? 'Received From' : 'Sent To', data.counterparty],
          ['Transaction Type', data.transactionType],
        ])}
      `);
      break;
    }
    case 'starlife_credit':
      subject = 'Starlife Account Credit';
      html = layout('Starlife account credit', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Starlife credited your account.</p>
        ${txRows([['Reason', data.reason], ['Updated Status', data.status || 'Credited']])}
      `);
      break;
    case 'purchase_confirmation':
      subject = `${data.purchaseType || 'Purchase'} Confirmation`;
      html = layout('Purchase confirmation', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your purchase has been completed.</p>
        ${txRows([['Purchase Type', data.purchaseType], ['Purchase Status', data.status || 'Completed']])}
      `);
      break;
    case 'p2p_trade':
      subject = data.subject || 'P2P Trade Update';
      html = layout(data.title || 'P2P trade update', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(data.message || 'Your P2P trade has been updated.')}</p>
        ${txRows([
          ['Trade ID', data.tradeId],
          ['Buy or Sell', data.side],
          ['Asset', data.asset || 'USD'],
        ])}
      `);
      break;
    case 'account_suspended':
      subject = 'Your Account Has Been Suspended';
      html = layout('Account suspended', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your account has been suspended.</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Reason: ${esc(data.reason || 'Policy violation')}</p>
        <p style="margin:0;font-size:15px;line-height:1.6">Please contact support for assistance.</p>
      `);
      break;
    case 'account_unsuspended':
      subject = 'Your Account Has Been Reinstated';
      html = layout('Account restored', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0;font-size:15px;line-height:1.6">Your account is active again and you can log in.</p>
      `);
      break;
    case 'ticket_created': {
      subject = `Support Ticket Created — ${data.ticketId}`;
      html = layout('We received your support request', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Dear ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Thank you for contacting ${esc(brand.name)} Support.</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6">
          Your support ticket has been created with the ID <strong>${esc(data.ticketId)}</strong>
          and the subject "<strong>${esc(data.subject)}</strong>". Our support team will review it and respond shortly.
        </p>
        ${rows([
          ['Ticket ID', data.ticketId],
          ['Subject', data.subject],
          ['Severity', data.severity],
        ])}
        <div style="margin:14px 0;padding:14px;background:#f8fbf9;border:1px solid #dce8df;border-radius:12px">
          <div style="font-size:12px;color:#53645a;margin-bottom:6px">Your message:</div>
          <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(data.message || '—')}</div>
        </div>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6">
          You can send follow-up messages or ask further questions simply by <strong>replying to this email</strong>.
        </p>
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6a5b00">
          You can also track this ticket from the "My Tickets" section in your dashboard.
        </p>
      `, `Your Starlife support ticket ${data.ticketId} has been created.`);
      break;
    }
    case 'ticket_reply': {
      subject = `Re: Support Ticket ${data.ticketId} — ${data.subject}`;
      html = layout('New reply on your support ticket', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Dear ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Our support team replied to your ticket <strong>${esc(data.ticketId)}</strong>:</p>
        <div style="margin:14px 0;padding:14px;background:#eefaf1;border:1px solid #0bbf58;border-radius:12px">
          <div style="font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(data.replyText || '')}</div>
        </div>
        <p style="margin:0;font-size:15px;line-height:1.6">Reply to this email to continue the conversation, or open "My Tickets" in your dashboard.</p>
      `, `New reply on ticket ${data.ticketId}`);
      break;
    }
    case 'ticket_closed': {
      subject = `Your Support Ticket Has Been Closed — #${data.ticketId}`;
      html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#1a1a2e;padding:30px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;">Starlife Advert</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 30px;">
              <h2 style="color:#1a1a2e;margin-top:0;">Support Ticket Closed</h2>
              <p style="color:#555555;font-size:15px;line-height:1.6;">Hi ${esc(greetingName)},</p>
              <p style="color:#555555;font-size:15px;line-height:1.6;">Your support ticket <strong>#${esc(data.ticketId)}</strong> regarding <strong>"${esc(data.subject || data.category || 'your request')}"</strong> has been closed by our team.</p>
              <p style="color:#555555;font-size:15px;line-height:1.6;">We hope your issue was resolved to your satisfaction. If you still need help or feel this was closed in error, please open a new ticket.</p>
              <p style="color:#555555;font-size:15px;line-height:1.6;">Warm regards,<br><strong>The Support Team</strong><br>Starlife Advert</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#f4f4f4;padding:20px;text-align:center;">
              <p style="color:#999999;font-size:12px;margin:0;">© 2025 Starlife Advert. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
      break;
    }
    case 'funds_held':
      subject = 'A Hold Was Placed On Your Balance';
      html = layout('Funds on hold', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(brand.name)} has placed a hold on part of your balance.</p>
        ${rows([
          ['Amount Held', money(data.amount, data.currency || 'USD')],
          ['Reason', data.reason || 'Account review'],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">Contact support if you have questions about this hold.</p>
      `);
      break;
    case 'funds_released':
      subject = 'Held Funds Released';
      html = layout('Funds released', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">The hold on your balance has been released and the funds are now available.</p>
        ${rows([
          ['Amount Released', money(data.amount, data.currency || 'USD')],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
      `);
      break;
    case 'investment_adjustment':
    case 'stake_adjustment': {
      const isStake = type === 'stake_adjustment';
      const verb = data.direction === 'add' ? 'added to' : 'deducted from';
      subject = `${isStake ? 'Shareholder Stake' : 'Investment'} Adjustment`;
      html = layout(`${isStake ? 'Shareholder stake' : 'Investment'} adjustment`, `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
          ${money(data.amount, data.currency || 'USD')} has been ${verb} your ${isStake ? 'shareholder stake' : 'investment balance'} by ${esc(brand.name)}.
        </p>
        ${rows([
          ['New Total', money(data.newTotal, data.currency || 'USD')],
          ['Reason', data.reason || '—'],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
      `);
      break;
    }
    case 'loan_limit_updated': {
      const action = data.action || 'updated';
      subject = 'Your Loan Limit Has Been Updated';
      html = layout('Loan limit update', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(brand.name)} has ${esc(action)} your loan limit.</p>
        ${rows([
          ['Previous Limit', data.oldLimit != null ? money(data.oldLimit, data.currency || 'USD') : 'Default (investment-based)'],
          ['New Limit', data.newLimit != null ? money(data.newLimit, data.currency || 'USD') : 'Default (investment-based)'],
          ['Reason', data.reason || '—'],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
      `);
      break;
    }
    case 'loan_approved':
      subject = 'Loan Approved & Disbursed';
      html = layout('Loan approved', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your loan has been approved and disbursed to your balance.</p>
        ${rows([
          ['Loan Amount', money(data.amount, 'USD')],
          ['Interest (deducted upfront)', money(data.interest, 'USD')],
          ['Amount Received', money(data.receive, 'USD')],
          ['Term', `${data.term} days`],
          ['Due Date', data.dueDate ? new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) : '—'],
        ])}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6a5b00">Repay by the due date to avoid a 5% late fee per 7 days overdue.</p>
      `);
      break;
    case 'loan_repaid':
      subject = 'Loan Repaid';
      html = layout('Loan repaid', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your loan has been marked as repaid. Thank you!</p>
        ${rows([
          ['Amount Repaid', money(data.amount, 'USD')],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
        <p style="margin:0;font-size:15px;line-height:1.6">Withdrawal restrictions related to this loan (if any) have been lifted.</p>
      `);
      break;
    case 'loan_overdue':
      subject = 'Your Loan Is Overdue';
      html = layout('Loan payment overdue', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your loan of ${money(data.amount, 'USD')} was due on ${data.dueDate ? new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: '2-digit' }) : '—'} and is now overdue.</p>
        <p style="margin:0;font-size:15px;line-height:1.6">Please repay as soon as possible to avoid late fees (5% of the loan amount per 7 days overdue) and withdrawal restrictions.</p>
      `);
      break;
    case 'loan_penalty_applied': {
      subject = 'Late Fee Applied to Your Loan';
      html = layout('Your loan is overdue', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your loan is overdue and a 5% late fee has been applied for each 7-day period past the due date.</p>
        ${rows([
          ['Principal', money(data.principal, 'USD')],
          ['Days Late', data.daysLate],
          ['Late Fee', money(data.penalty, 'USD')],
          ['Total Now Owed', money(data.totalOwed, 'USD')],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
        <p style="margin:0;font-size:14px;line-height:1.6;color:#6a5b00">Withdrawals remain restricted until this loan is repaid. Repeated late payments may restrict future loan access.</p>
      `);
      break;
    }
    case 'card_blocked':
    case 'card_unblocked': {
      const blocked = type === 'card_blocked';
      subject = blocked ? 'Your Virtual Card Has Been Blocked' : 'Your Virtual Card Has Been Unblocked';
      html = layout(subject, `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">
          ${blocked
            ? `Your virtual card ending in <strong>${esc(data.last4 || '----')}</strong> has been blocked by ${esc(brand.name)}.`
            : `Your virtual card ending in <strong>${esc(data.last4 || '----')}</strong> has been unblocked.`}
        </p>
        ${rows([
          ['Card', '**** **** **** ' + esc(data.last4 || '----')],
          ['Action By', data.actionBy === 'admin' ? 'Starlife Support' : 'You'],
          ['Reason', data.reason || '—'],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
        ])}
        ${blocked ? `<p style="margin:0;font-size:14px;line-height:1.6;color:#6a5b00">If this block was placed by ${esc(brand.name)}, please contact support before unblocking it yourself.</p>` : ''}
      `);
      break;
    }
    case 'card_transaction':
      subject = 'Card Transaction Alert';
      html = layout('Card transaction', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">A transaction was made using your virtual card ending in <strong>${esc(data.last4 || '----')}</strong>.</p>
        ${rows([
          ['Merchant', data.merchant || data.description || 'Starlife'],
          ['Amount', data.amountText || money(data.amount, data.currency || 'USD')],
          ['Date', fmtDateParts(data.timestamp).date],
          ['Time', fmtDateParts(data.timestamp).time],
          ['Remaining Card Balance', data.remainingBalance != null ? money(data.remainingBalance, data.currency || 'USD') : 'See dashboard'],
          ['Status', data.status || 'Completed'],
        ])}
      `);
      break;
    case 'blue_badge_subscribed':
      subject = 'Blue Badge Activated';
      html = layout('Blue badge activated', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Your Blue Badge subscription is now active. Thanks for supporting ${esc(brand.name)}!</p>
        ${txRows([['Plan', data.plan || 'Monthly']])}
      `);
      break;


    case 'prediction_bet_placed':
    case 'prediction_result_won':
    case 'prediction_result_lost': {
      const isPlaced = type === 'prediction_bet_placed';
      const isWon = type === 'prediction_result_won';
      const sportEmoji = (sport, eventType) => {
        if (eventType === 'platform') return '🔮';
        const key = String(sport || '').toLowerCase();
        if (key.includes('football') || key.includes('soccer')) return '⚽';
        if (key.includes('basketball')) return '🏀';
        if (key.includes('tennis')) return '🎾';
        if (key.includes('rugby')) return '🏉';
        if (key.includes('cricket')) return '🏏';
        if (key.includes('boxing') || key.includes('mma')) return '🥊';
        return '🏆';
      };
      const emoji = sportEmoji(data.sport, data.eventType);
      const winningLabel = data.winningOutcomeLabel || data.resultLabel || data.result || '—';
      const isDraw = String(winningLabel).toLowerCase() === 'draw';
      const resultText = data.eventType === 'platform' ? `Result: ${winningLabel}` : `Full Time Result: ${isDraw ? 'Draw' : `${winningLabel} Won`}`;
      subject = isPlaced ? '🔮 Prediction bet confirmed' : isWon ? '🏆 Your prediction won!' : '😔 Not this time';
      const title = isPlaced ? '🔮 Bet Confirmed' : isWon ? '🏆 You Won!' : '😔 Not This Time';
      const actionUrl = esc(data.actionUrl || brand.url);
      const supportHref = `mailto:${esc(brand.supportEmail)}`;
      const matchup = data.eventType === 'sports' && (data.homeTeam || data.awayTeam) ? `${data.homeTeam || 'Home Team'} vs ${data.awayTeam || 'Away Team'}` : (data.eventTitle || 'Prediction Event');
      const matchCard = (rows) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:#13091f;border:1px solid #5e338d;border-radius:14px;overflow:hidden"><tr><td style="padding:20px 18px;text-align:center;border-bottom:1px solid #5e338d"><div style="font-size:18px;font-weight:900;color:#fff">${esc(emoji)} &nbsp;${esc(matchup)}</div>${data.competition ? `<div style="margin-top:6px;color:#bda9d6;font-size:13px">${esc(data.competition)}</div>` : ''}<div style="margin-top:14px;color:#ffd700;font-weight:900">${esc(resultText)}</div></td></tr>${rows.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `<tr><td style="padding:0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:10px 14px;color:#bda9d6;width:42%">${esc(label)}</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#f9e9ff">${esc(value)}</td></tr></table></td></tr>`).join('')}</table>`;
      const placedRows = (items) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0;background:#13091f;border:1px solid #4b2a73;border-radius:12px;overflow:hidden">${items.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `<tr><td style="padding:10px 12px;color:#bda9d6">${esc(label)}</td><td style="padding:10px 12px;text-align:right;font-weight:700;color:#ffd700">${esc(value)}</td></tr>`).join('')}</table>`;
      const body = isPlaced ? `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Your prediction has been placed successfully.</p>
        ${placedRows([
          ['Event', data.eventTitle], ['Your Pick', data.outcomeLabel], ['Odds', `${Number(data.odds || 0).toFixed(2)}x`],
          ['Bet Amount', `$${Number(data.betAmount || 0).toFixed(2)}`], ['Potential Win', `$${Number(data.potentialPayout || 0).toFixed(2)}`], ['Closes', data.bettingDeadline]
        ])}
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#f3eaff">Good luck! Results will be announced after the event.</p>
        <a href="${actionUrl}" style="display:inline-block;background:#ffd700;color:#170d05;text-decoration:none;font-weight:800;border-radius:10px;padding:10px 14px">View My Bets →</a> <a href="${supportHref}" style="color:#ffd700;margin-left:12px">Support</a>` : isWon ? `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Your prediction on ${esc(data.eventTitle || 'this event')} was correct!</p>
        ${matchCard([['Your Pick', data.outcomeLabel], ['Odds', `${Number(data.odds || 0).toFixed(2)}x`], ['Bet Amount', `$${Number(data.betAmount || 0).toFixed(2)}`], ['Payout', `$${Number(data.netPayout || data.payout || 0).toFixed(2)}`], ['Date', data.settledAt]])}
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#f3eaff">$${Number(data.netPayout || data.payout || 0).toFixed(2)} has been added to your Game Wallet. 🎉</p>
        <a href="${actionUrl}" style="display:inline-block;background:#ffd700;color:#170d05;text-decoration:none;font-weight:800;border-radius:10px;padding:10px 14px">View Game Wallet →</a> <a href="${supportHref}" style="color:#ffd700;margin-left:12px">Support</a>` : `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Here's how ${esc(data.eventTitle || 'this event')} turned out:</p>
        ${matchCard([['Your Pick', data.outcomeLabel], ['Odds', `${Number(data.odds || 0).toFixed(2)}x`], ['Bet Amount', `$${Number(data.betAmount || 0).toFixed(2)}`], ['Result', `❌ ${data.outcomeLabel || 'Your pick'} did not win`], ['Date', data.settledAt]])}
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#f3eaff">Don't give up — more events are waiting for your prediction.</p>
        <a href="${actionUrl}" style="display:inline-block;background:#ffd700;color:#170d05;text-decoration:none;font-weight:800;border-radius:10px;padding:10px 14px">View Predictions →</a> <a href="${supportHref}" style="color:#ffd700;margin-left:12px">Support</a>`;
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;color:#f3eaff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0d0d;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0d0d0d;border-radius:16px;overflow:hidden;border:1px solid #4b2a73;box-shadow:0 10px 28px rgba(0,0,0,.35)"><tr><td style="background:#1a0a2e;padding:22px 24px;color:#fff;border-bottom:3px solid #ffd700"><div style="font-size:22px;font-weight:900;color:#ffd700">Starlife Games · Predictions</div></td></tr><tr><td style="padding:26px 24px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#ffd700">${esc(title)}</h1>${body}</td></tr><tr><td style="background:#1a0a2e;padding:16px 24px;color:#bda9d6;font-size:12px;line-height:1.6">Sent from Starlife Games · games@starlifeadvert.com<br><a href="${esc(brand.url)}" style="color:#ffd700;text-decoration:none">Login</a> &nbsp;/&nbsp; <a href="mailto:${esc(brand.supportEmail)}" style="color:#ffd700;text-decoration:none">Support</a></td></tr></table></td></tr></table></body></html>`;
      break;
    }

    case 'free_prize_won': {
      subject = '🎁 You won a free prize prediction!';
      const actionUrl = esc(data.actionUrl || brand.url);
      const supportHref = `mailto:${esc(brand.supportEmail)}`;
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;color:#f3eaff"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0d0d;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0d0d0d;border-radius:16px;overflow:hidden;border:1px solid #4b2a73;box-shadow:0 10px 28px rgba(0,0,0,.35)"><tr><td style="background:#1a0a2e;padding:22px 24px;color:#fff;border-bottom:3px solid #ffd700"><div style="font-size:22px;font-weight:900;color:#ffd700">Starlife Games · Predictions</div></td></tr><tr><td style="padding:26px 24px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#ffd700">🎁 You Won a Free Prize!</h1><p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Hi ${esc(greetingName)},</p><p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3eaff">Your prediction on ${esc(data.title || data.eventTitle || 'this event')} was correct!</p><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:18px 0;background:#13091f;border:1px solid #5e338d;border-radius:14px;overflow:hidden"><tr><td style="padding:10px 14px;color:#bda9d6">Question</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#f9e9ff">${esc(data.title || data.eventTitle)}</td></tr><tr><td style="padding:10px 14px;color:#bda9d6">Your Answer</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#f9e9ff">${esc(data.outcomeLabel)}</td></tr><tr><td style="padding:10px 14px;color:#bda9d6">Result</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#ffd700">✅ Correct!</td></tr><tr><td style="padding:10px 14px;color:#bda9d6">Prize</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#ffd700">$${Number(data.prizePerWinner || 0).toFixed(2)}</td></tr><tr><td style="padding:10px 14px;color:#bda9d6">Winners</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#f9e9ff">${Number(data.correctCount || 0)} predictors</td></tr><tr><td style="padding:10px 14px;color:#bda9d6">Date</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#f9e9ff">${esc(data.settledAt)}</td></tr></table><p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#f3eaff">$${Number(data.prizePerWinner || 0).toFixed(2)} has been added to your Game Wallet. 🎉</p><a href="${actionUrl}" style="display:inline-block;background:#ffd700;color:#170d05;text-decoration:none;font-weight:800;border-radius:10px;padding:10px 14px">View Game Wallet →</a> <a href="${supportHref}" style="color:#ffd700;margin-left:12px">Support</a></td></tr><tr><td style="background:#1a0a2e;padding:16px 24px;color:#bda9d6;font-size:12px;line-height:1.6">Sent from Starlife Games · games@starlifeadvert.com</td></tr></table></td></tr></table></body></html>`;
      break;
    }

    case 'battle_royale_win':
    case 'battle_royale_result': {
      const won = type === 'battle_royale_win';
      subject = won ? '👑 You won Battle Royale!' : '⚔️ Battle Royale complete';
      const title = won ? '👑 Battle Royale Winner' : '⚔️ Battle Royale Result';
      const payout = Number(data.payout || data.cashAwarded || 0);
      const points = Number(data.pointsAwarded || 0);
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;color:#f3fff8"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0d0d;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0d0d0d;border-radius:16px;overflow:hidden;border:1px solid #ffd700"><tr><td style="background:#1a1a2e;padding:22px 24px;border-bottom:3px solid #ffd700"><div style="font-size:22px;font-weight:900;color:#ffd700">Starlife Games · Battle Royale</div></td></tr><tr><td style="padding:26px 24px"><h1 style="margin:0 0 16px;color:#ffd700">${esc(title)}</h1><p style="line-height:1.6">Hi ${esc(greetingName)},</p><p style="line-height:1.6">${won ? `You survived the arena! ${payout ? `$${payout.toFixed(2)} was added to your Game Wallet.` : ''} ${points ? `${points} points were added to your account.` : ''}` : `Better luck next time — ${esc(data.winner || 'a warrior')} won this battle.`}</p><a href="${esc(data.actionUrl || brand.url)}" style="display:inline-block;background:#ffd700;color:#170d05;text-decoration:none;font-weight:900;border-radius:10px;padding:10px 14px">Open Games →</a></td></tr><tr><td style="background:#1a1a2e;padding:16px 24px;color:#a7f3d0;font-size:12px">Sent from Starlife Games · games@starlifeadvert.com</td></tr></table></td></tr></table></body></html>`;
      break;
    }

    case 'game_wallet_transfer_in':
    case 'game_wallet_transfer_out':
    case 'game_wallet_low_balance': {
      const isIn = type === 'game_wallet_transfer_in';
      const isOut = type === 'game_wallet_transfer_out';
      subject = isIn ? '💰 Funds Added to Game Wallet' : isOut ? '↩ Funds Withdrawn from Game Wallet' : '⚠️ Game Wallet Running Low';
      const title = isIn ? '💰 Funds Added to Game Wallet' : isOut ? '↩ Funds Withdrawn from Game Wallet' : '⚠️ Game Wallet Running Low';
      const parts = fmtDateParts(data.timestamp || new Date().toISOString());
      const gameRows = (items) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:16px 0;background:#111827;border:1px solid #00ff88;border-radius:12px;overflow:hidden">${items.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([label, value]) => `<tr><td style="padding:10px 12px;color:#a7f3d0">${esc(label)}</td><td style="padding:10px 12px;text-align:right;font-weight:800;color:#00ff88">${esc(value)}</td></tr>`).join('')}</table>`;
      const actionUrl = esc(data.actionUrl || brand.url);
      const supportHref = `mailto:${esc(brand.supportEmail)}`;
      const body = isIn ? `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3fff8">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3fff8">$${Number(data.amount || 0).toFixed(2)} has been added to your Game Wallet.</p>
        ${gameRows([['Amount Added', `$${Number(data.amount || 0).toFixed(2)}`], ['Game Wallet', `$${Number(data.newBalance || 0).toFixed(2)}`], ['Date', data.date || parts.date], ['Time', data.time || parts.time]])}
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#f3fff8">Good luck! 🎮</p>
        <a href="${actionUrl}" style="display:inline-block;background:#00ff88;color:#04130b;text-decoration:none;font-weight:900;border-radius:10px;padding:10px 14px">Play Now →</a> <a href="${supportHref}" style="color:#00ff88;margin-left:12px">Support</a>` : isOut ? `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3fff8">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3fff8">$${Number(data.amount || 0).toFixed(2)} has been returned to your main wallet.</p>
        ${gameRows([['Amount Withdrawn', `$${Number(data.amount || 0).toFixed(2)}`], ['Game Wallet', `$${Number(data.newBalance || 0).toFixed(2)}`], ['Main Wallet', `$${Number(data.mainBalance || data.mainBal || 0).toFixed(2)}`], ['Date', data.date || parts.date]])}
        <a href="${actionUrl}" style="display:inline-block;background:#00ff88;color:#04130b;text-decoration:none;font-weight:900;border-radius:10px;padding:10px 14px">View Wallet</a> <a href="${supportHref}" style="color:#00ff88;margin-left:12px">Support</a>` : `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3fff8">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#f3fff8">Your Game Wallet balance is $${Number(data.balance || 0).toFixed(2)}.<br>Add funds to continue playing.</p>
        <a href="${actionUrl}" style="display:inline-block;background:#00ff88;color:#04130b;text-decoration:none;font-weight:900;border-radius:10px;padding:10px 14px">+ Add Funds Now →</a> <a href="${supportHref}" style="color:#00ff88;margin-left:12px">Support</a>`;
      html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:#0d0d0d;font-family:Arial,Helvetica,sans-serif;color:#f3fff8"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0d0d0d;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#0d0d0d;border-radius:16px;overflow:hidden;border:1px solid #00ff88;box-shadow:0 10px 28px rgba(0,0,0,.35)"><tr><td style="background:#1a1a2e;padding:22px 24px;color:#fff;border-bottom:3px solid #00ff88"><div style="font-size:22px;font-weight:900;color:#00ff88">Starlife Games · Game Wallet</div><div style="font-size:13px;opacity:.9;margin-top:4px">games@starlifeadvert.com</div></td></tr><tr><td style="padding:26px 24px"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.25;color:#00ff88">${esc(title)}</h1>${body}</td></tr><tr><td style="background:#1a1a2e;padding:16px 24px;color:#a7f3d0;font-size:12px;line-height:1.6">Sent from Starlife Games · games@starlifeadvert.com<br><a href="${esc(brand.url)}" style="color:#00ff88;text-decoration:none">Login</a> &nbsp;/&nbsp; <a href="mailto:${esc(brand.supportEmail)}" style="color:#00ff88;text-decoration:none">Support</a></td></tr></table></td></tr></table></body></html>`;
      break;
    }


    case 'campaign_selected':
    case 'campaign_rejected': {
      const selected = type === 'campaign_selected';
      const campaignDate = fmtDateParts(data.timestamp).date;
      const rewardSummary = data.rewardSummary || 'To be confirmed';
      const rejectionMessage = `Thank you for applying to ${data.campaignTitle || 'this campaign'}. Unfortunately you were not selected this time. We encourage you to keep an eye out for future campaigns on Starlife.`;
      subject = selected ? `Selected for ${data.campaignTitle || 'campaign'}` : `Application update for ${data.campaignTitle || 'campaign'}`;
      html = layout(selected ? 'Campaign application selected' : 'Campaign application update', `
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">Hi ${esc(greetingName)},</p>
        <p style="margin:0 0 12px;font-size:15px;line-height:1.6">${esc(selected ? (data.message || 'Congratulations! Your campaign application was selected.') : rejectionMessage)}</p>
        ${selected ? rows([
          ['Campaign', data.campaignTitle || 'Campaign'],
          ['What you will receive', rewardSummary],
          ['Delivery', data.rewardDelivery || 'To be confirmed'],
          ['Date', campaignDate],
        ]) : rows([
          ['Campaign', data.campaignTitle || 'Campaign'],
          ['Date', campaignDate],
        ])}
        ${selected && data.rewardNotes ? `<p style="margin:0 0 12px;font-size:15px;line-height:1.6"><strong>Note:</strong> ${esc(data.rewardNotes)}</p>` : ''}
        ${selected ? '<p style="margin:0;font-size:15px;line-height:1.6">The platform team will be in touch with next steps.</p>' : `<p style="margin:0;font-size:15px;line-height:1.6">${esc(rejectionMessage)}</p>`}
      `);
      break;
    }
    default:
      subject = 'Update from Starlife';
      html = layout('Update from Starlife', `<p style="margin:0;font-size:15px;line-height:1.6">${esc(data.message || 'Please check your Starlife dashboard for updates.')}</p>`);
  }

  // 4. Send the email
  try {
    await transporter.sendMail({
      from: hardcodedSender(type) || resolveSender(fromKey || DEFAULT_FROM_KEY_FOR_TYPE[type] || 'noreply'),
      to,
      subject,
      html,
      replyTo: data.replyTo || process.env.SUPPORT_EMAIL || 'support@starlifeadvert.com',
      headers: { 'Content-Type': 'text/html; charset=UTF-8' },
    });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    console.error('SMTP send error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
