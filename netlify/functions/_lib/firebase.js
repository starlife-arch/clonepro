import admin from 'firebase-admin';

let app;

function normalizePrivateKey(privateKey) {
  return String(privateKey || '')
    .replace(/^['\"]|['\"]$/g, '')
    .replace(/\\n/g, '\n');
}

function getServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = JSON.parse(rawJson);
    if (parsed.private_key) parsed.private_key = normalizePrivateKey(parsed.private_key);
    return parsed;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

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

export { getDb, admin };
