import https from "https";
import admin from "firebase-admin";

// ── Firebase ──────────────────────────────────────────────────────────────────
let adminDb = null;
function getDb() {
  if (adminDb) return adminDb;
  if (!admin.apps.length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "{}");
    // fallback to individual vars
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

// ── Print Pay (gateway) config ───────────────────────────────────────────────
// "Print Pay" and "Pesapal" are the SAME payment gateway in this app and share
// ONE set of credentials. Accept every env var name the dashboard may use
// (PRINTPAY_* or PESAPAL_*) so a configured gateway is never falsely reported
// as "print pay api key not configured" / "X API key required".
const envFirst = (...names) => {
  for (const n of names) {
    const v = (process.env[n] || "").trim();
    if (v) return v;
  }
  return "";
};
const PRINTPAY_KEY    = envFirst("PRINTPAY_API_KEY", "PRINTPAY_CONSUMER_KEY", "PRINT_PAY_API_KEY", "PESAPAL_CONSUMER_KEY", "PESAPAL_API_KEY");
const PRINTPAY_SECRET = envFirst("PRINTPAY_SECRET_KEY", "PRINTPAY_CONSUMER_SECRET", "PRINT_PAY_SECRET_KEY", "PESAPAL_CONSUMER_SECRET", "PESAPAL_SECRET_KEY");
const PRINTPAY_BASE   = (envFirst("PRINTPAY_BASE_URL", "PRINT_PAY_BASE_URL", "PESAPAL_BASE_URL") || "https://pay.pesapal.com/v3").replace(/\/$/, "");
// Backwards-compatible aliases (rest of this file uses PESAPAL_* names internally)
const PESAPAL_KEY    = PRINTPAY_KEY;
const PESAPAL_SECRET = PRINTPAY_SECRET;
const PESAPAL_BASE   = PRINTPAY_BASE;
const APP_URL        = (process.env.URL || process.env.DEPLOY_PRIME_URL || "").replace(/\/$/, "");

// ── Simple HTTPS helper ───────────────────────────────────────────────────────
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

// ── Get Pesapal token ─────────────────────────────────────────────────────────
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

// ── Register IPN and get ipn_id ───────────────────────────────────────────────
async function getIpnId(token) {
  const ipnUrl = `${APP_URL}/.netlify/functions/pesapal-verify-payment`;
  const data = await fetchJSON(
    `${PESAPAL_BASE}/api/URLSetup/RegisterIPN`,
    "POST",
    { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
    { url: ipnUrl, ipn_notification_type: "GET" }
  );
  if (!data.ipn_id) throw new Error("IPN registration failed: " + JSON.stringify(data));
  return data.ipn_id;
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async (req, context) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const { orderDetails, userId, userName } = await req.json().catch(() => ({}));
    if (!orderDetails || !userId || !userName) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const amount = parseFloat(orderDetails.amount);
    if (!Number.isFinite(amount) || amount < 10) {
      return new Response(JSON.stringify({ ok: false, error: "Minimum deposit is $10." }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Clear config error instead of the confusing "auth failed: {}" /
    // "X API key required" style messages when keys are truly absent.
    if (!PESAPAL_KEY || !PESAPAL_SECRET) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Print Pay API key not configured. Set PRINTPAY_API_KEY & PRINTPAY_SECRET_KEY (or PESAPAL_CONSUMER_KEY / PESAPAL_CONSUMER_SECRET — both names work for the same gateway) in Netlify environment variables."
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const token   = await getToken();
    const ipn_id  = await getIpnId(token);

    const nameParts  = String(userName || "User").trim().split(/\s+/);
    const firstName  = nameParts[0] || "User";
    const lastName   = nameParts[1] || "";

    const orderId    = orderDetails.id || `DEP-${Date.now()}`;
    const callbackUrl = `${APP_URL}/pesapal-callback`;

    const orderData = await fetchJSON(
      `${PESAPAL_BASE}/api/Transactions/SubmitOrderRequest`,
      "POST",
      { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${token}` },
      {
        id: orderId,
        currency: orderDetails.currency || "USD",
        amount: parseFloat(amount.toFixed(2)),
        description: `Deposit for ${userName}`,
        callback_url: callbackUrl,
        notification_id: ipn_id,
        billing_address: {
          email_address: orderDetails.billing_address?.email_address || "",
          phone_number:  orderDetails.billing_address?.phone_number  || "",
          country_code:  "KE",
          first_name:    orderDetails.billing_address?.first_name || firstName,
          last_name:     orderDetails.billing_address?.last_name  || lastName,
          line_1: "", city: "", state: "", postal_code: "", zip_code: ""
        }
      }
    );

    if (!orderData.redirect_url) {
      throw new Error("No redirect_url from Pesapal: " + JSON.stringify(orderData));
    }

    // Save pending deposit to Firestore
    const db = getDb();
    await db.collection("deposits").add({
      uid: userId,
      userName,
      amount,
      method: "Pesapal",
      ref: orderId,
      pesapalOrderTrackingId: orderData.order_tracking_id || "",
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return new Response(JSON.stringify({ ok: true, redirect_url: orderData.redirect_url }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error("Pesapal initiate error:", err);
    return new Response(JSON.stringify({ ok: false, error: err.message || "Internal server error." }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
