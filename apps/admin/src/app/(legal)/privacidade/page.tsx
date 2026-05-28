import { LEGAL_VERSIONS, PRIVACY_CHANGELOG, SUB_PROCESSORS, BRAND } from '@/lib/legal'

export const metadata = {
  title: `Política de Privacidade — ${BRAND.product}`,
  description: `Política de Privacidade da plataforma ${BRAND.product} — conforme LGPD (Lei 13.709/2018).`,
}

export default function PrivacyPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Política de Privacidade</h1>
        <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
          Versão {LEGAL_VERSIONS.privacy} · Atualizado em {LEGAL_VERSIONS.privacy} · Conforme LGPD (Lei 13.709/2018)
        </p>
      </header>

      <Section title="1. Quem somos">
        <p>
          {BRAND.product} é um produto operado por {BRAND.company}, controladora dos dados
          tratados pela plataforma. Encarregado de Proteção de Dados (DPO) pode ser contatado
          em <a href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>.
        </p>
      </Section>

      <Section title="2. Dados que coletamos">
        <h3 className="text-base font-semibold mt-3 mb-1">2.1 Dados de conta</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Nome, e-mail (obrigatório para autenticação).</li>
          <li>Domínios de loja registrados na conta (para validar widget + webhooks).</li>
          <li>IP de origem e user-agent (logs de sessão, retenção 30 dias).</li>
          <li>Foto de perfil (quando faz login via Google OAuth — opcional).</li>
        </ul>

        <h3 className="text-base font-semibold mt-3 mb-1">2.2 Dados importados da sua loja</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Avaliações de produtos (texto, nota, autor, e-mail do autor, fotos/vídeos).</li>
          <li>Catálogo de produtos (nome, SKU, descrição, imagem) sincronizado via WooCommerce/Shopify.</li>
          <li>Pedidos (apenas IDs e e-mail do comprador, para verificar avaliação verificada).</li>
        </ul>

        <h3 className="text-base font-semibold mt-3 mb-1">2.3 Dados de uso</h3>
        <ul className="list-disc pl-6 space-y-1">
          <li>Logs de auditoria (quem fez o quê, quando — Art. 37 LGPD).</li>
          <li>Métricas agregadas de uso (não-identificáveis) para melhoria do serviço.</li>
          <li>Erros de aplicação enviados ao Sentry com PII removida.</li>
        </ul>
      </Section>

      <Section title="3. Finalidades">
        <ul className="list-disc pl-6 space-y-1">
          <li>Operar o serviço contratado (coleta, moderação, exibição de avaliações).</li>
          <li>Autenticar e proteger contas contra acesso não autorizado.</li>
          <li>Enviar e-mails transacionais (verificação, magic-link, recuperação).</li>
          <li>Sugerir respostas e gerar sumários por meio de IA, sempre supervisionado pelo lojista.</li>
          <li>Cumprir obrigações legais (fiscais, regulatórias, judiciais).</li>
        </ul>
      </Section>

      <Section title="4. Sub-operadores (compartilhamento)">
        <p>
          Para operar o serviço, compartilhamos dados estritamente necessários com os
          seguintes sub-operadores. Todos têm contrato vigente que exige aderência à LGPD:
        </p>
        <table className="w-full text-sm mt-3" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--ur-border)' }}>
              <th className="text-left py-2 px-3 font-semibold">Sub-operador</th>
              <th className="text-left py-2 px-3 font-semibold">Finalidade</th>
            </tr>
          </thead>
          <tbody>
            {SUB_PROCESSORS.map((sp) => (
              <tr key={sp.name} style={{ borderBottom: '1px solid var(--ur-border-soft)' }}>
                <td className="py-2 px-3 font-medium" style={{ color: 'var(--ur-text)' }}>
                  {sp.name}
                </td>
                <td className="py-2 px-3" style={{ color: 'var(--ur-text-soft)' }}>
                  {sp.purpose}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="5. Seus direitos (Art. 18 LGPD)">
        <p>
          A LGPD garante ao titular os direitos abaixo. Para exercer qualquer um, escreva
          para <a href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>. Resposta em
          até 15 dias úteis.
        </p>
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>I — Confirmação de tratamento.</strong> Endpoint público em <code>/conta/profile</code>.</li>
          <li><strong>II — Acesso.</strong> Idem.</li>
          <li><strong>III — Correção.</strong> Você pode editar nome, e-mail e foto em <code>/conta/profile</code>.</li>
          <li><strong>IV — Anonimização, bloqueio ou eliminação.</strong> Solicite via DPO.</li>
          <li>
            <strong>V — Portabilidade.</strong> Exporte um JSON com todos os dados da sua
            conta clicando em "Exportar meus dados" em <code>/conta/privacy</code>.
          </li>
          <li>
            <strong>VI — Eliminação.</strong> Clique em "Excluir minha conta" em{' '}
            <code>/conta/privacy</code>. Retenção de 30 dias antes da hard-delete, depois
            dados são permanentemente removidos. Tabelas com FK em <code>ON DELETE CASCADE</code>{' '}
            limpam automaticamente o restante.
          </li>
          <li><strong>VII — Informação sobre compartilhamento.</strong> Vide seção 4.</li>
          <li><strong>VIII — Recusa de consentimento.</strong> Cookie banner permite recusar trackers não-essenciais.</li>
          <li><strong>IX — Revogação.</strong> A qualquer momento via DPO ou exclusão da conta.</li>
        </ul>
      </Section>

      <Section title="6. Retenção">
        <ul className="list-disc pl-6 space-y-1">
          <li>Dados de conta: enquanto a conta estiver ativa + 30 dias após exclusão.</li>
          <li>Avaliações importadas: enquanto a conta estiver ativa.</li>
          <li>Logs de auditoria: 12 meses (obrigação fiscal/regulatória).</li>
          <li>Logs de erro (Sentry): 90 dias.</li>
          <li>Backups criptografados: 30 dias, rotacionados.</li>
        </ul>
      </Section>

      <Section title="7. Segurança técnica">
        <ul className="list-disc pl-6 space-y-1">
          <li>Senhas armazenadas com bcrypt (cost 12).</li>
          <li>Comunicação 100% via HTTPS (TLS 1.3).</li>
          <li>
            Isolação multi-tenant rigorosa via PostgreSQL Row-Level Security
            (FORCE ROW LEVEL SECURITY em todas as tabelas com workspace_id).
          </li>
          <li>API tokens com escopo de workspace, rotacionáveis.</li>
          <li>Webhooks com HMAC-SHA256 + janela de replay de 5min.</li>
          <li>Monitoramento de erros com PII anonimizada antes do envio (Sentry beforeSend).</li>
          <li>Backup diário criptografado com retenção de 30 dias.</li>
        </ul>
      </Section>

      <Section title="8. Cookies">
        <p>
          Usamos cookies essenciais (sessão Better Auth, escolha de workspace) e cookies
          analíticos opcionais. O banner de cookies exibido na primeira visita permite optar
          por "Apenas essenciais" ou "Aceitar todos". A escolha fica registrada localmente
          (<code>localStorage</code>) e pode ser revertida limpando os dados do site.
        </p>
      </Section>

      <Section title="9. Crianças e adolescentes">
        <p>
          O {BRAND.product} não se destina a menores de 18 anos. Se identificarmos uma conta
          aberta por menor sem consentimento dos responsáveis, ela será encerrada e os dados
          eliminados.
        </p>
      </Section>

      <Section title="10. DPO — Encarregado de Proteção de Dados">
        <p>
          Para qualquer assunto relacionado a este documento ou ao tratamento de dados:
          <br />
          <strong>{BRAND.company} — Encarregado de Proteção de Dados</strong>
          <br />
          <a href={`mailto:${BRAND.privacyEmail}`}>{BRAND.privacyEmail}</a>
        </p>
      </Section>

      <Section title="11. Alterações">
        <p>
          Mudanças nesta política geram nova versão (campo no topo) e exigem novo aceite
          ativo no dashboard antes do próximo acesso.
        </p>
      </Section>

      <hr className="my-12" style={{ borderColor: 'var(--ur-border)' }} />

      <Section title="Histórico de alterações">
        <ul className="space-y-3 text-sm">
          {PRIVACY_CHANGELOG.map((entry) => (
            <li key={entry.version}>
              <span className="font-mono" style={{ color: 'var(--ur-text-muted)' }}>
                v{entry.version}
              </span>
              <ul className="mt-1 list-disc pl-6">
                {entry.highlights.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Section>
    </article>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--ur-text)' }}>
        {title}
      </h2>
      <div className="space-y-2" style={{ color: 'var(--ur-text-soft)' }}>
        {children}
      </div>
    </section>
  )
}
