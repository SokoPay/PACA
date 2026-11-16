import Image from "next/image";
import banner from "@/images/banner-hero.jpg";

/** The gradient banner at the top of every public page, so the whole site feels like one product. */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="paca-gradient grain relative overflow-hidden text-white">
      <Image src={banner} alt="" fill sizes="100vw" className="hero-echo -z-10 object-cover object-[70%_center]" />
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        {eyebrow && (
          <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-white/90 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#f2b134]" /> {eyebrow}
          </p>
        )}
        <h1 className="mt-5 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{title}</h1>
        {lead && <p className="mt-4 max-w-2xl text-lg leading-relaxed text-white/85">{lead}</p>}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
