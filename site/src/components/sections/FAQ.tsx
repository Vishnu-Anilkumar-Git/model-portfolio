import { Plus } from "lucide-react";
import type { FAQ as FAQItem } from "@/types";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";

export function FAQ({ faqs }: { faqs: FAQItem[] }) {
  return (
    <Section
      id="faq"
      index="07"
      label="FAQ"
      title="Frequently asked questions."
      intro="The short answers. The assistant in the corner can go deeper."
    >
      <div className="space-y-2.5">
        {faqs.map((faq, index) => (
          <Reveal key={faq.id} delay={Math.min(index * 0.04, 0.2)}>
            <details className="panel group p-0">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-left [&::-webkit-details-marker]:hidden">
                <span className="text-[14.5px] font-medium text-paper">{faq.question}</span>
                <span className="shrink-0 rounded-full border border-line p-1 text-fog transition-transform duration-200 group-open:rotate-45 group-open:border-flame/40 group-open:text-flame">
                  <Plus size={14} aria-hidden="true" />
                </span>
              </summary>
              <p className="px-5 pb-5 text-[13.5px] leading-7 text-fog">{faq.answer}</p>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
