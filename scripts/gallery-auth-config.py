"""
Supabase Auth settings for client accounts, printed as JSON for PATCH /v1/projects/<ref>/config/auth
(used by scripts/gallery-go-live.sh; `python3 scripts/gallery-auth-config.py https://illuszionzmedia.com --preview`
writes the emails to HTML files instead so they can be checked in a browser).

Accounts are password-only. Every email link points at our own /account/ page with a one-time token_hash, and that
page finishes the job (confirm the email, set a new password, confirm an email change). Links never go through
Supabase's redirect, so they work from any device and mail scanners that pre-open links can't use them up.
With RESEND_API_KEY + EMAIL_FROM in the environment, Supabase sends these through Resend as Illuszionz Media.
"""
import json, os, re, sys

site = (sys.argv[1] if len(sys.argv) > 1 else 'https://illuszionzmedia.com').rstrip('/')
SANS = "-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
SERIF = "'Playfair Display',Georgia,'Times New Roman',serif"


def email(title, lines, button, link, after):
    paras = ''.join(f'<p style="margin:0 0 14px;font-family:{SANS};font-size:15.5px;line-height:1.7;color:#0a0a0a">{t}</p>' for t in lines)
    return f"""<!doctype html><html><body style="margin:0;padding:0;background:#f4f3ef">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f3ef"><tr><td align="center" style="padding:32px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #dcdad2;border-radius:18px;overflow:hidden">
<tr><td style="background:#0a0a0a;padding:30px 36px"><img src="{site}/images/illuszionz-logo-white.png" width="170" alt="Illuszionz Media" style="display:block;width:170px;height:auto;border:0"></td></tr>
<tr><td style="padding:38px 36px 34px">
<h1 style="margin:0 0 18px;font-family:{SERIF};font-weight:700;font-size:30px;line-height:1.2;color:#0a0a0a">{title}</h1>
{paras}
<div style="margin:28px 0 8px"><a href="{link}" style="display:inline-block;padding:16px 34px;background:#0a0a0a;color:#ffffff;font-family:{SANS};font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;border-radius:999px">{button}</a></div>
<p style="margin:22px 0 0;font-family:{SANS};font-size:12.5px;line-height:1.7;color:#85847e">{after}</p>
<p style="margin:10px 0 0;font-family:{SANS};font-size:12px;line-height:1.6;color:#85847e;word-break:break-all">Button not working? Copy this link into your browser:<br><a href="{link}" style="color:#85847e">{link}</a></p>
</td></tr>
<tr><td style="padding:22px 36px;border-top:1px solid #dcdad2;font-family:{SANS};font-size:12px;line-height:1.6;color:#85847e">Illuszionz Media · <a href="{site}" style="color:#85847e">illuszionzmedia.com</a> · info@illuszionzmedia.com</td></tr>
</table></td></tr></table></body></html>"""


link = lambda kind: site + '/account/?token_hash={{ .TokenHash }}&type=' + kind

templates = {
    'confirmation': ('Confirm your email · Illuszionz Media', email(
        'Confirm your email',
        ['Welcome to Illuszionz Media. Confirm your email address to finish creating your account.',
         'Your account keeps your bookings and photo galleries in one place, so you can come back to them any time.'],
        'Confirm my email', link('email'),
        "If you didn't create an account, you can ignore this email.")),
    'recovery': ('Reset your password · Illuszionz Media', email(
        'Reset your password',
        ['We got a request to reset the password for your Illuszionz Media account.',
         'Press the button to choose a new one. The link works once and expires in one hour.'],
        'Choose a new password', link('recovery'),
        "If you didn't ask for this, you can ignore this email. Your password stays the same.")),
    'email_change': ('Confirm your new email · Illuszionz Media', email(
        'Confirm your new email',
        ['You asked to change the email on your Illuszionz Media account to <b>{{ .NewEmail }}</b>.',
         'Press the button to confirm the change.'],
        'Confirm new email', link('email_change'),
        "If you didn't ask for this, ignore this email and let us know.")),
    # not used by the site (sign-in is password-only); branded in case Supabase ever sends one
    'magic_link': ('Your sign-in link · Illuszionz Media', email(
        'Sign in to your account',
        ['Press the button to sign in to your Illuszionz Media account.'],
        'Sign in', link('email'),
        "If you didn't ask for this, you can ignore this email.")),
}

cfg = {
    'site_url': site,
    'uri_allow_list': ','.join([f'{site}/**', 'http://localhost:3000/**', 'http://localhost:4173/**']),
    'disable_signup': False,
    'external_email_enabled': True,
    'mailer_autoconfirm': False,  # new accounts must confirm their email before signing in
    'mailer_secure_email_change_enabled': True,
    'password_min_length': 8,
    'mailer_otp_exp': 3600,
}
for key, (subject, html) in templates.items():
    cfg[f'mailer_subjects_{key}'] = subject
    cfg[f'mailer_templates_{key}_content'] = html

key = os.environ.get('RESEND_API_KEY', '').strip()
sender = os.environ.get('EMAIL_FROM', '').strip()
if key and sender:
    m = re.search(r'<([^>]+)>', sender)
    cfg.update({'smtp_host': 'smtp.resend.com', 'smtp_port': '465', 'smtp_user': 'resend', 'smtp_pass': key,
                'smtp_admin_email': m.group(1) if m else sender, 'smtp_sender_name': 'Illuszionz Media',
                'smtp_max_frequency': 30, 'rate_limit_email_sent': 100})

if '--preview' in sys.argv:
    out = sys.argv[sys.argv.index('--preview') + 1]
    os.makedirs(out, exist_ok=True)
    for k, (subject, html) in templates.items():
        open(os.path.join(out, f'{k}.html'), 'w').write(html.replace('{{ .TokenHash }}', 'pkce_example').replace('{{ .NewEmail }}', 'new@example.com'))
    print('\n'.join(f'{k}: {s}' for k, (s, _) in templates.items()))
else:
    print(json.dumps(cfg))
