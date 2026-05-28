'use client'

/**
 * Global 404.
 *
 * Next.js App Router renders this for any unmatched route OR any
 * `notFound()` call from a server component. The middleware bounces
 * unauthenticated users to /login first, so in practice this page is
 * what an authenticated merchant sees when they typo a workspace slug
 * or paste a stale link.
 *
 * Editorial / full-bleed: black canvas, ambient looping video as the
 * backdrop, big serif-friendly heading, single accent-gold CTA back
 * home. No PageHeader, no Toolbar — this isn't part of the workspace
 * shell.
 */

import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'

export default function NotFound() {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  // Respect prefers-reduced-motion at runtime. Browsers don't auto-pause
  // background video when the OS setting is "reduce"; we have to do it
  // ourselves. We also kill autoplay if the user toggles the preference
  // mid-session (Safari macOS supports this without a refresh).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      const v = videoRef.current
      if (!v) return
      if (mq.matches) {
        v.pause()
        v.style.display = 'none'
      } else {
        v.style.display = ''
        v.play().catch(() => {
          // Autoplay can be blocked by aggressive browser policies even
          // when muted (older Safari, low-power-mode iOS). The static
          // black backdrop is already visible; silently giving up here
          // beats a console error every page load.
        })
      }
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  return (
    <div
      style={{
        minHeight: '100svh',           // svh handles iOS Safari toolbar
        position: 'relative',
        background: '#000',
        color: '#f0f0f2',
        overflow: 'hidden',
      }}
    >
      {/* Background video.
        * - muted + playsInline = required for autoplay on iOS / mobile Safari.
        * - opacity 0.55 keeps the title legible without crushing the video.
        * - aria-hidden = decorative; screen readers skip it. */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.55,
          // GPU-promote to keep scroll/compositing smooth on weak laptops.
          willChange: 'transform',
          transform: 'translateZ(0)',
          pointerEvents: 'none',
        }}
      >
        <source src="/404-bg.mp4" type="video/mp4" />
      </video>

      {/* Vignette: darkens the top and bottom thirds so the heading reads
        * clearly regardless of which frame the video happens to be on. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.20) 30%, rgba(0,0,0,0.20) 65%, rgba(0,0,0,0.85) 100%)',
        }}
      />

      {/* Subtle accent glow behind the title — anchors the brand colour
        * even though the page lives outside the workspace shell. */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '50%',
          top: '46%',
          transform: 'translate(-50%, -50%)',
          width: 'min(720px, 90vw)',
          height: 'min(720px, 90vw)',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(212, 168, 80, 0.18) 0%, rgba(212, 168, 80, 0) 60%)',
          pointerEvents: 'none',
          filter: 'blur(20px)',
        }}
      />

      {/* Content */}
      <main
        role="main"
        style={{
          position: 'relative',
          zIndex: 10,
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        {/* 404 eyebrow */}
        <span
          className="ur-fadein-1"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#d4a850',
            padding: '6px 14px',
            borderRadius: 999,
            background: 'rgba(212, 168, 80, 0.10)',
            border: '1px solid rgba(212, 168, 80, 0.28)',
            backdropFilter: 'blur(6px)',
            marginBottom: 28,
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#d4a850',
              boxShadow: '0 0 12px #d4a850',
            }}
          />
          Erro 404
        </span>

        {/* Title — editorial, large, tight tracking. clamp() handles the
          * full responsive range (320px → ultra-wide) without breakpoints. */}
        <h1
          className="ur-fadein-2"
          style={{
            fontSize: 'clamp(2.4rem, 6vw, 4.8rem)',
            fontWeight: 600,
            lineHeight: 1.06,
            letterSpacing: '-0.025em',
            color: '#f0f0f2',
            margin: 0,
            maxWidth: '18ch',
            textShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}
        >
          Ops… Não tem nada aqui,
          <br />
          <span style={{ color: '#d4a850' }}>que tal voltar?</span>
        </h1>

        {/* Subtitle */}
        <p
          className="ur-fadein-3"
          style={{
            marginTop: 20,
            fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
            lineHeight: 1.55,
            color: '#a8a8b3',
            maxWidth: '52ch',
          }}
        >
          O endereço pode ter mudado, o link pode estar quebrado, ou
          alguém colou a URL errada no chat. Acontece. Seu dashboard
          continua ali, te esperando.
        </p>

        {/* CTA — primary gold pill */}
        <Link
          href="/"
          aria-label="Voltar para a página inicial"
          className="ur-fadein-4"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 36,
            padding: '14px 26px',
            borderRadius: 999,
            background:
              'linear-gradient(135deg, #d4a850 0%, #c49040 100%)',
            color: '#0a0a0b',
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: '-0.01em',
            textDecoration: 'none',
            boxShadow:
              '0 12px 32px rgba(212, 168, 80, 0.32), 0 2px 6px rgba(0, 0, 0, 0.4)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            minHeight: 44,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)'
            e.currentTarget.style.boxShadow =
              '0 18px 42px rgba(212, 168, 80, 0.42), 0 4px 10px rgba(0, 0, 0, 0.5)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)'
            e.currentTarget.style.boxShadow =
              '0 12px 32px rgba(212, 168, 80, 0.32), 0 2px 6px rgba(0, 0, 0, 0.4)'
          }}
        >
          <ArrowLeft size={18} strokeWidth={2.4} aria-hidden="true" />
          Voltar para o início
        </Link>

        {/* Footnote with the actual path the user typoed, for diagnostic. */}
        <PathHint />
      </main>

      {/* Local CSS only for the small fade-in cascade. Keeping this inline
        * avoids touching globals.css for a one-off page. */}
      <style jsx>{`
        :global(.ur-fadein-1),
        :global(.ur-fadein-2),
        :global(.ur-fadein-3),
        :global(.ur-fadein-4) {
          opacity: 0;
          transform: translateY(8px);
          animation: ur-fadein 0.7s cubic-bezier(0.2, 0, 0.2, 1) forwards;
        }
        :global(.ur-fadein-1) { animation-delay: 0.08s; }
        :global(.ur-fadein-2) { animation-delay: 0.20s; }
        :global(.ur-fadein-3) { animation-delay: 0.36s; }
        :global(.ur-fadein-4) { animation-delay: 0.50s; }

        @keyframes ur-fadein {
          to { opacity: 1; transform: translateY(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          :global(.ur-fadein-1),
          :global(.ur-fadein-2),
          :global(.ur-fadein-3),
          :global(.ur-fadein-4) {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </div>
  )
}

/**
 * Footnote showing the path that 404'd. Useful for the merchant to copy
 * into a support ticket; we'd love to know which links are dead. Runs
 * client-side because Next.js doesn't expose the unmatched URL to
 * not-found.tsx server-side.
 */
function PathHint() {
  if (typeof window === 'undefined') return null
  // Render only the path, never query strings (could contain tokens).
  const path = window.location.pathname
  return (
    <p
      style={{
        marginTop: 28,
        fontSize: 12,
        color: '#606068',
        letterSpacing: '0.02em',
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      }}
    >
      {path}
    </p>
  )
}
