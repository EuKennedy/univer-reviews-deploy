class MagicLinkMailerJob < ApplicationJob
  queue_as :mailers

  FROM_EMAIL = ENV.fetch("FROM_EMAIL", "auth@univerreviews.com")
  MAGIC_LINK_BASE = ENV.fetch("ADMIN_URL", "https://app.univerreviews.com")

  def perform(user_id:, raw_token:, workspace_name:)
    user = WorkspaceUser.find_by(id: user_id)
    return unless user

    magic_url = "#{MAGIC_LINK_BASE}/auth/verify?token=#{CGI.escape(raw_token)}"

    Resend::Emails.send({
      from: "UniverReviews <#{FROM_EMAIL}>",
      to: user.email,
      subject: "Seu link de acesso — #{workspace_name}",
      html: email_html(user, magic_url, workspace_name)
    })
  rescue => e
    Rails.logger.error("MagicLinkMailerJob failed for user #{user_id}: #{e.message}")
    raise
  end

  private

  def email_html(user, url, workspace_name)
    <<~HTML
      <!DOCTYPE html>
      <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                     background: #0a0a0a; color: #f0f0f0; margin: 0; padding: 40px;">
          <div style="max-width: 480px; margin: 0 auto; background: #111; border-radius: 12px;
                      padding: 40px; border: 1px solid #222;">
            <h1 style="font-size: 20px; font-weight: 600; color: #d4a850; margin: 0 0 8px;">
              UniverReviews
            </h1>
            <p style="color: #aaa; margin: 0 0 32px; font-size: 14px;">#{workspace_name}</p>

            <h2 style="font-size: 16px; font-weight: 500; color: #f0f0f0; margin: 0 0 16px;">
              Olá, #{user.name.split(" ").first}
            </h2>
            <p style="color: #bbb; font-size: 14px; line-height: 1.6; margin: 0 0 32px;">
              Clique no botão abaixo para acessar sua conta.<br>
              Este link é válido por 15 minutos e pode ser usado apenas uma vez.
            </p>

            <a href="#{url}"
               style="display: inline-block; background: #d4a850; color: #0a0a0a;
                      text-decoration: none; padding: 14px 28px; border-radius: 8px;
                      font-weight: 600; font-size: 15px;">
              Acessar minha conta
            </a>

            <p style="color: #555; font-size: 12px; margin: 32px 0 0;">
              Se você não solicitou este link, ignore este email com segurança.
            </p>
          </div>
        </body>
      </html>
    HTML
  end
end
