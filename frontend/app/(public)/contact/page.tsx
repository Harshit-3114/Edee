'use client';

import { useState } from 'react';
import { MapPin, Phone, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import SiteHeader from '../_components/SiteHeader';
import SiteFooter from '../_components/SiteFooter';
import Reveal from '@/components/ui/Reveal';
import { Input, Textarea } from '@/components/ui/Input';

const CONTACT_INFO = [
  { label: 'Email', value: 'hello@edeeapply.com', href: 'mailto:hello@edeeapply.com' },
  { icon: Phone, label: 'Phone', value: '+91 80 1234 5678', href: 'tel:+918012345678' },
  { icon: MapPin, label: 'Office', value: '12th Floor, Tech Park, Bengaluru 560001, India', href: 'https://maps.google.com/?q=Tech+Park+Bengaluru' },
];

export default function ContactPage() {
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [values, setValues] = useState({ name: '', email: '', message: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    // Simulate API call
    await new Promise((r) => setTimeout(r, 1200));
    setFormState('success');
    setValues({ name: '', email: '', message: '' });
    setTimeout(() => setFormState('idle'), 3000);
  };

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[var(--surface-sunken)]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--accent)_0%,_transparent_70%)] opacity-10" aria-hidden="true" />
          <div className="relative mx-auto max-w-5xl px-6 py-24 lg:py-32 text-center hero-content">
            <Reveal>
              <p className="text-[13px] font-medium tracking-wide text-[var(--accent-text)] uppercase">Get in touch</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl lg:text-6xl">
                We’d love to hear from you
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-[55ch] mx-auto text-base leading-relaxed text-[var(--text-secondary)]">
                Whether you’re a student with a question, a college wanting to join, or a partner exploring collaboration – drop us a line and we’ll get back within 24 hours.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Contact info + form */}
        <section className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            {/* Info cards */}
            <div className="space-y-6">
              <Reveal>
                <h2 className="text-xl font-semibold tracking-tight">Contact details</h2>
              </Reveal>
              <ul className="mt-6 space-y-4" role="list">
                {CONTACT_INFO.map((c, i) => (
                  <Reveal key={c.label} delay={i * 80}>
                    <li className="card animate-fade-up flex items-start gap-4 p-5 rounded-xl border border-[var(--line)] bg-[var(--surface-raised)]">
                      <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-subtle)] text-[var(--accent-text)]">
                        {c.icon ? <c.icon size={20} aria-hidden="true" /> : <span>✉</span>}
                      </div>
                      <div>
                        <dt className="text-xs font-medium text-[var(--text-muted)] uppercase">{c.label}</dt>
                        <dd className="mt-0.5">
                          <a href={c.href} className="text-sm text-[var(--text-primary)] underline underline-offset-2 hover:text-[var(--accent-text)]">
                            {c.value}
                          </a>
                        </dd>
                      </div>
                    </li>
                  </Reveal>
                ))}
              </ul>

              {/* Quick links */}
              <Reveal delay={240}>
                <h3 className="text-lg font-semibold">Quick links</h3>
              </Reveal>
              <Reveal delay={260}>
                <ul className="mt-4 flex flex-wrap gap-3" role="list">
                  {['FAQ', 'Privacy policy', 'Terms of service', 'Press kit'].map((link) => (
                    <li key={link}>
                      <a href={`/#${link.toLowerCase().replace(/\s+/g, '-')}`} className="rounded-lg bg-[var(--surface-sunken)] px-4 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>

            {/* Form */}
            <div>
              <Reveal delay={120}>
                <h2 className="text-xl font-semibold tracking-tight">Send us a message</h2>
              </Reveal>

              {formState === 'success' && (
                <Reveal>
                  <div className="mt-6 rounded-xl bg-[var(--success)]/10 border border-[var(--success)] p-5 text-center animate-scale-in">
                    <ArrowRight size={24} className="mx-auto text-[var(--success)]" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-[var(--success)]">Thanks! Your message has been sent.</p>
                  </div>
                </Reveal>
              )}

              <form onSubmit={handleSubmit} className="mt-6 space-y-5" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Reveal delay={180}>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">Full name</span>
                      <Input
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        placeholder="Aarav Mehta"
                        required
                        disabled={formState === 'submitting'}
                      />
                    </label>
                  </Reveal>
                  <Reveal delay={200}>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-sm font-medium">Email address</span>
                      <Input
                        name="email"
                        type="email"
                        value={values.email}
                        onChange={handleChange}
                        placeholder="aarav@example.com"
                        required
                        disabled={formState === 'submitting'}
                      />
                    </label>
                  </Reveal>
                </div>

                <Reveal delay={220}>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium">Message</span>
                    <Textarea
                      name="message"
                      value={values.message}
                      onChange={handleChange}
                      placeholder="How can we help?"
                      rows={5}
                      required
                      disabled={formState === 'submitting'}
                    />
                  </label>
                </Reveal>

                <Reveal delay={240}>
                  <button
                    type="submit"
                    disabled={formState === 'submitting'}
                    className="btn w-full sm:w-auto rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-medium text-[var(--text-inverse)] hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {formState === 'submitting' ? (
                      <>
                        <span className="animate-spin" aria-hidden="true">⟳</span>
                        Sending…
                      </>
                    ) : (
                      <>
                        Send message
                        <ArrowRight size={16} weight="bold" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </Reveal>
              </form>
            </div>
          </div>
        </section>

        {/* Map placeholder */}
        <section className="border-t border-[var(--line)] bg-[var(--surface-sunken)]">
          <div className="mx-auto max-w-6xl px-6 py-16 lg:py-24">
            <Reveal>
              <h2 className="text-xl font-semibold tracking-tight text-center">Visit us</h2>
            </Reveal>
            <div className="mt-8 relative aspect-[16/9] rounded-2xl overflow-hidden bg-[var(--surface-raised)]">
              {/* static map image placeholder */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[var(--accent)]/5 to-[var(--accent)]/10">
                <MapPin size={48} className="text-[var(--accent-text)] opacity-30" aria-hidden="true" />
              </div>
              <div className="absolute bottom-4 right-4 rounded-lg bg-[var(--surface)]/90 backdrop-blur px-4 py-2 text-sm text-[var(--text-secondary)]">
                12th Floor, Tech Park, Bengaluru
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}