#!/usr/bin/env python3
# Phase 1: emoji removal + class renames (index.html)
import re

P = 'index.html'
s = open(P, encoding='utf-8').read()

# ---------- 1. Emoji / symbol -> text replacements ----------
MAP = {
    '\U0001F4B0': '$', '\U0001F4B5': '$', '\U0001F4B8': '$',
    '\u2705': 'Done', '\u274C': 'Failed', '\u26A0': '!',
    '\u27A1': '', '\u21A9': '', '\u21AA': '', '\u2B06': '', '\u2B07': '',
    '\U0001F947': '1st', '\U0001F948': '2nd', '\U0001F949': '3rd',
}
for k, v in MAP.items():
    s = s.replace(k, v)

# strip variation selectors
s = s.replace('\uFE0F', '').replace('\uFE0E', '')

# remove any remaining emoji / dingbat / misc-symbol / arrow chars entirely
RANGES = r'\U0001F000-\U0001FAFF\u2600-\u26FF\u2700-\u27BF\u2B00-\u2BFF\u2190-\u21FF\u2300-\u23FF\u2B50\u2B55\u3030\u303D\u00A9\u00AE\u203C\u2049'
s = re.sub('[' + RANGES + ']+', '', s)

# tidy artifacts left by removals
s = re.sub(r'\{\s*,', '{,', s)                      # { , from removed leading icon strings
s = re.sub(r"icon:\s*'',", "icon: '',", s)
s = re.sub(r'>\s+</div>', '></div>', s)             # emptied inline spans like <span class="ico"></span> handled below
s = re.sub(r'<span class="ico">\s*</span>\s*', '', s)
s = re.sub(r'\(\s*\)', '()', s)                     # collapsed call parens only where empty already
s = s.replace("' ', '", "', '")
s = re.sub(r'\bnull\s+null\b', 'null', s)
s = re.sub(r'  +', lambda m: m.group(0) if len(m.group(0)) > 4 else '  ', s)  # keep indentation sane (no-op guard)

print('remaining emoji count:', len(re.findall('[' + RANGES + r']', s)))

# ---------- 2. Button class renames ----------
subs = [
    ('class="btn btn-p btn-sm btn-full"', 'class="btn-primary" style="padding:12px;width:100%"'),
    ('class="btn btn-p btn-full"', 'class="btn-primary" style="width:100%"'),
    ('class="btn btn-p btn-sm active', 'class="btn-primary" style="padding:12px'),
    ('class="btn btn-p btn-sm"', 'class="btn-primary" style="padding:12px"'),
    ('class="btn btn-p btn-sm ', 'class="btn-primary" style="padding:12px'),
    ('class="btn btn-p"', 'class="btn-primary"'),
    ('class="btn btn-p ', 'class="btn-primary '),
    ("class='btn btn-p'", "class='btn-primary'"),
    ("class='btn btn-p ", "class='btn-primary "),
    ('class="btn btn-d btn-sm"', 'class="btn-secondary" style="color:#ff4d6a;padding:12px"'),
    ('class="btn btn-d btn-sm ', 'class="btn-secondary" style="color:#ff4d6a;padding:12px'),
    ('class="btn btn-d"', 'class="btn-secondary" style="color:#ff4d6a"'),
    ('class="btn btn-d ', 'class="btn-secondary" style="color:#ff4d6a'),
    ("class='btn btn-d", "class='btn-secondary' style='color:#ff4d6a"),
    ('class="btn btn-gh btn-sm"', 'class="btn-secondary" style="padding:12px"'),
    ('class="btn btn-gh btn-sm ', 'class="btn-secondary" style="padding:12px'),
    ('class="btn btn-gh"', 'class="btn-secondary"'),
    ('class="btn btn-gh ', 'class="btn-secondary '),
    ("class='btn btn-gh", "class='btn-secondary"),
    ('class="btn btn-gold btn-sm"', 'class="btn-secondary" style="color:#f5b942;padding:12px"'),
    ('class="btn btn-gold btn-sm ', 'class="btn-secondary" style="color:#f5b942;padding:12px'),
    ('class="btn btn-gold"', 'class="btn-secondary" style="color:#f5b942"'),
    ('class="btn btn-gold ', 'class="btn-secondary" style="color:#f5b942'),
    ('class="btn btn-sky btn-sm"', 'class="btn-secondary" style="color:#4f8ef7;padding:12px"'),
    ('class="btn btn-sky"', 'class="btn-secondary" style="color:#4f8ef7"'),
    ('class="btn btn-sky ', 'class="btn-secondary" style="color:#4f8ef7'),
    ('class="btn btn-o btn-sm"', 'class="btn-secondary" style="padding:12px"'),
    ('class="btn btn-o"', 'class="btn-secondary"'),
    ('class="btn btn-o ', 'class="btn-secondary '),
    ('class="btn btn-sm"', 'class="btn-secondary" style="padding:12px"'),
    ('class="btn btn-sm ', 'class="btn-secondary" style="padding:12px'),
    ('class="btn btn-full"', 'class="btn-primary" style="width:100%"'),
    ('class="btn"', 'class="btn-primary"'),
    ('class="btn ', 'class="btn-primary '),
]
for a, b in subs:
    s = s.replace(a, b)

# ---------- 3. Input class renames ----------

s = re.sub(r'<(input|select|textarea)((?:(?!class="fi)[^>])*?)class="fi(?=[" ])',
           lambda m: '<%s%sclass="input-field"%s' % (m.group(1), m.group(2), ''), s)
# simpler deterministic pass:
s = s.replace('class="fi"', 'class="input-field"')
s = s.replace("class='fi'", "class='input-field'")
s = s.replace('class="fi ca-video', 'class="input-field ca-video')
s = s.replace('class="fi pred-outcome', 'class="input-field pred-outcome')
s = s.replace('class="fi sv-q-ans', 'class="input-field sv-q-ans')
s = s.replace('class="fi ', 'class="input-field ')

# ---------- 4. Badge -> pill renames ----------
pairs = [
    ('class="badge bg"', 'class="pill pill-green"'),
    ('class="badge bg ', 'class="pill pill-green '),
    ('class="badge br"', 'class="pill pill-red"'),
    ('class="badge br ', 'class="pill pill-red '),
    ('class="badge bgold"', 'class="pill pill-gold"'),
    ('class="badge bgold ', 'class="pill pill-gold '),
    ('class="badge bsky"', 'class="pill pill-blue"'),
    ('class="badge bsky ', 'class="pill pill-blue '),
    ('class="badge bmut"', 'class="pill pill-grey"'),
    ('class="badge bmut ', 'class="pill pill-grey '),
    ('class="badge bpur"', 'class="pill pill-blue"'),
    ('class="badge bdanger"', 'class="pill pill-red"'),
    ('class="badge"', 'class="pill pill-grey"'),
    ("<span class=\"badge bg\">", "<span class=\"pill pill-green\">"),
    ("<span class=\"badge br\">", "<span class=\"pill pill-red\">"),
    ("<span class=\"badge bgold\">", "<span class=\"pill pill-gold\">"),
    ("<span class=\"badge bmut\">", "<span class=\"pill pill-grey\">"),
    ("<span class=\"badge bsky\">", "<span class=\"pill pill-blue\">"),
    ("'<span class=\"badge bg\"", "'<span class=\"pill pill-green\""),
    ("'<span class=\"badge br\"", "'<span class=\"pill pill-red\""),
    ("'<span class=\"badge bgold\"", "'<span class=\"pill pill-gold\""),
    ("'<span class=\"badge bmut\"", "'<span class=\"pill pill-grey\""),
    ("class=\"badge ${", "class=\"pill ${"),
    ("'badge bg'", "'pill pill-green'"),
    ("'badge br'", "'pill pill-red'"),
    ("'badge bgold'", "'pill pill-gold'"),
    ("'badge bmut'", "'pill pill-grey'"),
    ("'badge bsky'", "'pill pill-blue'"),
    ("'badge bpur'", "'pill pill-blue'"),
    ("'badge bdanger'", "'pill pill-red'"),
    ("'badge '", "'pill '"),
]
for a, b in pairs:
    s = s.replace(a, b)
# map statusColor-style single-letter pill vars used in templates
s = s.replace("? 'bg' :", "? 'pill-green' :")
s = s.replace("?'bg':", "?'pill-green':")
s = s.replace("?'br':", "?'pill-red':")
s = s.replace("?'bmut':", "?'pill-grey':")
s = s.replace("?'bgold':", "?'pill-gold':")
s = s.replace("'bdanger'", "'pill-red'")

open(P, 'w', encoding='utf-8').write(s)
print('phase1 done')
