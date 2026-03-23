import { Link, useRouter } from '@tanstack/react-router';

export function NotFound() {
  const router = useRouter();
  const path = router.state.location.pathname;

  return (
    <main className="not-found">
      <div className="not-found-inner">
        <span className="not-found-code">404</span>
        <h1 className="not-found-title">Not found</h1>
        <p className="not-found-path">
          <code>{path}</code>
        </p>
        <div className="not-found-actions">
          <Link to="/" className="not-found-link">
            Browse packages
          </Link>
        </div>
      </div>
    </main>
  );
}
