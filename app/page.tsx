import Workspace from '@/components/billbook/workspace';
import DiscoveryContent from '@/components/billbook/discovery';
import { structuredData } from '@/lib/site.mjs';

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c'),
        }}
      />
      <noscript>
        <div className="noscript-notice">
          The guide below works without JavaScript. Enable JavaScript to create,
          save and export documents in your browser.
        </div>
      </noscript>
      <Workspace discovery={<DiscoveryContent />} />
    </>
  );
}
