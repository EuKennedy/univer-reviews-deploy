import { Resend } from 'resend'

const apiKey = process.env.RESEND_API_KEY
const fromEmail = process.env.AUTH_FROM_EMAIL || 'auth@univerreviews.com'

const resend = apiKey ? new Resend(apiKey) : null

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY missing — would send to ${to}: ${subject}`)
    return
  }

  const { error } = await resend.emails.send({
    from: `UniverReviews <${fromEmail}>`,
    to: [to],
    subject,
    html,
  })

  if (error) {
    console.error('[email] Resend error:', error)
    throw new Error(`Email send failed: ${error.message}`)
  }
}

// ─── Templates ────────────────────────────────────────────────────────────────

export function magicLinkTemplate({
  url,
  email,
}: {
  url: string
  email: string
}): { subject: string; html: string } {
  return {
    subject: 'Acesse sua conta UniverReviews',
    html: `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; background: #0a0a0b; color: #f0f0f2;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">Entre na sua conta</h1>
  <p style="color: #8b8b96; line-height: 1.6; margin: 0 0 24px;">
    Olá, ${email}. Clique no botão abaixo para entrar. O link expira em 15 minutos.
  </p>
  <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #d4a850, #c49040); color: #0a0a0b; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
    Entrar agora
  </a>
  <p style="color: #5a5a64; font-size: 12px; margin: 32px 0 0;">
    Se você não solicitou este e-mail, ignore-o.
  </p>
</body></html>
    `.trim(),
  }
}

export function verificationTemplate({
  url,
  email,
}: {
  url: string
  email: string
}): { subject: string; html: string } {
  return {
    subject: 'Confirme seu e-mail — UniverReviews',
    html: `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; background: #0a0a0b; color: #f0f0f2;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">Confirme seu e-mail</h1>
  <p style="color: #8b8b96; line-height: 1.6; margin: 0 0 24px;">
    Bem-vindo ao UniverReviews. Confirme o e-mail ${email} clicando abaixo.
  </p>
  <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #d4a850, #c49040); color: #0a0a0b; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
    Confirmar e-mail
  </a>
</body></html>
    `.trim(),
  }
}

export function invitationTemplate({
  url,
  inviterName,
  organizationName,
}: {
  url: string
  inviterName: string
  organizationName: string
}): { subject: string; html: string } {
  return {
    subject: `${inviterName} convidou você para ${organizationName}`,
    html: `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 20px; background: #0a0a0b; color: #f0f0f2;">
  <h1 style="font-size: 22px; margin: 0 0 16px;">Você foi convidado</h1>
  <p style="color: #8b8b96; line-height: 1.6; margin: 0 0 24px;">
    <strong style="color: #f0f0f2;">${inviterName}</strong> convidou você para colaborar em
    <strong style="color: #f0f0f2;">${organizationName}</strong> no UniverReviews.
  </p>
  <a href="${url}" style="display: inline-block; background: linear-gradient(135deg, #d4a850, #c49040); color: #0a0a0b; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600;">
    Aceitar convite
  </a>
</body></html>
    `.trim(),
  }
}
