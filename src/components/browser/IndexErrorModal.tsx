import { isProtectedFolderError } from './browserIndexErrors';

export function IndexErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  const protectedFolder = isProtectedFolderError(message);

  return (
    <div className="browser-index-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="browser-index-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="index-error-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="browser-index-modal-head">
          <h3 id="index-error-title">Index error details</h3>
          <button className="browser-index-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="browser-index-error browser-index-error-block">{message}</p>
        {protectedFolder ? (
          <>
            <p>
              The browser refused the selected folder before the app could read it. Pick a pnpm
              store outside protected system locations.
            </p>
            <pre>
              <code>{`mkdir -p ~/pnpm-store-browser
rsync -a --delete "$(pnpm store path)/" ~/pnpm-store-browser/v10/`}</code>
            </pre>
          </>
        ) : (
          <>
            <p>
              The selected directory should contain pnpm store folders named index and files. If it
              does not, run pnpm store path and choose that folder.
            </p>
            <pre>
              <code>{`pnpm store path
ls "$(pnpm store path)"`}</code>
            </pre>
          </>
        )}
      </section>
    </div>
  );
}
