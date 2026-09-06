import { ArrowLeft, ArrowUpRight } from 'lucide-react';

export default function SiteFooter() {
  return (
    <footer className="creator-footer">
      <a className="back-to-lowkey" href="https://lowkey.tools">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to Lowkey Tools
      </a>
      <p>
        Made by <a href="https://shrinath.me">Shrinath Prabhu</a>
        <span aria-hidden="true"> · </span>
        <span>
          Creator of{' '}
          <a href="https://owleye.dev">
            Owleye Analytics <ArrowUpRight size={12} aria-hidden="true" />
          </a>
        </span>
      </p>
    </footer>
  );
}
