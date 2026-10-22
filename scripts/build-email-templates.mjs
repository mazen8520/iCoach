// Generates the iCoach-branded Supabase Auth email templates into supabase/templates/.
// Usage: node scripts/build-email-templates.mjs
// Paste each generated file into Supabase dashboard -> Authentication -> Emails -> Templates
// (subjects are listed in supabase/templates/README.md). {{ .ConfirmationURL }} and friends are
// Supabase's own Go-template placeholders and are filled in when each email is sent.
//
// Email clients ignore <style> blocks, web fonts and SVG unevenly, so everything is tables with
// inline styles, system fonts and one hosted PNG (the app icon).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://i-coach.vercel.app";
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase", "templates");

const c = {
  page: "#111113",
  card: "#1b1b1e",
  raised: "#27272b",
  line: "#34343a",
  text: "#f4f1ed",
  muted: "#a9aab2",
  red: "#ef1a2a",
};
const sans = "'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const display = "'Barlow Condensed', 'Arial Narrow', 'Segoe UI', Arial, sans-serif";
const arabic = "Tahoma, 'Segoe UI', Arial, sans-serif";

/** One brand frame shared by every email. */
function layout({ preheader, eyebrow, title, body, button, note, ar }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${c.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${c.page};">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${c.page}" style="background:${c.page};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<tr><td style="padding:0 4px 20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="${SITE}/icons/icon-192.png" width="40" height="40" alt="" style="display:block;border:0;border-radius:10px;"></td>
<td style="vertical-align:middle;padding-left:12px;font-family:${display};font-size:24px;font-weight:800;letter-spacing:0.02em;color:${c.text};">i<span style="color:${c.red};">Coach</span></td>
</tr></table>
</td></tr>

<tr><td bgcolor="${c.card}" style="background:${c.card};border:1px solid ${c.line};border-radius:14px;overflow:hidden;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td height="4" bgcolor="${c.red}" style="background:${c.red};font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:36px 36px 8px;">
<p style="margin:0 0 10px;font-family:${sans};font-size:12px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${c.red};">${eyebrow}</p>
<h1 style="margin:0 0 16px;font-family:${display};font-size:34px;line-height:1.05;font-weight:800;text-transform:uppercase;color:${c.text};">${title}</h1>
<p style="margin:0 0 28px;font-family:${sans};font-size:16px;line-height:1.6;color:${c.muted};">${body}</p>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${c.red}" style="background:${c.red};border-radius:8px;">
<a href="${button.href}" style="display:inline-block;padding:16px 32px;font-family:${sans};font-size:15px;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:#ffffff;text-decoration:none;">${button.label}</a>
</td></tr></table>
<p style="margin:28px 0 6px;font-family:${sans};font-size:13px;line-height:1.5;color:${c.muted};">Button not working? Paste this link into your browser:</p>
<p style="margin:0 0 28px;font-family:${sans};font-size:13px;line-height:1.5;word-break:break-all;"><a href="${button.href}" style="color:${c.text};text-decoration:underline;">${button.href}</a></p>
</td></tr>
<tr><td style="padding:0 36px 32px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td bgcolor="${c.raised}" style="background:${c.raised};border-radius:10px;padding:16px 18px;font-family:${sans};font-size:13px;line-height:1.55;color:${c.muted};">${note}</td>
</tr></table>
</td></tr>
<tr><td dir="rtl" style="padding:24px 36px 32px;border-top:1px solid ${c.line};text-align:right;">
<p style="margin:0 0 8px;font-family:${arabic};font-size:17px;font-weight:700;color:${c.text};">${ar.title}</p>
<p style="margin:0 0 14px;font-family:${arabic};font-size:14px;line-height:1.7;color:${c.muted};">${ar.body}</p>
<a href="${button.href}" style="font-family:${arabic};font-size:14px;font-weight:700;color:${c.red};text-decoration:none;">${ar.link} &larr;</a>
</td></tr>
</table>
</td></tr>

<tr><td style="padding:24px 4px 0;font-family:${sans};font-size:12px;line-height:1.6;color:${c.muted};">
iCoach &middot; Train, fuel, track and connect with your coach.<br>
This email was sent to {{ .Email }} because of an action on <a href="${SITE}" style="color:${c.muted};">i-coach.vercel.app</a>.
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`;
}

const ignore = "If this wasn't you, ignore this email — nothing changes until the link is opened.";

const templates = {
  "confirm-signup": {
    subject: "Confirm your iCoach account",
    html: layout({
      preheader: "One tap to confirm your email and open your coach dashboard.",
      eyebrow: "Welcome to iCoach",
      title: "Confirm your email",
      body: "You're one step from your coach dashboard. Confirm this is your email address so we can keep your account secure and reach you about your athletes.",
      button: { href: "{{ .ConfirmationURL }}", label: "Confirm my email" },
      note: `The link works once and expires in 1 hour. ${ignore}`,
      ar: {
        title: "أكّد بريدك الإلكتروني",
        body: "أنت على بُعد خطوة واحدة من لوحة المدرب. أكّد أن هذا بريدك الإلكتروني لنحافظ على أمان حسابك.",
        link: "تأكيد البريد الإلكتروني",
      },
    }),
  },
  "reset-password": {
    subject: "Reset your iCoach password",
    html: layout({
      preheader: "Choose a new password for your iCoach account.",
      eyebrow: "Password reset",
      title: "Choose a new password",
      body: "We got a request to reset the password for your iCoach account. Tap the button to pick a new one.",
      button: { href: "{{ .ConfirmationURL }}", label: "Reset password" },
      note: `The link works once and expires in 1 hour. If you didn't ask for this, ignore this email — your current password stays the same.`,
      ar: {
        title: "اختر كلمة مرور جديدة",
        body: "تلقّينا طلبًا لإعادة تعيين كلمة مرور حسابك في iCoach. اضغط على الرابط لاختيار كلمة مرور جديدة.",
        link: "إعادة تعيين كلمة المرور",
      },
    }),
  },
  "magic-link": {
    subject: "Your iCoach sign-in link",
    html: layout({
      preheader: "Tap to sign in to iCoach.",
      eyebrow: "Sign in",
      title: "Your sign-in link",
      body: "Tap the button to sign in to iCoach on this device.",
      button: { href: "{{ .ConfirmationURL }}", label: "Sign in" },
      note: `The link works once and expires in 1 hour. ${ignore}`,
      ar: {
        title: "رابط تسجيل الدخول",
        body: "اضغط على الرابط لتسجيل الدخول إلى iCoach على هذا الجهاز.",
        link: "تسجيل الدخول",
      },
    }),
  },
  "change-email": {
    subject: "Confirm your new iCoach email",
    html: layout({
      preheader: "Confirm the new email address for your iCoach account.",
      eyebrow: "Email change",
      title: "Confirm your new email",
      body: "Confirm that {{ .NewEmail }} should become the email address for your iCoach account.",
      button: { href: "{{ .ConfirmationURL }}", label: "Confirm new email" },
      note: `Until you confirm, you keep signing in with your current address. ${ignore}`,
      ar: {
        title: "أكّد بريدك الإلكتروني الجديد",
        body: "أكّد أن {{ .NewEmail }} سيصبح البريد الإلكتروني لحسابك في iCoach.",
        link: "تأكيد البريد الجديد",
      },
    }),
  },
};

mkdirSync(outDir, { recursive: true });
for (const [name, { html }] of Object.entries(templates)) {
  writeFileSync(join(outDir, `${name}.html`), html);
}
writeFileSync(
  join(outDir, "README.md"),
  `# iCoach email templates

Generated by \`node scripts/build-email-templates.mjs\` — edit the script, not these files.
The emails say links expire in 1 hour, Supabase's default **Email OTP expiration** (3600 s).
Change that wording if you change the setting.

Paste each file into **Supabase dashboard → Authentication → Emails → Templates**:

| Supabase template | File | Subject |
| --- | --- | --- |
${[
  ["Confirm signup", "confirm-signup"],
  ["Reset password", "reset-password"],
  ["Magic link", "magic-link"],
  ["Change email address", "change-email"],
]
  .map(([label, file]) => `| ${label} | \`${file}.html\` | ${templates[file].subject} |`)
  .join("\n")}
`,
);
console.log(`Wrote ${Object.keys(templates).length} templates to ${outDir}`);
