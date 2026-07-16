import { Link } from 'react-router-dom';
import { Icon } from './ui';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg animate-scale-in text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300">
          <Icon name="compass" className="h-8 w-8" />
        </div>
        <p className="font-mono text-sm font-semibold uppercase tracking-widest text-brand-400">Error 404</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-fg sm:text-4xl">Page not found</h1>
        <p className="mx-auto mt-3 max-w-md text-muted">
          The page you’re looking for doesn’t exist or may have moved. Head back to the workspace to pick a dataset.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link to="/" className="btn-primary">
            <Icon name="arrowLeft" className="h-4 w-4" /> Back to workspace
          </Link>
          <a href="/docs" target="_blank" rel="noreferrer" className="btn-ghost">
            API docs <Icon name="external" className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
