'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MapPin, Phone, ArrowRight, EnvelopeSimple } from '@phosphor-icons/react/dist/ssr';
import SiteHeader from '../_components/SiteHeader';
import SiteFooter from '../_components/SiteFooter';
import Reveal from '@/components/ui/Reveal';
import { Input, Select, Textarea } from '@/components/ui/Input';
import api, { apiErrorMessage } from '@/lib/api';

const CONTACT_INFO = [
  { label: 'Email', value: 'hello@edeeapply.com', href: 'mailto:hello@edeeapply.com' },
  { icon: Phone, label: 'Phone', value: '+91 80 1234 5678', href: 'tel:+918012345678' },
  { icon: MapPin, label: 'Office', value: '12th Floor, Tech Park, Bengaluru 560001, India', href: 'https://maps.google.com/?q=Tech+Park+Bengaluru' },
];

export default function ContactPage() {
  const [formState, setFormState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [values, setValues] = useState({ name: '', email: '', purpose: '', message: '' });

  const [formError, setFormError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setFormError('');
    try {
      await api.post('/contact/', {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        purpose: values.purpose,
        message: values.message.trim(),
      });
      setFormState('success');
      setValues({ name: '', email: '', purpose: '', message: '' });
      setTimeout(() => setFormState('idle'), 5000);
    } catch (err) {
      setFormState('error');
      setFormError(apiErrorMessage(err, 'Could not send your message. Try again.'));
    }
  };

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <Image
            src="/campuses/loyola.jpg"
            alt=""
            aria-hidden="true"
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/55 to-black/70"
          />
          <div className="relative mx-auto max-w-5xl px-6 py-24 lg:py-32 text-center">
            <Reveal>
              <p className="text-[13px] font-medium tracking-wide text-white/70 uppercase">Get in touch</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-white md:text-5xl lg:text-6xl">
                We’d love to hear from you
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="mt-5 max-w-[55ch] mx-auto text-base leading-relaxed text-white/85">
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
                      <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--accent-subtle)] text-[var(--accent-text)]">
                        {c.icon ? <c.icon size={20} aria-hidden="true" /> : <EnvelopeSimple size={20} aria-hidden="true" />}
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
            </div>

            {/* Form */}
            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-raised)] p-6 shadow-[var(--shadow-sm)] md:p-8">
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

              {formState === 'error' && formError && (
                <div
                  role="alert"
                  className="mt-6 rounded-xl border border-[var(--danger-line)] bg-[var(--danger-subtle)] px-4 py-3.5 text-sm text-[var(--text-primary)]"
                >
                  {formError}
                </div>
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
                    <span className="text-sm font-medium">Purpose of contacting</span>
                    <Select
                      name="purpose"
                      value={values.purpose}
                      onChange={handleChange}
                      required
                      disabled={formState === 'submitting'}
                    >
                      <option value="">Select a reason</option>
                      <option value="admissions">Admissions question (student)</option>
                      <option value="join-college">Join as a college</option>
                      <option value="coaching">Coaching partnership</option>
                      <option value="payments">Payments & billing help</option>
                      <option value="problem">Report a problem</option>
                      <option value="press">Press & media</option>
                      <option value="other">Something else</option>
                    </Select>
                  </label>
                </Reveal>

                <Reveal delay={230}>
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

      </main>

      <SiteFooter />
    </div>
  );
}