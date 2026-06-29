const DEFAULT_SENDER_NAME = 'Starlife Advert';
const DEFAULT_SENDER_ADDR = 'noreply@starlifeadvert.com';

const SENDER_NAME_BY_ADDRESS = {
  'noreply@starlifeadvert.com': 'Starlife Advert',
  'cards@starlifeadvert.com': 'Starlife Advert Cards',
  'investments@starlifeadvert.com': 'Starlife Advert Investments',
  'security@starlifeadvert.com': 'Starlife Advert Security',
  'loans@starlifeadvert.com': 'Starlife Advert Loans',
  'support@starlifeadvert.com': 'Starlife Advert Support',
  'verify@starlifeadvert.com': 'Starlife Advert Verify',
  'deposits@starlifeadvert.com': 'Starlife Advert Deposits',
  'withdrawals@starlifeadvert.com': 'Starlife Advert Withdrawals',
  'transfers@starlifeadvert.com': 'Starlife Advert Transfers',
  'news@starlifeadvert.com': 'Starlife Advert News',
  'stakes@starlifeadvert.com': 'Starlife Shareholder Program',
  'p2p@starlifeadvert.com': 'Starlife P2P Trading',
  'games@starlifeadvert.com': 'Starlife Games',
};

const SENDER_MAP = {
  noreply:     { addrEnv: 'MAIL_FROM',             nameEnv: 'MAIL_NAME',             defaultName: 'Starlife Advert', defaultAddr: 'noreply@starlifeadvert.com' },
  support:     { addrEnv: 'MAIL_FROM_SUPPORT',     nameEnv: 'MAIL_NAME_SUPPORT',     defaultName: 'Starlife Advert Support', defaultAddr: 'support@starlifeadvert.com' },
  deposits:    { addrEnv: 'MAIL_FROM_DEPOSITS',    nameEnv: 'MAIL_NAME_DEPOSITS',    defaultName: 'Starlife Advert Deposits', defaultAddr: 'deposits@starlifeadvert.com' },
  withdrawals: { addrEnv: 'MAIL_FROM_WITHDRAWALS', nameEnv: 'MAIL_NAME_WITHDRAWALS', defaultName: 'Starlife Advert Withdrawals', defaultAddr: 'withdrawals@starlifeadvert.com' },
  investments: { addrEnv: 'MAIL_FROM_INVESTMENTS', nameEnv: 'MAIL_NAME_INVESTMENTS', defaultName: 'Starlife Advert Investments', defaultAddr: 'investments@starlifeadvert.com' },
  stakes:      { addrEnv: 'MAIL_FROM_STAKES',      nameEnv: 'MAIL_NAME_STAKES',      defaultName: 'Starlife Shareholder Program', defaultAddr: 'stakes@starlifeadvert.com' },
  loans:       { addrEnv: 'MAIL_FROM_LOANS',       nameEnv: 'MAIL_NAME_LOANS',       defaultName: 'Starlife Advert Loans', defaultAddr: 'loans@starlifeadvert.com' },
  transfers:   { addrEnv: 'MAIL_FROM_TRANSFERS',   nameEnv: 'MAIL_NAME_TRANSFERS',   defaultName: 'Starlife Advert Transfers', defaultAddr: 'transfers@starlifeadvert.com' },
  p2p:         { addrEnv: 'MAIL_FROM_P2P',         nameEnv: 'MAIL_NAME_P2P',         defaultName: 'Starlife P2P Trading', defaultAddr: 'p2p@starlifeadvert.com' },
  verify:      { addrEnv: 'MAIL_FROM_VERIFY',      nameEnv: 'MAIL_NAME_VERIFY',      defaultName: 'Starlife Advert Verify', defaultAddr: 'verify@starlifeadvert.com' },
  security:    { addrEnv: 'MAIL_FROM_SECURITY',    nameEnv: 'MAIL_NAME_SECURITY',    defaultName: 'Starlife Advert Security', defaultAddr: 'security@starlifeadvert.com' },
  broadcast:   { addrEnv: 'MAIL_FROM_BROADCAST',   nameEnv: 'MAIL_NAME_BROADCAST',   defaultName: 'Starlife Advert News', defaultAddr: 'news@starlifeadvert.com' },
  cards:       { addrEnv: 'MAIL_FROM_CARDS',       nameEnv: 'MAIL_NAME_CARDS',       defaultName: 'Starlife Advert Cards', defaultAddr: 'cards@starlifeadvert.com' },
  games:       { addrEnv: 'MAIL_FROM_GAMES',       nameEnv: 'MAIL_NAME_GAMES',       defaultName: 'Starlife Games', defaultAddr: 'games@starlifeadvert.com' },
};

function quoteDisplayName(name) {
  return String(name || DEFAULT_SENDER_NAME).replace(/Star[L]ife/g, 'Starlife').replace(/["\r\n]/g, '');
}

function senderNameForAddress(addr, fallbackName = DEFAULT_SENDER_NAME) {
  const normalizedAddr = String(addr || '').trim().toLowerCase();
  return SENDER_NAME_BY_ADDRESS[normalizedAddr] || fallbackName;
}

function formatSender(name, addr) {
  return `"${quoteDisplayName(name)}" <${addr}>`;
}

function resolveSender(key) {
  const entry = SENDER_MAP[key] || null;
  const departmentAddr = entry && process.env[entry.addrEnv];
  const addr = departmentAddr || entry?.defaultAddr || process.env.MAIL_FROM || DEFAULT_SENDER_ADDR;
  const configuredName = entry
    ? (process.env[entry.nameEnv] || entry.defaultName)
    : (process.env.MAIL_NAME || DEFAULT_SENDER_NAME);
  const name = senderNameForAddress(addr, configuredName);
  return formatSender(name, addr);
}

export { resolveSender, SENDER_MAP, SENDER_NAME_BY_ADDRESS, formatSender, senderNameForAddress };
