import { faqs, steps, documentUseCases } from '@/lib/site.mjs';

export default function DiscoveryContent() {
  return (
    <section className="discovery" aria-labelledby="about-billbook">
      <div className="discovery-intro">
        <p className="eyebrow">PAPERWORK, ON YOUR TERMS</p>
        <h2 id="about-billbook">A free bill generator for everyday business</h2>
        <p>
          Billbook by <a href="https://lowkey.tools">Lowkey Tools</a> creates
          invoices, receipts and more, right in your browser. No sign-up. Your
          documents stay on your device. Open it once online, wait for the
          offline-ready indicator, and keep working without a connection.
        </p>
        <nav className="discovery-nav" aria-label="Bill generator guide">
          <a href="#document-types">Document types</a>
          <a href="#how-to-create-a-bill">How it works</a>
          <a href="#frequently-asked-questions">Common questions</a>
        </nav>
      </div>
      <section aria-labelledby="document-types">
        <h2 id="document-types">One workspace, six kinds of paperwork</h2>
        <div className="discovery-grid">
          {documentUseCases.map((item) => (
            <article key={item.name}>
              <h3>{item.name}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="how-to-create-a-bill">
        <h2 id="how-to-create-a-bill">How to create an invoice or receipt</h2>
        <ol className="discovery-steps">
          {steps.map((step) => (
            <li key={step.name}>
              <h3>{step.name}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="frequently-asked-questions">
        <h2 id="frequently-asked-questions">Questions, answered.</h2>
        <div className="discovery-faqs">
          {faqs.map((faq, i) => (
            <article key={faq.question} id={`answer-${i + 1}`}>
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="discovery-links">
        <a href="#main-content">Back to the bill generator ↑</a>
        <a href={`/index.md`}>Read the text guide</a>
        <a href={`/llms.txt`}>LLM index</a>
      </div>
    </section>
  );
}
