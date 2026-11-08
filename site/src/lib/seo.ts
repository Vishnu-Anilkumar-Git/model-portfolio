import { useEffect } from "react";

interface SeoInput {
  title: string;
  description: string;
  canonical?: string;
  image?: string;
  jsonLd?: Record<string, unknown>[];
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(
    `meta[${attribute}="${key}"]`,
  );
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

export function useSeo({ title, description, canonical, image, jsonLd }: SeoInput) {
  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", description);
    if (image) {
      upsertMeta("property", "og:image", image);
      upsertMeta("name", "twitter:image", image);
    }

    let canonicalLink = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    if (canonical) canonicalLink.href = canonical;

    // The build writes the JSON-LD into every pre-rendered page. Reuse that data
    // block on client navigation instead of adding fresh inline scripts, which a
    // strict script-src would refuse.
    const content =
      jsonLd && jsonLd.length > 0
        ? JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd)
        : "";
    let script = document.querySelector<HTMLScriptElement>("script#seo-jsonld");

    if (!content) {
      script?.remove();
      return;
    }

    if (!script) {
      script = document.createElement("script");
      script.id = "seo-jsonld";
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = content;
  }, [title, description, canonical, image, jsonLd]);
}
