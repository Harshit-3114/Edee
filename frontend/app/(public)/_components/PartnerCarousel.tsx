import Image from 'next/image';
import { PARTNERS } from './partners';

/**
 * Authorised university partners, immediately below the hero.
 *
 * A pure-CSS marquee: the list is rendered twice and translated half its
 * width on a loop, so there is no JavaScript to load, hydrate, or break.
 * Grayscale-until-hover keeps a dozen different brand marks visually quiet.
 * Renders nothing while PARTNERS is empty - the section appears the moment
 * the internal team adds the first logo file.
 */
export default function PartnerCarousel() {
  if (PARTNERS.length === 0) return null;

  const loop = [...PARTNERS, ...PARTNERS];
  return (
    <section
      aria-label="Authorised university partners"
      className="border-b border-[var(--line)] bg-[var(--surface-raised)] py-8"
    >
      <p className="text-center text-[13px] font-medium tracking-wide text-[var(--text-secondary)] uppercase">
        Authorised university partners
      </p>
      <div className="mt-5 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
        <ul className="animate-marquee flex w-max items-center gap-14 pr-14 hover:[animation-play-state:paused]">
          {loop.map((partner, index) => (
            <li
              key={`${partner.name}-${index}`}
              aria-hidden={index >= PARTNERS.length}
              className="flex h-12 shrink-0 items-center"
              title={partner.name}
            >
              <Image
                src={partner.logo}
                alt={index < PARTNERS.length ? partner.name : ''}
                width={160}
                height={48}
                className="h-12 w-auto object-contain grayscale opacity-70 transition hover:grayscale-0 hover:opacity-100"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
