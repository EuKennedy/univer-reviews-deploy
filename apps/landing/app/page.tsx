import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'UniverReviews — Reviews com IA para e-commerce que converte',
  description:
    'Plataforma de reviews com inteligência artificial para lojas WooCommerce. Modere, exiba e converta com avaliações autênticas.',
  openGraph: {
    title: 'UniverReviews',
    description: 'Reviews com IA. Para e-commerce que converte.',
    url: 'https://univerreviews.com',
    siteName: 'UniverReviews',
    locale: 'pt_BR',
    type: 'website',
  },
}

// ─── Data ────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: '◆',
    title: 'IA Nativa',
    desc: 'Moderação automática com score de qualidade 0–100. Detecção de reviews sintéticas, spam e conteúdo inadequado. Auto-approve e auto-reject configuráveis.',
  },
  {
    icon: '◇',
    title: 'Widget < 20KB',
    desc: 'Web Component vanilla, zero dependências, Shadow DOM. 5 layouts — default, compact, grid, carousel, side-summary. Container queries de 360px a 1920px.',
  },
  {
    icon: '◈',
    title: 'Multi-tenant',
    desc: 'Workspace isolado por loja. Times com roles granulares. API Keys com escopos. Audit log completo de todas as ações. White-label no plano Enterprise.',
  },
  {
    icon: '◉',
    title: 'WooCommerce-first',
    desc: 'Sincronização bidirecional automática. Plugin WordPress com Gutenberg block e shortcode. Verificação de compra nativa. Importação em 1 clique.',
  },
  {
    icon: '◎',
    title: 'Recompensas',
    desc: 'Ofereça cupons, frete grátis ou pontos automaticamente a quem deixar uma avaliação. Regras por nota mínima, mídia obrigatória e compra verificada.',
  },
  {
    icon: '◐',
    title: 'UGC de Vídeo',
    desc: 'Clientes enviam fotos e vídeos junto com a avaliação. Lightbox nativo no widget. Thumbnails gerados automaticamente. Armazenamento incluído no plano.',
  },
]

const pricing = [
  {
    name: 'Starter',
    price: 'R$ 49',
    period: '/mês',
    desc: 'Para lojas que estão começando a coletar reviews.',
    highlight: false,
    features: [
      '500 reviews/mês',
      '50 produtos',
      '2 membros da equipe',
      '3 campanhas/mês',
      '200 jobs de IA/mês',
      'Widget com 5 layouts',
      'Moderação automática com IA',
      'Shortcode WordPress',
      'Suporte por e-mail',
    ],
    cta: 'Começar grátis',
    note: '14 dias de trial, sem cartão',
  },
  {
    name: 'Pro',
    price: 'R$ 149',
    period: '/mês',
    desc: 'Para lojas em crescimento que querem converter mais.',
    highlight: true,
    features: [
      '5.000 reviews/mês',
      '500 produtos',
      '10 membros da equipe',
      '20 campanhas/mês',
      '2.000 jobs de IA/mês',
      'Domínio customizado',
      'Acesso à API REST',
      'Programa de recompensas',
      'UGC de vídeo',
      'Respostas sugeridas por IA',
      'Suporte prioritário',
    ],
    cta: 'Começar com Pro',
    note: '14 dias de trial incluídos',
  },
  {
    name: 'Enterprise',
    price: 'R$ 499',
    period: '/mês',
    desc: 'Para operações com volume alto e necessidades avançadas.',
    highlight: false,
    features: [
      'Reviews ilimitados',
      'Produtos ilimitados',
      'Time ilimitado',
      'Campanhas ilimitadas',
      'IA ilimitada',
      'White-label completo',
      'SLA de uptime',
      'Suporte dedicado',
      'Onboarding personalizado',
      'Integração customizada',
    ],
    cta: 'Falar com vendas',
    note: 'Faturamento anual disponível',
  },
]

const stats = [
  { value: '16k+', label: 'Reviews processadas' },
  { value: '95%', label: 'Moderação automática' },
  { value: '< R$ 75', label: 'Custo mensal médio' },
  { value: '4.9★', label: 'Satisfação de lojistas' },
]

// ─── Components ──────────────────────────────────────────────────────────────

function StarRating({ count = 5 }: { count?: number }) {
  return (
    <span className="text-gold" aria-label={`${count} estrelas`}>
      {'★'.repeat(count)}
    </span>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-3 py-1 text-xs font-semibold tracking-widest uppercase rounded-full bg-gold/10 text-gold border border-gold/20 mb-6">
      {children}
    </span>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <main className="bg-[#0d0d0d] text-white min-h-screen font-sans antialiased">

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#0d0d0d]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="text-xl font-black tracking-tight">
            Univer<span className="text-gold">Reviews</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition-colors">Recursos</a>
            <a href="#pricing" className="hover:text-white transition-colors">Preços</a>
            <a href="#stats" className="hover:text-white transition-colors">Resultados</a>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://app.univerreviews.com/login"
              className="text-sm text-white/60 hover:text-white transition-colors hidden sm:block"
            >
              Entrar
            </a>
            <a
              href="https://app.univerreviews.com/signup"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-gold text-black hover:bg-gold-hover transition-colors"
            >
              Começar grátis
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-36 pb-24 px-6 overflow-hidden">
        {/* Gradient blobs */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-gold/8 blur-[120px]" />
          <div className="absolute top-32 left-1/4 w-[400px] h-[300px] rounded-full bg-amber-700/10 blur-[100px]" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center">
          <Badge>Novo · Moderação com IA</Badge>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] mb-6">
            Reviews com IA.{' '}
            <span className="text-gold">Para e-commerce</span>{' '}
            que converte.
          </h1>

          <p className="text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-10">
            Plataforma SaaS de avaliações para WooCommerce com moderação automática,
            widget ultra-leve e programa de recompensas integrado. Tudo com IA.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <a
              href="https://app.univerreviews.com/signup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-base bg-gold text-black hover:bg-gold-hover transition-all hover:-translate-y-0.5 shadow-[0_0_40px_rgba(212,168,80,.25)]"
            >
              Começar 14 dias grátis
              <span aria-hidden="true">→</span>
            </a>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-base border border-white/10 text-white/70 hover:border-white/20 hover:text-white transition-all"
            >
              Ver como funciona
            </a>
          </div>

          <p className="mt-5 text-sm text-white/30">Sem cartão de crédito. Sem compromisso.</p>

          {/* Social proof strip */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-white/30">
            <span>Mais de <strong className="text-white/60">200 lojas</strong> ativas</span>
            <span className="w-px h-4 bg-white/10 hidden sm:block" aria-hidden="true" />
            <span><StarRating /> avaliação média de lojistas</span>
            <span className="w-px h-4 bg-white/10 hidden sm:block" aria-hidden="true" />
            <span>WooCommerce · WordPress · API REST</span>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge>Recursos</Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              Tudo que você precisa,<br />
              <span className="text-gold">nada que você não precisa.</span>
            </h2>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              Construído para performance, moderação em escala e conversão real.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group relative rounded-2xl border border-white/5 bg-white/2 p-7 hover:border-gold/20 hover:bg-white/3 transition-all duration-300"
              >
                <div className="text-3xl text-gold mb-4 transition-transform group-hover:scale-110 origin-left duration-200">
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 text-white">{f.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof ─────────────────────────────────────────────────── */}
      <section className="py-16 px-6 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <p className="text-center text-xs tracking-widest uppercase text-white/20 mb-10">
            Integra com as ferramentas que você já usa
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-30">
            {['WooCommerce', 'WordPress', 'Shopify', 'MercadoLivre', 'VTEX', 'Stripe'].map(b => (
              <span key={b} className="text-sm font-semibold tracking-wide">{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section id="stats" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge>Resultados</Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight">
              Números que<br />
              <span className="text-gold">falam por si.</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
            {stats.map((s, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/5 bg-white/2 p-8 text-center"
              >
                <div className="text-4xl sm:text-5xl font-black text-gold mb-2 tracking-tight">
                  {s.value}
                </div>
                <div className="text-sm text-white/40">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Testimonial */}
          <blockquote className="mt-12 max-w-2xl mx-auto text-center">
            <p className="text-xl sm:text-2xl font-semibold text-white/70 leading-relaxed mb-6">
              "Depois do UniverReviews, nossa taxa de conversão subiu 22% em 30 dias.
              A moderação com IA sozinha já pagou o plano."
            </p>
            <footer className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center text-gold font-bold text-sm">
                AM
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-white">Ana Medeiros</div>
                <div className="text-xs text-white/30">Diretora de E-commerce · LojaModelo.com.br</div>
              </div>
            </footer>
          </blockquote>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge>Planos</Badge>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
              Simples, transparente,{' '}
              <span className="text-gold">sem surpresas.</span>
            </h2>
            <p className="text-white/40 text-lg">
              14 dias de trial em qualquer plano. Sem cartão de crédito.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
            {pricing.map((plan, i) => (
              <div
                key={i}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  plan.highlight
                    ? 'border-gold/40 bg-gold/5 shadow-[0_0_80px_rgba(212,168,80,.12)]'
                    : 'border-white/5 bg-white/2'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 text-xs font-bold rounded-full bg-gold text-black tracking-wide uppercase">
                      Mais popular
                    </span>
                  </div>
                )}

                <div>
                  <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                  <p className="text-sm text-white/40 mb-6">{plan.desc}</p>
                  <div className="flex items-end gap-1 mb-8">
                    <span className="text-4xl font-black text-white tracking-tight">{plan.price}</span>
                    <span className="text-white/30 text-sm mb-1">{plan.period}</span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feat, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-white/60">
                      <span className="text-gold mt-0.5 flex-shrink-0">✓</span>
                      {feat}
                    </li>
                  ))}
                </ul>

                <div>
                  <a
                    href={plan.name === 'Enterprise' ? 'mailto:sales@univerreviews.com' : 'https://app.univerreviews.com/signup'}
                    className={`block w-full text-center py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 ${
                      plan.highlight
                        ? 'bg-gold text-black hover:bg-gold-hover'
                        : 'border border-white/10 text-white hover:border-white/20 hover:bg-white/5'
                    }`}
                  >
                    {plan.cta}
                  </a>
                  <p className="text-center text-xs text-white/20 mt-3">{plan.note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ pricing note */}
          <p className="text-center text-sm text-white/30 mt-10">
            Todos os preços em BRL. Faturamento anual disponível com 20% de desconto.{' '}
            <a href="mailto:sales@univerreviews.com" className="text-gold hover:underline">
              Fale com vendas
            </a>{' '}
            para planos customizados.
          </p>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="rounded-3xl border border-gold/15 bg-gold/5 p-12 relative overflow-hidden"
            aria-label="Call to action"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,168,80,0.08),transparent_70%)]" aria-hidden="true" />
            <div className="relative">
              <h2 className="text-4xl sm:text-5xl font-black tracking-tight mb-4">
                Pronto para converter
                <br />
                <span className="text-gold">com reviews reais?</span>
              </h2>
              <p className="text-white/40 text-lg mb-10 max-w-lg mx-auto">
                Comece em 5 minutos. Conecte sua loja WooCommerce, instale o widget e veja a diferença.
              </p>
              <a
                href="https://app.univerreviews.com/signup"
                className="inline-flex items-center gap-2 px-10 py-4 rounded-xl font-bold text-base bg-gold text-black hover:bg-gold-hover transition-all hover:-translate-y-0.5 shadow-[0_0_60px_rgba(212,168,80,.3)]"
              >
                Criar conta grátis
                <span aria-hidden="true">→</span>
              </a>
              <p className="mt-4 text-sm text-white/20">14 dias grátis · Sem cartão · Cancele quando quiser</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="text-lg font-black mb-3">
                Univer<span className="text-gold">Reviews</span>
              </div>
              <p className="text-sm text-white/30 leading-relaxed">
                Reviews com IA para e-commerce que converte.
              </p>
              <div className="flex gap-3 mt-4">
                <a href="https://twitter.com/univerreviews" className="text-white/20 hover:text-white/50 transition-colors text-sm" aria-label="Twitter">
                  𝕏
                </a>
                <a href="https://linkedin.com/company/univerreviews" className="text-white/20 hover:text-white/50 transition-colors text-sm" aria-label="LinkedIn">
                  in
                </a>
                <a href="https://instagram.com/univerreviews" className="text-white/20 hover:text-white/50 transition-colors text-sm" aria-label="Instagram">
                  IG
                </a>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">Produto</h4>
              <ul className="space-y-2.5 text-sm text-white/40">
                {['Recursos', 'Preços', 'Widget Demo', 'API Docs', 'Changelog'].map(l => (
                  <li key={l}>
                    <a href="#" className="hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">Empresa</h4>
              <ul className="space-y-2.5 text-sm text-white/40">
                {['Sobre', 'Blog', 'Carreiras', 'Imprensa', 'Contato'].map(l => (
                  <li key={l}>
                    <a href="#" className="hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">Legal</h4>
              <ul className="space-y-2.5 text-sm text-white/40">
                {['Termos de Uso', 'Privacidade', 'Cookies', 'LGPD', 'SLA'].map(l => (
                  <li key={l}>
                    <a href="#" className="hover:text-white transition-colors">{l}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/20">
            <p>© {new Date().getFullYear()} UniverReviews. Todos os direitos reservados.</p>
            <p>Feito no Brasil 🇧🇷 com IA</p>
          </div>
        </div>
      </footer>
    </main>
  )
}
