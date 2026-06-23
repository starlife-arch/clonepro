import https from "https";
import admin from "firebase-admin";

// ── Firebase ──────────────────────────────────────────────────────────────────
let adminDb = null;
function getDb() {
  if (adminDb) return adminDb;
  if (!admin.apps.length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
    const credential = sa.project_id
      ? admin.credential.cert(sa)
      : admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n")
        });
    admin.initializeApp({ credential });
  }
  adminDb = admin.firestore();
  return adminDb;
}

// ── Pesapal config ────────────────────────────────────────────────────────────
const PESAPAL_KEY    = process.env.PESAPAL_CONSUMER_KEY;
const PESAPAL_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_BASE   = (process.env.PESAPAL_BASE_URL || "https://pay.pesapal.com/v3").replace(/\/$/, "");

function fetchJSON(url, method = "GET", headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request(
      { hostname: u.hostname, path: u.pathname + u.search, method, headers },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        });
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function getToken() {
  const data = await fetchJSON(
    `${PESAPAL_BASE}/api/Auth/RequestToken`,
    "POST",
    { "Content-Type": "application/json", Accept: "application/json" },
    { consumer_key: PESAPAL_KEY, consumer_secret: PESAPAL_SECRET }
  );
  if (!data.token) throw new Error("Pesapal auth failed: " + JSON.stringify(data));
  return data.token;
}

// ── Main handler — handles both IPN (GET) and frontend verify (POST) ──────────
export default async (req, context) => {
  try {
    const db = getDb();

    // IPN call from Pesapal (GET request)
    if (req.method === "GET") {
      const orderTrackingId     = new URL(req.url).searchParams.get('OrderTrackingId');
      const merchantReference   = new URL(req.url).searchParams.get('OrderMerchantReference');
      if (!orderTrackingId) return new Response("OK", { status: 200 });

      const token = await getToken();
      const statusData = await fetchJSON(
        `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        "GET",
        { Accept: "application/json", Authorization: `Bearer ${token}` }
      );

      const paymentStatus = (statusData.payment_status_description || "").toUpperCase();
      if (paymentStatus !== "COMPLETED") return new Response("OK", { status: 200 });

      await approveDeposit(db, orderTrackingId);
      return new Response("OK", { status: 200 });
    }

    // Frontend verify call (POST request)
    if (req.method === "POST") {
      const { orderTrackingId, merchantReference } = await req.json().catch(() => ({}));
      if (!orderTrackingId) {
        return new Response(JSON.stringify({ ok: false, error: "Missing orderTrackingId" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const token = await getToken();
      const statusData = await fetchJSON(
        `${PESAPAL_BASE}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        "GET",
        { Accept: "application/json", Authorization: `Bearer ${token}` }
      );

      const paymentStatus = (statusData.payment_status_description || "").toUpperCase();

      if (paymentStatus === "COMPLETED") {
        await approveDeposit(db, orderTrackingId);
        return new Response(JSON.stringify({ ok: true, status: "COMPLETED" }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ ok: false, status: paymentStatus }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return new Response("Method Not Allowed", { status: 405 });

  } catch (err) {
    console.error("Pesapal verify error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

// ── Approve deposit and credit user balance ───────────────────────────────────
async function approveDeposit(db, orderTrackingId) {
  const snap = await db.collection("deposits")
    .where("pesapalOrderTrackingId", "==", orderTrackingId)
    .limit(1).get();

  if (snap.empty) {
    console.warn("No deposit found for tracking ID:", orderTrackingId);
    return;
  }

  const depositDoc  = snap.docs[0];
  const depositData = depositDoc.data();

  if (depositData.status === "approved") return; // already done

  await db.runTransaction(async (txn) => {
    const userRef = db.collection("users").doc(depositData.uid);
    const userDoc = await txn.get(userRef);
    if (!userDoc.exists) throw new Error("User not found: " + depositData.uid);

    txn.update(depositDoc.ref, {
      status: "approved",
      approvedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    txn.update(userRef, {
      mainBalance: admin.firestore.FieldValue.increment(depositData.amount)
    });
  });

  console.log(`✅ Deposit approved: $${depositData.amount} for user ${depositData.uid}`);
}
