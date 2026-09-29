#!/usr/bin/env python3
# Phase 2: head fonts, overlay CSS, home redesign, SVG nav, tab(), cleanup
import re

P = 'index.html'
s = open(P, encoding='utf-8').read()
n0 = len(s)

def sub1(pat, repl, label='', flags=0, cnt=1):
    global s
    new, n = re.subn(pat, repl, s, count=cnt, flags=flags)
    if n == 0:
        print('WARN no match:', label)
    s = new
    return n

# ---------- A. Google Fonts: Inter ----------
sub1(
    r'<link\s+href="https://fonts\.googleapis\.com/css2\?family=Space\+Grotesk[^"]*"\s*rel="stylesheet">',
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">\n    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">',
    label='fonts')

# ---------- B. Cleanup artifacts from emoji removal ----------
s = s.replace('<span class="ico">$</span>', '')
s = s.replace('\u2139', '')
s = re.sub(r'>Done\s+([A-Z])', r'>\1', s)          # "Done Account not verified" -> "Account..."
s = re.sub(r'>Failed\s+([a-z])', r'>\1', s)
s = s.replace("msg: ' ", "msg: '").replace(" + ' '", " + ' '")
s = re.sub(r'<div class="es"><div class="ei"></div>', '<div class="es">', s)
s = re.sub(r'<div class="ei">\s*</div>', '', s)
s = re.sub(r'\{ name: \'\w+\', icon: \'\' \}', "{ name: 'Starlife Official', icon: '' }", s)

# ---------- C. Replace bottom navigation with clean SVG nav ----------
BNAV_RE = re.compile(r'<div class="bnav">.*?</div>\s*(?:<!-- MORE MENU -->)?', re.S)
NEW_NAV = '''<nav class="bottom-nav">
            <div class="nav-item active" onclick="tab('home')" id="nav-home">
                <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                <span>Home</span>
            </div>
            <div class="nav-item" onclick="tab('invest')" id="nav-invest">
                <svg viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                <span>Invest</span>
            </div>
            <div class="nav-item" onclick="tab('wallet')" id="nav-wallet">
                <svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 13a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/></svg>
                <span>Wallet</span>
            </div>
            <div class="nav-item" onclick="tab('messages');loadDMList()" id="nav-messages">
                <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
                <span>Messages</span>
            </div>
            <div class="nav-item" onclick="tab('profile')" id="nav-profile">
                <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Profile</span>
            </div>
        </nav>
        <!-- MORE MENU -->'''
sub1(BNAV_RE.pattern, NEW_NAV.replace('\\', '\\\\'), label='bnav', flags=re.S)

# more-menu items: plain text labels (strip leftover leading spaces / $ signs)
def menu_fix(m):
    inner = m.group(2).strip().lstrip('$ ').strip()
    return '%s>%s</div>' % (m.group(1), inner)
s = re.sub(r'(<div class="more-item"[^>]*onclick="[^"]*">)\s*[\$ ]*([^<]+)</div>', menu_fix, s)

# ---------- D. Home page redesign (Revolut style) ----------
HOME_RE = re.compile(r'<div id="t-home" class="itc on">.*?(?=<!-- INVEST -->)', re.S)
NEW_HOME = '''<div id="t-home" class="itc on">
                <!-- Top bar -->
                <div class="page-header rv-home-header">
                    <div style="display:flex;align-items:center;gap:10px">
                        <div class="nav-av" id="nav-av" style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#4f8ef7,#7c5cfc);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:#fff;cursor:pointer" onclick="tab('profile')">N</div>
                        <div>
                            <div style="font-size:12px;color:#8b8fa8;font-weight:500" id="home-greeting">Welcome</div>
                            <div style="font-size:15px;font-weight:700" id="home-name">Starlife</div>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center">
                        <div class="nav-bal" style="font-size:13px;font-weight:700;color:#8b8fa8">$<span id="nav-bal">0.00</span></div>
                        <button class="rv-icon-btn" onclick="toggleNotifs()" aria-label="Notifications" style="position:relative">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                            <div class="bell-badge" id="bell-cnt" style="display:none">0</div>
                        </button>
                    </div>
                    <!-- Notification Panel -->
                    <div class="notif-panel" id="notif-panel">
                        <div style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;justify-content:space-between;align-items:center">
                            <span style="font-weight:700;font-size:.88rem">Notifications</span>
                            <span style="font-size:.75rem;color:#4f8ef7;cursor:pointer" onclick="markAllRead()">Mark all read</span>
                        </div>
                        <div id="notif-list">
                            <div class="es" style="padding:20px">No notifications</div>
                        </div>
                    </div>
                </div>

                <!-- Balance -->
                <div class="balance-hero">
                    <div class="label">Total Balance</div>
                    <div class="amount"><span class="currency">$</span><span id="h-bal">0.00</span></div>
                    <div style="margin-top:8px;font-size:13px;color:#8b8fa8">Points: <span id="h-pts">0</span> · <span id="home-daily">+$0.00 today</span> · Starlife Held: <span id="h-held" style="color:#ff4d6a">$0.00</span></div>
                    <div style="margin-top:6px" id="h-rank-wrap"></div>
                    <div id="kyc-home-banner" style="display:none;margin:10px auto 0;max-width:340px;padding:12px;border-radius:12px;background:rgba(245,185,66,.12);border:1px solid rgba(245,185,66,.35);color:#f5b942;font-size:.82rem;font-weight:700">Account not verified. Complete verification to unlock transactions. <button class="btn-secondary" style="color:#f5b942;padding:8px 12px;margin-left:6px;width:auto" onclick="closeModal('m-kyc-gate');tab('profile')">Verify Now</button></div>
                    <div id="twofa-nudge-banner" style="display:none;margin:10px auto 0;max-width:340px;padding:12px;border-radius:12px;background:rgba(0,200,150,.10);border:1px solid rgba(0,200,150,.30);color:#fff;font-size:.82rem;font-weight:700"><strong>Secure your account.</strong> Enable Two-Factor Authentication to protect against unauthorised access. <button class="btn-primary" style="padding:8px 12px;margin-left:6px;width:auto" onclick="tab('profile');setTimeout(()=>document.getElementById('twofa-card')?.scrollIntoView({behavior:'smooth',block:'center'}),100)">Enable Now</button><button class="btn-secondary" style="padding:8px 12px;margin-left:6px;width:auto" onclick="dismiss2faNudge()">Dismiss</button></div>
                </div>

                <!-- Quick actions -->
                <div class="quick-actions">
                    <div class="quick-action" onclick="tab('deposit')">
                        <div class="icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                        </div>
                        <span>Add Money</span>
                    </div>
                    <div class="quick-action" onclick="tab('withdraw')">
                        <div class="icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00c896" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        </div>
                        <span>Withdraw</span>
                    </div>
                    <div class="quick-action" onclick="tab('invest')">
                        <div class="icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c5cfc" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/></svg>
                        </div>
                        <span>Invest</span>
                    </div>
                    <div class="quick-action" onclick="tab('transfer')">
                        <div class="icon-circle">
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f5b942" stroke-width="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                        </div>
                        <span>Transfer</span>
                    </div>
                </div>

                <div class="dl-app-wrap">
                    <a class="dl-app-btn" href="https://drive.google.com/uc?export=download&id=1BmNndgK8nCU89NOYYchs7mBEJL0zp1Qx" target="_blank" rel="noopener">Install Starlife App</a>
                </div>

                <!-- Ad Banner -->
                <div id="ad-banner-wrap" style="display:none;margin-bottom:14px;padding:0 16px">
                    <a id="ad-banner-link" href="#" target="_blank" rel="noopener" style="display:block;text-decoration:none">
                        <div style="position:relative;border-radius:12px;overflow:hidden;background:#1c1d26;min-height:60px;max-height:80px;display:flex;align-items:center;justify-content:center">
                            <img id="ad-banner-img" src="" alt="" style="width:100%;height:auto;max-height:300px;object-fit:contain;display:block;border-radius:12px;background:#13141a" onerror="this.style.display='none';document.getElementById('ad-banner-txt').style.display='flex'">
                            <div id="ad-banner-txt" style="display:none;width:100%;height:80px;align-items:center;justify-content:center;background:#1c1d26;border-radius:12px">
                                <span style="color:#fff;font-size:.85rem;font-weight:600" id="ad-banner-name"></span>
                            </div>
                        </div>
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:3px;padding:0 2px">
                            <span id="ad-banner-label" style="font-size:.68rem;color:#8b8fa8"></span>
                            <span style="font-size:.63rem;color:#4a4d63;background:#13141a;padding:1px 6px;border-radius:4px">Sponsored</span>
                        </div>
                    </a>
                </div>

                <!-- Stats -->
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-label">Total Invested</div>
                        <div class="stat-value">$<span id="h-inv">0.00</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Daily Profit</div>
                        <div class="stat-value" style="color:#00c896">$<span id="h-dp">0.00</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Total Earned</div>
                        <div class="stat-value" style="color:#f5b942">$<span id="h-ern">0.00</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Shareholder</div>
                        <div class="stat-value" style="color:#7c5cfc">$<span id="h-sh">0.00</span></div>
                    </div>
                </div>
                <div class="stats-row">
                    <div class="stat-card">
                        <div class="stat-label">Survey Points</div>
                        <div class="stat-value"><span id="h-svpts">0</span> pts</div>
                    </div>
                    <div class="stat-card" style="display:flex;align-items:center;justify-content:center;gap:8px">
                        <button class="btn-primary" style="padding:12px" onclick="tab('rewards')">Spin &amp; Rewards</button>
                    </div>
                </div>

                <!-- Recent activity -->
                <div class="section-header" style="display:flex;justify-content:space-between;align-items:center">Recent Activity <a style="color:#4f8ef7;cursor:pointer;text-transform:none;letter-spacing:0" onclick="tab('activity')">View all</a></div>
                <div class="scroll-area">
                    <div class="card" id="h-act">
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <p>No recent activity</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- INVEST -->'''
sub1(HOME_RE.pattern, lambda m: NEW_HOME, label='home', flags=re.S)

# remove the old top <nav> block that contained nav-logo/bell/av (now inside home header)
OLD_TOPNAV_RE = re.compile(r'<div class="page" id="pg-app">\s*<nav>.*?</nav>', re.S)
def strip_topnav(m):
    return '<div class="page" id="pg-app">'
sub1(OLD_TOPNAV_RE.pattern, strip_topnav, label='topnav', flags=re.S)

# ---------- E. Wallet page alias (t-wallet -> deposit) ----------
WALLET_MAP = """
        // Revolut-style wallet quick page maps to deposit flow
        function _rvOpenWallet() { var t = document.getElementById('t-deposit'); if (t) { document.querySelectorAll('.itc').forEach(function (x) { x.style.display = 'none'; x.classList.remove('on'); }); t.style.display = 'block'; t.classList.add('on'); } }
"""

# ---------- F. Update tab() to sync nav active state ----------
TAB_OLD_START = "function tab(name) { if (window._real_tab)"
i = s.find(TAB_OLD_START)
j = s.find('\n', i)
assert i != -1, 'tab() not found'
TAB_NEW = ("function tab(name) { if (name === 'wallet') { if (window._real_tab) { window._real_tab('deposit'); } else { _rvOpenWallet(); } } "
           "else if (window._real_tab) window._real_tab(name); "
           "else { document.querySelectorAll('.itc').forEach(function (t) { t.style.display = 'none'; t.classList.remove('on'); }); var el = document.getElementById('t-' + name); if (el) { el.style.display = 'block'; el.classList.add('on'); } } "
           "try { document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); }); "
           "var map = { home: 'nav-home', invest: 'nav-invest', deposit: 'nav-wallet', wallet: 'nav-wallet', withdraw: 'nav-wallet', messages: 'nav-messages', profile: 'nav-profile' }; "
           "var nid = map[name]; var ni = nid ? document.getElementById(nid) : null; if (ni) ni.classList.add('active'); } catch (e) {} }")
s = s[:i] + TAB_NEW + s[j:]

# inject _rvOpenWallet helper right before updateUI definition
s = s.replace('function updateUI() {', WALLET_MAP + '\n        function updateUI() {', 1)

# greeting/name in updateUI
s = s.replace("$('h-bal').textContent = b;",
              "$('h-bal').textContent = b;\n            (function(){ var hn = $('home-name'); if (hn) hn.textContent = (u.name || 'Starlife').split(' ')[0]; var gr = $('home-greeting'); if (gr) { var hh = new Date().getHours(); gr.textContent = hh < 12 ? 'Good morning' : hh < 18 ? 'Good afternoon' : 'Good evening'; } var hd = $('home-daily'); if (hd) hd.textContent = '+$' + fmt((u.totalInvested || 0) * 0.02) + ' today'; })();", 1)

# ---------- G. Overlay Revolut design system at end of main <style> ----------
OVERLAY = """
        /* ════════════════════════════════════════════════
           REVOLUT-STYLE DESIGN SYSTEM OVERLAY
           ════════════════════════════════════════════════ */
        body { background: #0a0b0f; color: #ffffff; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased; max-width: 480px; margin: 0 auto; min-height: 100vh; overflow-x: hidden; }
        .rv-scope, .rv-scope * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

        /* Cards */
        .card { background: #13141a; border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; padding: 20px; margin-bottom: 12px; }

        /* Balance hero */
        .balance-hero { text-align: center; padding: 40px 24px 24px; }
        .balance-hero .label { font-size: 13px; color: #8b8fa8; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px; }
        .balance-hero .amount { font-size: 48px; font-weight: 800; color: #ffffff; letter-spacing: -2px; line-height: 1; }
        .balance-hero .currency { font-size: 24px; font-weight: 600; color: #8b8fa8; vertical-align: super; margin-right: 4px; }

        /* Quick actions */
        .quick-actions { display: flex; justify-content: center; gap: 20px; padding: 8px 24px 24px; }
        .quick-action { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
        .quick-action .icon-circle { width: 56px; height: 56px; border-radius: 50%; background: #1c1d26; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; font-size: 20px; transition: background 0.2s; }
        .quick-action .icon-circle:active { background: #2a2b38; }
        .quick-action span { font-size: 12px; color: #8b8fa8; font-weight: 500; }

        /* Bottom navigation */
        .bottom-nav { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(10,11,15,0.95); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-around; align-items: center; padding: 8px 0 20px; z-index: 1000; }
        .bottom-nav { padding-bottom: max(20px, env(safe-area-inset-bottom)); }
        .nav-item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; padding: 4px 12px; border-radius: 12px; transition: all 0.2s; min-width: 56px; }
        .nav-item svg { width: 22px; height: 22px; stroke: #4a4d63; fill: none; stroke-width: 2; transition: stroke 0.2s; }
        .nav-item span { font-size: 10px; color: #4a4d63; font-weight: 500; transition: color 0.2s; }
        .nav-item.active svg { stroke: #4f8ef7; }
        .nav-item.active span { color: #4f8ef7; }

        /* List items */
        .list-item { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .list-item:last-child { border-bottom: none; }
        .list-item .icon-box { width: 44px; height: 44px; border-radius: 14px; background: #1c1d26; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .list-item .icon-box svg { width: 20px; height: 20px; stroke: #8b8fa8; fill: none; stroke-width: 2; }
        .list-item .info { flex: 1; }
        .list-item .info .title { font-size: 14px; font-weight: 600; color: #fff; }
        .list-item .info .sub { font-size: 12px; color: #8b8fa8; margin-top: 2px; }
        .list-item .amount { font-size: 15px; font-weight: 700; }
        .list-item .amount.pos { color: #00c896; }
        .list-item .amount.neg { color: #ffffff; }

        /* Buttons */
        .btn-primary { width: 100%; padding: 16px; background: #4f8ef7; color: #fff; font-size: 15px; font-weight: 700; border: none; border-radius: 14px; cursor: pointer; transition: opacity 0.2s; letter-spacing: 0.2px; }
        .btn-primary:active { opacity: 0.8; }
        .btn-secondary { width: 100%; padding: 16px; background: #1c1d26; color: #fff; font-size: 15px; font-weight: 600; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; cursor: pointer; transition: background 0.2s; }
        .btn-secondary:active { background: #2a2b38; }

        /* Input fields */
        .input-field { width: 100%; padding: 16px; background: #1c1d26; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; color: #fff; font-size: 15px; font-family: inherit; outline: none; transition: border-color 0.2s; margin-bottom: 12px; }
        .input-field:focus { border-color: #4f8ef7; }
        .input-field::placeholder { color: #4a4d63; }

        /* Section headers */
        .section-header { font-size: 12px; font-weight: 600; color: #8b8fa8; text-transform: uppercase; letter-spacing: 0.8px; padding: 20px 24px 8px; }

        /* Badges/Pills */
        .pill { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
        .pill-green { background: rgba(0,200,150,0.15); color: #00c896; }
        .pill-red { background: rgba(255,77,106,0.15); color: #ff4d6a; }
        .pill-blue { background: rgba(79,142,247,0.15); color: #4f8ef7; }
        .pill-gold { background: rgba(245,185,66,0.15); color: #f5b942; }
        .pill-grey { background: rgba(139,143,168,0.15); color: #8b8fa8; }

        /* Modals */
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 2000; display: none; align-items: flex-end; justify-content: center; }
        .modal-overlay.open { display: flex; }
        .modal-sheet { background: #13141a; border-radius: 24px 24px 0 0; width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto; padding: 12px 20px 40px; }
        .modal-handle { width: 36px; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; margin: 0 auto 20px; }

        /* Toast notifications */
        .toast { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #1c1d26; border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 12px 20px; border-radius: 14px; font-size: 14px; font-weight: 500; z-index: 9999; white-space: nowrap; box-shadow: 0 8px 32px rgba(0,0,0,0.4); }

        /* Page-specific top header */
        .page-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; position: sticky; top: 0; background: rgba(10,11,15,0.95); backdrop-filter: blur(20px); z-index: 100; }
        .page-header .title { font-size: 17px; font-weight: 700; }
        .rv-icon-btn { width: 36px; height: 36px; border-radius: 50%; background: #1c1d26; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }

        /* Stats row */
        .stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px; margin-bottom: 12px; }
        .stat-card { background: #13141a; border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 16px; }
        .stat-card .stat-label { font-size: 11px; color: #8b8fa8; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .stat-card .stat-value { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }

        /* Divider */
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0; }

        /* Empty state */
        .empty-state { text-align: center; padding: 48px 24px; color: #4a4d63; }
        .empty-state svg { width: 48px; height: 48px; stroke: #2a2b38; fill: none; stroke-width: 1.5; margin-bottom: 16px; }
        .empty-state p { font-size: 14px; font-weight: 500; }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 0; }

        /* ── Legacy selectors remapped to the new palette ── */
        :root { --bg: #0a0b0f; --s1: #13141a; --s2: #13141a; --s3: #1c1d26; --bd: rgba(255,255,255,0.08); --bds: rgba(79,142,247,0.35); --t1: #ffffff; --t2: #8b8fa8; --t3: #4a4d63; --g: #00c896; --gd: #00a37a; --gg: rgba(0,200,150,0.13); --gold: #f5b942; --sky: #4f8ef7; --red: #ff4d6a; --orange: #ff7043; --purple: #7c5cfc; --r: 18px; --rs: 12px; --rl: 24px; }
        .bal-card { background: transparent !important; border: none !important; box-shadow: none !important; }
        .sc, .statbox, .mini-stat { background: #13141a !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 16px !important; }
        .ptitle { font-weight: 800; letter-spacing: -0.5px; }
        .ai-ico { background: #1c1d26 !important; border-radius: 14px !important; color: #8b8fa8 !important; font-weight: 700; }
        .ai-ico.g { color: #00c896 !important; }
        .ai-ico.r { color: #ff4d6a !important; }
        .sh h3 { font-size: 12px; font-weight: 600; color: #8b8fa8; text-transform: uppercase; letter-spacing: 0.8px; }
        .sh a { color: #4f8ef7; }
        nav { background: rgba(10,11,15,0.95) !important; backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.06) !important; max-width: 480px; margin: 0 auto; }
        .nav-logo { font-weight: 800; letter-spacing: -0.5px; }
        .dl-app-btn { background: #1c1d26 !important; border: 1px solid rgba(255,255,255,0.08) !important; color: #fff !important; border-radius: 14px !important; font-weight: 600; }
        .more-item { color: #8b8fa8; font-weight: 500; }
        .more-item:hover { background: #1c1d26; color: #fff; }
        .moving-ticker { background: #13141a !important; border-color: rgba(255,255,255,0.08) !important; }
        .theme-toggle, #theme-toggle-btn { background: #1c1d26 !important; border-color: rgba(255,255,255,0.08) !important; }
        input, select, textarea { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        button { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        .wrap { padding-bottom: 90px; }
        /* hide legacy bottom bar if any remains */
        .bnav { display: none !important; }
        /* light theme overrides follow below existing rules; keep readable on new dark base */
        [data-theme="light"] body { background: #f4f5f7; color: #0a0b0f; }
"""
k = s.find('</style>')  # first inline style block (main one is actually second; find the big one ending near line 3260+)
# choose the LAST closing tag of the FIRST large style block: locate '</style>' after ':root {'
idx_root = s.find(':root {')
idx_style_end = s.find('</style>', idx_root)
assert idx_style_end != -1
s = s[:idx_style_end] + OVERLAY + s[idx_style_end:]

open(P, 'w', encoding='utf-8').write(s)
print('phase2 done, delta:', len(s) - n0)
