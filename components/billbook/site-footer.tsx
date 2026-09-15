import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { relatedTools, REPOSITORY_URL } from '@/lib/site.mjs';

export default function SiteFooter({
  showRelated = false,
}: {
  showRelated?: boolean;
}) {
  return (
    <footer className="creator-footer">
      {showRelated && (
        <section className="lowkey-next" aria-labelledby="lowkey-next-title">
          <div className="lowkey-next-heading">
            <div>
              <p className="eyebrow">A LITTLE MORE LOWKEY</p>
              <h2 id="lowkey-next-title">Paperwork’s done. What’s next?</h2>
            </div>
            <a className="more-lowkey" href="https://lowkey.tools">
              Find your next little helper{' '}
              <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
          <nav
            className="lowkey-next-grid"
            aria-label="More tools from Lowkey Tools"
          >
            {relatedTools.map((tool) => (
              <a className="lowkey-tool" href={tool.url} key={tool.name}>
                <span className="lowkey-tool-name">{tool.name}</span>
                <h3>{tool.title}</h3>
                <p>{tool.text}</p>
                <span className="lowkey-tool-action">
                  {tool.action} <ArrowRight size={14} aria-hidden="true" />
                </span>
              </a>
            ))}
          </nav>
        </section>
      )}
      <div className="creator-colophon">
        <p className="lowkey-family">
          From the{' '}
          <a href="https://lowkey.tools">
            lowkey.tools <ArrowUpRight size={12} aria-hidden="true" />
          </a>{' '}
          workbench.
        </p>
        <div className="maker-credit">
          <p>
            Crafted by <a href="https://shrinath.me">Shrinath Prabhu</a>,
            <br className="maker-break" /> the maker behind{' '}
            <a href="https://owleye.dev">Owleye Analytics</a>.
          </p>
          <a className="maker-follow" href="https://x.com/shrinath_prabhu">
            Follow @shrinath_prabhu on X{' '}
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
          <a
            className="source-link"
            href={REPOSITORY_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            Source on GitHub
            <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  );
}
