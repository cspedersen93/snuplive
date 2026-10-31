import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import GuideCards, { AUDIENCE, readMinutes } from "@/components/GuideCards";
import { SITE_URL } from "@/lib/env";
import { GUIDES, guideBySlug, guideDate, guideHref, type Guide } from "@/lib/guides";

type Params = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return { title: "Guiden findes ikke", robots: { index: false } };
  return {
    title: { absolute: g.title },
    description: g.description,
    alternates: { canonical: guideHref(g) },
    openGraph: {
      type: "article",
      title: g.h1,
      description: g.description,
      url: guideHref(g),
      images: [{ url: g.image.src, alt: g.image.alt }],
      publishedTime: g.published,
      modifiedTime: g.updated,
    },
  };
}

export default async function GuidePage({ params }: Params) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const url = `${SITE_URL}${guideHref(g)}`;
  const related = g.related.map(guideBySlug).filter((x): x is Guide => Boolean(x));

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: g.h1,
        description: g.description,
        image: `${SITE_URL}${g.image.src}`,
        datePublished: g.published,
        dateModified: g.updated,
        inLanguage: "da-DK",
        mainEntityOfPage: url,
        author: { "@type": "Organization", name: "Relived", url: `${SITE_URL}/` },
        publisher: { "@type": "Organization", name: "Relived", logo: { "@type": "ImageObject", url: `${SITE_URL}/img/logo.png` } },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Forside", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE_URL}/guides` },
          { "@type": "ListItem", position: 3, name: g.short, item: url },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: g.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
      },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <article className="guide" aria-labelledby="h-guide">
        <header className="guide-head">
          <div className="wrap guide-wrap">
            <nav className="crumbs" aria-label="Brødkrummer">
              <Link href="/">Forside</Link>
              <span aria-hidden="true">/</span>
              <Link href="/guides">Guides</Link>
              <span aria-hidden="true">/</span>
              <span>{g.short}</span>
            </nav>
            <span className="label red">{AUDIENCE[g.audience]}</span>
            <h1 className="h2" id="h-guide">{g.h1}</h1>
            <p className="lede">{g.lede}</p>
            <p className="guide-meta">
              <span>{readMinutes(g)} min. læsning</span>
              <span aria-hidden="true">·</span>
              <span>
                Opdateret <time dateTime={g.updated}>{guideDate(g.updated)}</time>
              </span>
            </p>
          </div>
          <div className="wrap guide-wrap">
            <img
              className="guide-hero"
              src={g.image.src}
              alt={g.image.alt}
              width={g.image.width}
              height={g.image.height}
              style={{ objectPosition: g.image.position }}
              fetchPriority="high"
            />
          </div>
        </header>

        <div className="wrap guide-wrap">
          <nav className="guide-toc" aria-labelledby="h-indhold">
            <h2 className="label" id="h-indhold">Indhold</h2>
            <ol>
              {g.sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.h2}</a>
                </li>
              ))}
              <li>
                <a href="#spoergsmaal">Spørgsmål og svar</a>
              </li>
            </ol>
          </nav>

          <div className="prose guide-body">
            {g.sections.map((s) => (
              <section key={s.id} id={s.id} aria-labelledby={`h-${s.id}`}>
                <h2 id={`h-${s.id}`}>{s.h2}</h2>
                {s.body}
                {s.cta ? (
                  <aside className="guide-cta">
                    <p>{s.cta.text}</p>
                    <Link className="btn btn-red btn-sm" href={s.cta.href}>
                      {s.cta.label}
                    </Link>
                  </aside>
                ) : null}
              </section>
            ))}

            <section id="spoergsmaal" aria-labelledby="h-spoergsmaal" className="guide-faq">
              <h2 id="h-spoergsmaal">Spørgsmål og svar</h2>
              <div className="faq-list">
                {g.faq.map(([q, a]) => (
                  <details key={q}>
                    <summary>
                      <h3>{q}</h3>
                      <span className="pm" aria-hidden="true">+</span>
                    </summary>
                    <p>{a}</p>
                  </details>
                ))}
              </div>
            </section>
          </div>
        </div>
      </article>

      {related.length ? (
        <section className="sec tight" aria-labelledby="h-flere">
          <div className="wrap">
            <div className="row-head">
              <h2 className="h3" id="h-flere">Læs også</h2>
              <Link className="linkbtn" href="/guides">Alle guides</Link>
            </div>
            <GuideCards guides={related} />
          </div>
        </section>
      ) : null}

      <section className="sec tight" style={{ paddingTop: 0 }} aria-labelledby="h-guide-slut">
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2 className="h2" id="h-guide-slut">{g.end.h2}</h2>
              <p className="lede" style={{ marginTop: 12 }}>{g.end.text}</p>
            </div>
            <div className="ctas">
              <Link className="btn btn-red" href={g.end.href}>{g.end.label}</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
