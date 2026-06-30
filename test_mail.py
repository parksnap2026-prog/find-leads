#!/usr/bin/env python3
"""
Email server connection tester.
Tests SMTP, IMAP, and POP3 connectivity for mail.webpower.blog
"""

import smtplib
import imaplib
import poplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid

# ── Configuration ─────────────────────────────────────────────
MAIL_SERVER   = "mail.webpower.blog"
SMTP_PORT     = 465
IMAP_PORT     = 993
POP3_PORT     = 995
USERNAME      = "business@webpower.blog"
PASSWORD      = "WebPower123@"
FROM_NAME     = "WebPower Business"
TO_ADDRESSES  = [
    "jordanarizanov@gmail.com",
    "krstev_kire@yahoo.com",
]
# ──────────────────────────────────────────────────────────────

GREEN = "\033[92m"
RED   = "\033[91m"
RESET = "\033[0m"
OK    = f"{GREEN}[OK]{RESET}"
FAIL  = f"{RED}[FAIL]{RESET}"


def build_message(to_addr):
    msg = MIMEMultipart("alternative")
    msg["From"]       = f"{FROM_NAME} <{USERNAME}>"
    msg["To"]         = to_addr
    msg["Subject"]    = "Mail server test – WebPower"
    msg["Date"]       = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain="webpower.blog")
    msg["X-Mailer"]   = "WebPower Mailer"

    plain = (
        f"Hello,\n\n"
        f"This is a connectivity test from {FROM_NAME} via {MAIL_SERVER}.\n\n"
        f"If you received this, the mail server is working correctly.\n\n"
        f"-- {FROM_NAME}"
    )
    html = f"""\
<html><body style="font-family:sans-serif;color:#222;max-width:560px;margin:auto">
  <p>Hello,</p>
  <p>This is a connectivity test from <strong>{FROM_NAME}</strong> via
     <code>{MAIL_SERVER}</code>.</p>
  <p>If you received this, the mail server is working correctly.</p>
  <p style="color:#666">-- {FROM_NAME}</p>
</body></html>"""

    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html, "html"))
    return msg


def test_smtp():
    print(f"\n── SMTP (SSL:{SMTP_PORT}) ──────────────────────────────")
    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP_SSL(MAIL_SERVER, SMTP_PORT, context=ctx, timeout=10) as s:
            print(f"  Connected      {OK}")
            s.ehlo()
            print(f"  EHLO           {OK}")
            s.login(USERNAME, PASSWORD)
            print(f"  Login          {OK}")
            for addr in TO_ADDRESSES:
                try:
                    msg = build_message(addr)
                    s.sendmail(USERNAME, addr, msg.as_string())
                    print(f"  Send → {addr:<35} {OK}")
                except Exception as e:
                    print(f"  Send → {addr:<35} {FAIL}  {e}")
    except Exception as e:
        print(f"  SMTP connection {FAIL}  {e}")


def test_imap():
    print(f"\n── IMAP (SSL:{IMAP_PORT}) ──────────────────────────────")
    try:
        m = imaplib.IMAP4_SSL(MAIL_SERVER, IMAP_PORT)
        print(f"  Connected      {OK}")
        m.login(USERNAME, PASSWORD)
        print(f"  Login          {OK}")
        m.logout()
    except Exception as e:
        print(f"  IMAP connection {FAIL}  {e}")


def test_pop3():
    print(f"\n── POP3 (SSL:{POP3_PORT}) ──────────────────────────────")
    try:
        p = poplib.POP3_SSL(MAIL_SERVER, POP3_PORT, timeout=10)
        print(f"  Connected      {OK}")
        p.user(USERNAME)
        p.pass_(PASSWORD)
        print(f"  Login          {OK}")
        p.quit()
    except Exception as e:
        print(f"  POP3 connection {FAIL}  {e}")


if __name__ == "__main__":
    print("=" * 55)
    print(f"  Mail server test  →  {MAIL_SERVER}")
    print(f"  User             →  {USERNAME}")
    print(f"  Sending to       →  {', '.join(TO_ADDRESSES)}")
    print("=" * 55)
    test_smtp()
    test_imap()
    test_pop3()
    print("\nDone.\n")
