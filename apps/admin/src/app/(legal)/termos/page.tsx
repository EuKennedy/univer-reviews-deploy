import { LEGAL_VERSIONS, TERMS_CHANGELOG, BRAND } from '@/lib/legal'

export const metadata = {
  title: `Termos de Uso — ${BRAND.product}`,
  description: `Termos de Uso da plataforma ${BRAND.product}.`,
}

export default function TermsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Termos de Uso</h1>
        <p className="text-sm" style={{ color: 'var(--ur-text-muted)' }}>
          Versão {LEGAL_VERSIONS.terms} · Atualizado em {LEGAL_VERSIONS.terms}
        </p>
      </header>

      <Section title="1. Aceitação">
        <p>
          Ao criar uma conta ou utilizar qualquer recurso da plataforma {BRAND.product},
          operada por {BRAND.company}, você declara ter lido, compreendido e aceitado integralmente
          estes Termos de Uso e a <a href="/privacidade">Política de Privacidade</a>. Caso não
          concorde, encerre o uso imediatamente.
        </p>
      </Section>

      <Section title="2. Descrição do serviço">
        <p>
          O {BRAND.product} é uma plataforma SaaS de gestão de avaliações de produtos para
          lojas e-commerce. Oferece coleta, moderação (manual e por IA), exibição em widget
          embarcado, integrações com WooCommerce/Shopify, geração de sumários por IA, programas
          de fidelidade e campanhas de e-mail. Recursos disponíveis dependem do plano contratado.
        </p>
      </Section>

      <Section title="3. Responsabilidades do usuário">
        <ul className="list-disc pl-6 space-y-1">
          <li>Manter credenciais de acesso em sigilo. O uso da conta é responsabilidade do titular.</li>
          <li>Não coletar avaliações falsas, fraudulentas ou que violem direitos de terceiros.</li>
          <li>Cumprir leis brasileiras e estrangeiras aplicáveis, incluindo LGPD e CDC.</li>
          <li>Não usar a plataforma para discurso de ódio, spam, ou qualquer atividade ilegal.</li>
          <li>Manter dados de contato (e-mail, telefone) atualizados para comunicações operacionais.</li>
        </ul>
      </Section>

      <Section title="4. Geração de avaliações por IA">
        <p>
          A funcionalidade <strong>Bulk Create Reviews via IA</strong> e geradores de sumário
          (Sumário de IA, Perguntas e Respostas) usam modelos da Anthropic (Claude) treinados
          em dados públicos. O usuário é responsável por revisar o conteúdo gerado antes de
          publicar. Avaliações geradas por IA recebem flag interna (<code>ai_is_synthetic</code>)
          e podem ser exibidas como tal a critério do plano. O uso para enganar consumidores
          finais configura prática enganosa (Art. 37 do CDC) e é proibido pelos presentes Termos.
        </p>
      </Section>

      <Section title="5. Privacidade e proteção de dados">
        <p>
          O tratamento de dados pessoais segue a Lei Geral de Proteção de Dados (LGPD —
          Lei 13.709/2018). Consulte nossa{' '}
          <a href="/privacidade">Política de Privacidade</a> para detalhes sobre coleta,
          finalidade, compartilhamento e direitos do titular (Art. 18 LGPD).
        </p>
      </Section>

      <Section title="6. Pagamento e planos">
        <p>
          Os planos disponíveis (Free, Starter, Pro, Enterprise) e seus preços vigentes estão
          publicados em <a href="/pricing">/pricing</a>. Assinaturas pagas são processadas
          pela Stripe. Cancelamento pode ser feito a qualquer momento no portal de cliente
          (<a href="/billing">/billing</a>) e tem efeito ao final do ciclo vigente. Não há
          reembolso proporcional, salvo previsão legal contrária.
        </p>
      </Section>

      <Section title="7. Disponibilidade e SLA">
        <p>
          O serviço é fornecido <em>as-is</em>, com esforço razoável para manter disponibilidade.
          Planos Pro e Enterprise contam com SLA específico publicado em contrato anexo. Não nos
          responsabilizamos por interrupções decorrentes de manutenção programada, falhas de
          terceiros (Coolify, Stripe, Resend, Anthropic, Cloudflare), eventos de força maior
          ou ações regulatórias.
        </p>
      </Section>

      <Section title="8. Limitação de responsabilidade">
        <p>
          {BRAND.company} não se responsabiliza por danos indiretos, lucros cessantes, perda
          de dados ou prejuízos comerciais decorrentes do uso ou indisponibilidade da
          plataforma. A responsabilidade total, em qualquer hipótese, fica limitada ao valor
          pago pelo usuário nos 12 (doze) meses anteriores ao fato gerador.
        </p>
      </Section>

      <Section title="9. Suspensão e encerramento">
        <p>
          Reservamo-nos o direito de suspender ou encerrar contas que violem estes Termos,
          que apresentem atividade fraudulenta, que estejam inadimplentes por mais de 7 dias
          ou cujo conteúdo viole direitos de terceiros. Notificação prévia é encaminhada
          quando possível.
        </p>
      </Section>

      <Section title="10. Alterações">
        <p>
          Estes Termos podem ser alterados a qualquer momento. Mudanças materiais geram nova
          versão (campo no topo) e exigem novo aceite ativo no dashboard antes do próximo
          acesso. Continuar usando a plataforma após o aceite implica concordância com a
          nova versão.
        </p>
      </Section>

      <Section title="11. Foro">
        <p>
          Fica eleito o foro da comarca de {BRAND.legalForum} para dirimir quaisquer questões
          decorrentes destes Termos, renunciando as partes a qualquer outro, por mais
          privilegiado que seja.
        </p>
      </Section>

      <Section title="12. Contato">
        <p>
          Dúvidas sobre estes Termos: <a href={`mailto:${BRAND.supportEmail}`}>{BRAND.supportEmail}</a>.
        </p>
      </Section>

      <hr className="my-12" style={{ borderColor: 'var(--ur-border)' }} />

      <Section title="Histórico de alterações">
        <ul className="space-y-3 text-sm">
          {TERMS_CHANGELOG.map((entry) => (
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
