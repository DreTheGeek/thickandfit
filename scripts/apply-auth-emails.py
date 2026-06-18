#!/usr/bin/env python3
"""Build + apply Thick & Fit branded, bilingual (EN/ES) Supabase auth email templates.

Renders email-client-safe HTML (table layout, inline styles, web-safe fonts) for every
GoTrue auth mail and PATCHes them onto the project's auth config via the Supabase
Management API. Also writes each rendered template to supabase/email-templates/ for review.

Usage:
  SB_MGMT_TOKEN=sbp_xxx python scripts/apply-auth-emails.py [--dry-run]

The Management token is read from the env (never hard-coded). SB_REF defaults to the
Thick & Fit project ref and can be overridden via env.
"""
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

REF = os.environ.get("SB_REF", "cpwesaeyhklmjbqppeah")
TOKEN = os.environ.get("SB_MGMT_TOKEN", "")
DRY = "--dry-run" in sys.argv

OLIVE = "#5EBE62"

# Master shell. Placeholders: __HEADING__ __BODY_EN__ __BODY_ES__ __ACTION__
# Supabase Go-template vars (e.g. {{ .ConfirmationURL }}) live only inside __ACTION__.
SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Thick &amp; Fit</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;">
<tr><td style="background:#000000;padding:22px 32px;">
<span style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:900;letter-spacing:3px;color:#ffffff;text-transform:uppercase;">THICK &amp; FIT</span>
<span style="display:inline-block;width:28px;height:4px;background:#5EBE62;vertical-align:middle;margin-left:10px;"></span>
</td></tr>
<tr><td style="padding:40px 32px 4px 32px;">
<div style="width:40px;height:4px;background:#5EBE62;margin-bottom:22px;"></div>
<h1 style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:30px;line-height:1.08;font-weight:900;letter-spacing:-0.5px;color:#050505;text-transform:uppercase;">__HEADING__</h1>
<p style="margin:0 0 26px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#444444;">__BODY_EN__</p>
__ACTION__
</td></tr>
<tr><td style="padding:18px 32px 36px 32px;">
<div style="border-top:1px solid #ededed;padding-top:22px;">
<p style="margin:0 0 6px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#5EBE62;text-transform:uppercase;">En Espa&ntilde;ol</p>
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#666666;">__BODY_ES__</p>
</div>
</td></tr>
<tr><td style="background:#000000;padding:22px 32px;">
<p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#8a8a8a;">Thick &amp; Fit &middot; Helping women fall in love with the journey<br>If you didn&rsquo;t request this, you can safely ignore this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>"""

BUTTON = """<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px 0;">
<tr><td style="background:#5EBE62;">
<a href="__URL__" style="display:inline-block;padding:15px 34px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:800;letter-spacing:1px;color:#000000;text-decoration:none;text-transform:uppercase;">__LABEL__</a>
</td></tr></table>
<p style="margin:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#999999;">Button not working? Copy this link:<br><span style="color:#5EBE62;word-break:break-all;">__URL__</span></p>"""

CODEBOX = """<div style="display:inline-block;background:#000000;color:#5EBE62;font-family:'Courier New',monospace;font-size:30px;font-weight:bold;letter-spacing:8px;padding:18px 30px;">__TOKEN__</div>"""


def button(label, url_var):
    return BUTTON.replace("__LABEL__", label).replace("__URL__", url_var)


def render(heading, body_en, body_es, action):
    return (
        SHELL.replace("__HEADING__", heading)
        .replace("__BODY_EN__", body_en)
        .replace("__BODY_ES__", body_es)
        .replace("__ACTION__", action)
    )


EMAILS = {
    "confirmation": {
        "subject": "Confirm your email · Thick & Fit",
        "heading": "Confirm your email",
        "en": "You're one tap from your plan. Confirm your email to activate your Thick &amp; Fit account and start training.",
        "es": "Est&aacute;s a un toque de tu plan. Confirma tu correo para activar tu cuenta de Thick &amp; Fit y empezar a entrenar.",
        "action": button("Confirm email", "{{ .ConfirmationURL }}"),
    },
    "recovery": {
        "subject": "Reset your password · Thick & Fit",
        "heading": "Reset your password",
        "en": "Tap below to set a new password. This link works once and expires soon. If you didn't ask for this, ignore this email.",
        "es": "Toca abajo para crear una nueva contrase&ntilde;a. Este enlace funciona una vez y caduca pronto. Si no lo solicitaste, ignora este correo.",
        "action": button("Reset password", "{{ .ConfirmationURL }}"),
    },
    "magic_link": {
        "subject": "Your sign-in link · Thick & Fit",
        "heading": "Your sign-in link",
        "en": "Tap to sign in to Thick &amp; Fit. The link works once and expires soon.",
        "es": "Toca para entrar a Thick &amp; Fit. El enlace funciona una vez y caduca pronto.",
        "action": button("Sign in", "{{ .ConfirmationURL }}"),
    },
    "invite": {
        "subject": "You're invited to Thick & Fit",
        "heading": "You're invited",
        "en": "You've been invited to join Thick &amp; Fit. Tap below to create your account and start your journey.",
        "es": "Te han invitado a Thick &amp; Fit. Toca abajo para crear tu cuenta y comenzar tu camino.",
        "action": button("Accept invite", "{{ .ConfirmationURL }}"),
    },
    "email_change": {
        "subject": "Confirm your new email · Thick & Fit",
        "heading": "Confirm your new email",
        "en": "Confirm this address to finish updating the email on your Thick &amp; Fit account.",
        "es": "Confirma esta direcci&oacute;n para terminar de actualizar el correo de tu cuenta de Thick &amp; Fit.",
        "action": button("Confirm new email", "{{ .ConfirmationURL }}"),
    },
    "reauthentication": {
        "subject": "Your verification code · Thick & Fit",
        "heading": "Verification code",
        "en": "Enter this code to confirm it's you:",
        "es": "Ingresa este c&oacute;digo para confirmar que eres t&uacute;:",
        "action": CODEBOX.replace("__TOKEN__", "{{ .Token }}"),
    },
}


def main():
    out_dir = pathlib.Path("supabase/email-templates")
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {}
    for key, e in EMAILS.items():
        html = render(e["heading"], e["en"], e["es"], e["action"])
        (out_dir / f"{key}.html").write_text(html, encoding="utf-8")
        payload[f"mailer_subjects_{key}"] = e["subject"]
        payload[f"mailer_templates_{key}_content"] = html
    print(f"rendered {len(EMAILS)} templates to {out_dir}/")

    if DRY:
        print("--dry-run: not calling the API")
        return
    if not TOKEN:
        sys.exit("SB_MGMT_TOKEN not set; cannot apply")

    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{REF}/config/auth",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
            "User-Agent": "thickandfit-mgmt/1.0",
        },
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req) as resp:
            print(f"applied to Supabase auth config: HTTP {resp.status}")
    except urllib.error.HTTPError as ex:
        sys.exit(f"API error {ex.code}: {ex.read().decode()[:600]}")


if __name__ == "__main__":
    main()
