import admin from 'firebase-admin';

let app;

function maybeBase64Decode(value) {
  const clean = String(value || '').trim();
  if (!clean || clean.includes('{') || clean.includes('-----BEGIN')) return clean;
  try {
    const decoded = Buffer.from(clean, 'base64').toString('utf8').trim();
    return decoded || clean;
  } catch (_) {
    return clean;
  }
}

function normalizePrivateKey(privateKey) {
  let key = maybeBase64Decode(privateKey)
    .replace(/^['"]|['"]$/g, '')
    .replace(/\\n/g, '\n')
    .trim();

  if (!key.includes('-----BEGIN')) return key;

  key = key
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/-----BEGIN ([A-Z ]+)-----\s*/g, '-----BEGIN $1-----\n')
    .replace(/\s*-----END ([A-Z ]+)-----/g, '\n-----END $1-----')
    .replace(/\n{2,}/g, '\n')
    .trim();

  const match = key.match(/^(-----BEGIN [^-]+-----)\n?([A-Za-z0-9+/=\s]+?)\n?(-----END [^-]+-----)$/);
  if (!match) return key;

  const body = match[2].replace(/\s+/g, '');
  const wrapped = body.match(/.{1,64}/g)?.join('\n') || body;
  return `${match[1]}\n${wrapped}\n${match[3]}\n`;
}

function parseServiceAccountJson(rawJson) {
  const raw = maybeBase64Decode(rawJson)
    .replace(/^['"]|['"]$/g, '')
    .trim();
  const parsed = JSON.parse(raw);
  if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
  return parsed;
}

function getServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (rawJson) return parseServiceAccountJson(rawJson);

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.GOOGLE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.');
  }

  return {
    project_id: projectId,
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey)
  };
}

function getDb() {
  if (!app) {
    app = admin.apps.length ? admin.apps[0] : admin.initializeApp({
      credential: admin.credential.cert(getServiceAccount())
    });
  }

  return admin.firestore(app);
}

export { getDb, admin, normalizePrivateKey, parseServiceAccountJson };
