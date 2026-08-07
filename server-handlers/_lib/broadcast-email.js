import admin from 'firebase-admin';

function initFirebase() {
  if (admin.apps.length) return admin.firestore();
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : null;
  const credential = sa
    ? admin.credential.cert(sa)
    : admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      });
  admin.initializeApp({ credential });
  return admin.firestore();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

function cleanRecipientKey(value) {
  return String(value || '').trim();
}

function looksLikeEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

async function findUserByMemberIdOrUid(db, memberIdOrUid) {
  const key = cleanRecipientKey(memberIdOrUid);
  if (!key) return null;

  const direct = await db.collection('users').doc(key).get();
  if (direct.exists) return direct;

  const memberFields = ['memberId', 'memberID', 'uid'];
  for (const field of memberFields) {
    const snap = await db.collection('users').where(field, '==', key).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }

  const upperKey = key.toUpperCase();
  const allUsers = await db.collection('users').get();
  return allUsers.docs.find(doc => {
    const data = doc.data() || {};
    return doc.id.substring(0, 8).toUpperCase() === upperKey
      || String(data.memberId || '').toUpperCase() === upperKey
      || String(data.memberID || '').toUpperCase() === upperKey;
  }) || null;
}

function userDocToRecipient(doc) {
  const data = doc.data() || {};
  return {
    email: data.email,
    name: data.name || data.displayName || 'Member',
  };
}

async function resolveRecipients(db, recipients) {
  if (recipients === 'all') {
    const usersSnap = await db.collection('users').get();
    return usersSnap.docs.map(userDocToRecipient).filter(r => r.email);
  }

  if (Array.isArray(recipients)) {
    const resolved = [];
    for (const item of recipients) {
      const key = cleanRecipientKey(item);
      if (!key) continue;
      if (looksLikeEmail(key)) {
        resolved.push({ email: key, name: 'Member' });
        continue;
      }
      const userSnap = await findUserByMemberIdOrUid(db, key);
      if (!userSnap) throw new Error(`User not found: ${key}`);
      const recipient = userDocToRecipient(userSnap);
      if (recipient.email) resolved.push(recipient);
    }
    return resolved;
  }

  if (typeof recipients === 'string' && recipients.startsWith('single:')) {
    const memberIdOrUid = recipients.slice('single:'.length);
    const userSnap = await findUserByMemberIdOrUid(db, memberIdOrUid);
    if (!userSnap) throw new Error('User not found');
    const recipient = userDocToRecipient(userSnap);
    return recipient.email ? [recipient] : [];
  }

  throw new Error('Invalid recipients format');
}

function personalizeMessage(message, name) {
  let personalizedMessage = String(message || '')
    .replace(/Dear Member/gi, `Dear ${name}`)
    .replace(/Hi \[Name\]/gi, `Hi ${name}`)
    .replace(/\[Name\]/g, name);
  if (!personalizedMessage.includes(name)) {
    personalizedMessage = `<p>Dear ${name},</p>\n${personalizedMessage}`;
  }
  return personalizedMessage;
}

async function getBroadcastCounts(db, broadcastId) {
  const totalSnap = await db.collection('emailBroadcastQueue').where('broadcastId', '==', broadcastId).count().get();
  const sentSnap = await db.collection('emailBroadcastQueue').where('broadcastId', '==', broadcastId).where('status', '==', 'sent').count().get();
  const failedSnap = await db.collection('emailBroadcastQueue').where('broadcastId', '==', broadcastId).where('status', '==', 'failed').count().get();
  const totalRecipients = totalSnap.data().count || 0;
  const sent = sentSnap.data().count || 0;
  const failed = failedSnap.data().count || 0;
  return { totalRecipients, sent, failed, pending: Math.max(0, totalRecipients - sent - failed) };
}

async function updateBroadcastLog(db, broadcastId, extra = {}) {
  const counts = await getBroadcastCounts(db, broadcastId);
  await db.collection('broadcastLogs').doc(broadcastId).set({
    ...extra,
    broadcastId,
    recipients: counts.totalRecipients,
    totalRecipients: counts.totalRecipients,
    sent: counts.sent,
    failed: counts.failed,
    pending: counts.pending,
    status: counts.pending > 0 ? 'processing' : (counts.failed > 0 ? 'completed_with_failures' : 'completed'),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return counts;
}

export { admin, initFirebase, json, resolveRecipients, personalizeMessage, updateBroadcastLog };
