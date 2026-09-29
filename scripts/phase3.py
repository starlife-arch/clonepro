#!/usr/bin/env python3
# Phase 3: real tab() nav sync, toast classes, modal class check, styles.css rewrite
import re

P = 'index.html'
s = open(P, encoding='utf-8').read()

# ---------- Real tab(): add nav-item active sync + wallet alias ----------
old = """        function tab(name) {
            document.querySelectorAll('.itc').forEach(t => { t.style.display = 'none'; t.classList.remove('on'); });
            document.querySelectorAll('.bi').forEach(b => b.classList.remove('on'));"""
new = """        function tab(name) {
            if (name === 'wallet') name = 'deposit';
            document.querySelectorAll('.itc').forEach(t => { t.style.display = 'none'; t.classList.remove('on'); });
            document.querySelectorAll('.bi').forEach(b => b.classList.remove('on'));
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            try { var _niMap = { home: 'nav-home', invest: 'nav-invest', deposit: 'nav-wallet', withdraw: 'nav-wallet', messages: 'nav-messages', profile: 'nav-profile' }; var _ni = document.getElementById(_niMap[name]); if (_ni) _ni.classList.add('active'); } catch (e) {}
            window.scrollTo(0, 0);"""
assert old in s, 'real tab() header not found'
s = s.replace(old, new, 1)

# ---------- Toast classes -> new palette ----------
for a, b in [("'toast tg'", "'toast ok'"), ('"toast tg"', '"toast ok"'), ("'toast tr'", "'toast err'"),
             ('"toast tr"', '"toast err"'), ("'toast tw'", "'toast warn'"), ('"toast tw"', '"toast warn"'),
             ("'toast tb'", "'toast info'"), ('"toast tb"', '"toast info"')]:
    s = s.replace(a, b)

open(P, 'w', encoding='utf-8').write(s)
print('phase3 index done')

# ---------- styles.css: full Revolut-style rewrite ----------
CSS = """/* ============================================================
   STARLIFE — REVOLUT-STYLE DESIGN SYSTEM
   ============================================================ */

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:  #0a0b0f;
  --bg2: #13141a;
  --bg3: #1c1d26;
  --border: rgba(255,255,255,0.08);
  --text1: #ffffff;
  --text2: #8b8fa8;
  --text3: #4a4d63;
  --accent:  #4f8ef7;
  --accent2: #7c5cfc;
  --green:   #00c896;
  --red:     #ff4d6a;
  --gold:    #f5b942;
  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
}

body {
  background: var(--bg);
  color: var(--text1);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  overflow-x: hidden;
}

/* Cards */
.card {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 12px;
}

/* Balance hero */
.balance-hero { text-align: center; padding: 40px 24px 24px; }
.balance-hero .label {
  font-size: 13px; color: var(--text2); font-weight: 500;
  letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 8px;
}
.balance-hero .amount {
  font-size: 48px; font-weight: 800; color: var(--text1);
  letter-spacing: -2px; line-height: 1;
}
.balance-hero .currency {
  font-size: 24px; font-weight: 600; color: var(--text2);
  vertical-align: super; margin-right: 4px;
}

/* Quick action buttons */
.quick-actions { display: flex; justify-content: center; gap: 20px; padding: 8px 24px 24px; }
.quick-action { display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; }
.quick-action .icon-circle {
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--bg3); border: 1px solid var(--border);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; transition: background 0.2s;
}
.quick-action .icon-circle:active { background: #2a2b38; }
.quick-action span { font-size: 12px; color: var(--text2); font-weight: 500; }

/* Bottom navigation */
.bottom-nav {
  position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
  width: 100%; max-width: 480px;
  background: rgba(10,11,15,0.95);
  backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex; justify-content: space-around; align-items: center;
  padding: 8px 0 20px; z-index: 1000;
  padding-bottom: max(20px, env(safe-area-inset-bottom));
}
.nav-item {
  display: flex; flex-direction: column; align-items: center; gap: 4px;
  cursor: pointer; padding: 4px 12px; border-radius: var(--radius-sm);
  transition: all 0.2s; min-width: 56px;
}
.nav-item svg { width: 22px; height: 22px; stroke: var(--text3); fill: none; stroke-width: 2; transition: stroke 0.2s; }
.nav-item span { font-size: 10px; color: var(--text3); font-weight: 500; transition: color 0.2s; }
.nav-item.active svg { stroke: var(--accent); }
.nav-item.active span { color: var(--accent); }

/* List items (transactions, activity) */
.list-item { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
.list-item:last-child { border-bottom: none; }
.list-item .icon-box {
  width: 44px; height: 44px; border-radius: 14px; background: var(--bg3);
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.list-item .icon-box svg { width: 20px; height: 20px; stroke: var(--text2); fill: none; stroke-width: 2; }
.list-item .info { flex: 1; }
.list-item .info .title { font-size: 14px; font-weight: 600; color: var(--text1); }
.list-item .info .sub { font-size: 12px; color: var(--text2); margin-top: 2px; }
.list-item .amount { font-size: 15px; font-weight: 700; }
.list-item .amount.pos { color: var(--green); }
.list-item .amount.neg { color: var(--text1); }

/* Buttons */
.btn-primary {
  width: 100%; padding: 16px; background: var(--accent); color: #fff;
  font-size: 15px; font-weight: 700; border: none; border-radius: 14px;
  cursor: pointer; transition: opacity 0.2s; letter-spacing: 0.2px;
  font-family: inherit;
}
.btn-primary:active { opacity: 0.8; }
.btn-secondary {
  width: 100%; padding: 16px; background: var(--bg3); color: #fff;
  font-size: 15px; font-weight: 600; border: 1px solid var(--border);
  border-radius: 14px; cursor: pointer; transition: background 0.2s;
  font-family: inherit;
}
.btn-secondary:active { background: #2a2b38; }

/* Input fields */
.input-field {
  width: 100%; padding: 16px; background: var(--bg3);
  border: 1px solid var(--border); border-radius: 14px; color: #fff;
  font-size: 15px; font-family: inherit; outline: none;
  transition: border-color 0.2s; margin-bottom: 12px;
}
.input-field:focus { border-color: var(--accent); }
.input-field::placeholder { color: var(--text3); }

/* Section headers */
.section-header {
  font-size: 12px; font-weight: 600; color: var(--text2);
  text-transform: uppercase; letter-spacing: 0.8px; padding: 20px 24px 8px;
}

/* Badges/Pills */
.pill { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.pill-green { background: rgba(0,200,150,0.15); color: var(--green); }
.pill-red   { background: rgba(255,77,106,0.15); color: var(--red); }
.pill-blue  { background: rgba(79,142,247,0.15); color: var(--accent); }
.pill-gold  { background: rgba(245,185,66,0.15); color: var(--gold); }
.pill-grey  { background: rgba(139,143,168,0.15); color: var(--text2); }

/* Page container */
.page { padding: 0 0 90px; display: none; }
.page.active { display: block; }

/* Scrollable content */
.scroll-area { padding: 0 16px; }

/* Modals */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  backdrop-filter: blur(4px); z-index: 2000;
  display: none; align-items: flex-end; justify-content: center;
}
.modal-overlay.open { display: flex; }
.modal-sheet {
  background: var(--bg2); border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  width: 100%; max-width: 480px; max-height: 90vh; overflow-y: auto;
  padding: 12px 20px 40px;
}
.modal-handle { width: 36px; height: 4px; background: rgba(255,255,255,0.15); border-radius: 2px; margin: 0 auto 20px; }

/* Toast notifications */
.toast {
  position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
  background: var(--bg3); border: 1px solid rgba(255,255,255,0.1);
  color: #fff; padding: 12px 20px; border-radius: 14px;
  font-size: 14px; font-weight: 500; z-index: 9999; white-space: nowrap;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}
.toast.ok   { border-color: rgba(0,200,150,0.4); }
.toast.err  { border-color: rgba(255,77,106,0.4); }
.toast.warn { border-color: rgba(245,185,66,0.4); }
.toast.info { border-color: rgba(79,142,247,0.4); }

/* Page-specific top header */
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; position: sticky; top: 0;
  background: rgba(10,11,15,0.95); backdrop-filter: blur(20px); z-index: 100;
}
.page-header .title { font-size: 17px; font-weight: 700; }
.page-header .back-btn {
  width: 36px; height: 36px; border-radius: 50%; background: var(--bg3);
  display: flex; align-items: center; justify-content: center; cursor: pointer; border: none;
}
.page-header .back-btn svg { width: 16px; height: 16px; stroke: #fff; fill: none; stroke-width: 2.5; }

/* Stats row */
.stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 0 16px; margin-bottom: 12px; }
.stat-card { background: var(--bg2); border: 1px solid var(--border); border-radius: 16px; padding: 16px; }
.stat-card .stat-label { font-size: 11px; color: var(--text2); font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.stat-card .stat-value { font-size: 22px; font-weight: 800; color: #fff; letter-spacing: -0.5px; }

/* Divider */
.divider { height: 1px; background: rgba(255,255,255,0.06); margin: 8px 0; }

/* Empty state */
.empty-state { text-align: center; padding: 48px 24px; color: var(--text3); }
.empty-state svg { width: 48px; height: 48px; stroke: #2a2b38; fill: none; stroke-width: 1.5; margin-bottom: 16px; }
.empty-state p { font-size: 14px; font-weight: 500; }

/* Scrollbar */
::-webkit-scrollbar { width: 0; }
"""
open('styles.css', 'w', encoding='utf-8').write(CSS)
print('styles.css rewritten')
