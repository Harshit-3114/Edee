import Image from 'next/image';

/**
 * Editorial photo card for flat sections: full-bleed campus photo, dark
 * overlay for legibility, white text. Used where the section itself stays
 * flat and the cards carry the imagery.
 */
export default function PhotoCard({
  image,
  title,
  body,
  icon,
}: {
  image: string;
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <article className="card relative overflow-hidden rounded-xl border border-white/10 p-6 text-white">
      <Image
        src={image}
        alt=""
        aria-hidden="true"
        fill
        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        className="object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/55 to-black/70"
      />
      <div className="relative">
        {icon && <div className="mb-4 inline-flex text-white">{icon}</div>}
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/85">{body}</p>
      </div>
    </article>
  );
}
