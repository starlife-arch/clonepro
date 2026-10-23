import { fileURLToPath } from 'node:url';
import { admin } from '../server-handlers/_lib/firebase.js';

/**
 * One-time, trusted operator command to grant Firebase admin custom claims.
 * Requires Firebase Admin service-account credentials in the environment.
 * Usage: node scripts/set-admin-claim.js <firebase-auth-uid>
 */
export async function setAdminClaim(uid) {
  const targetUid = String(uid || '').trim();
  if (!targetUid) throw new Error('Usage: node scripts/set-admin-claim.js <firebase-auth-uid>');

  // Confirm the Auth account exists and preserve its other custom claims.
  const user = await admin.auth().getUser(targetUid);
  const claims = { ...(user.customClaims || {}), isAdmin: true, adminRole: 'admin' };
  await admin.auth().setCustomUserClaims(targetUid, claims);

  console.log('[admin-claims] Admin claims set for UID:', targetUid);
  console.log('[admin-claims] Ask the user to sign out/in or force-refresh their Firebase ID token.');
  return { uid: targetUid, isAdmin: true, adminRole: 'admin' };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  setAdminClaim(process.argv[2]).catch((error) => {
    console.error('[admin-claims] Failed:', error.message);
    process.exitCode = 1;
  });
}
