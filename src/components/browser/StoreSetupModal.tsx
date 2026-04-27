export function StoreSetupModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="browser-index-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="browser-index-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-setup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="browser-index-modal-head">
          <h3 id="store-setup-title">Browser-safe pnpm store</h3>
          <button className="browser-index-close" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p>
          Chrome blocks directory access to some protected locations, including many folders under
          macOS Library. A browser-safe pnpm store keeps the same pnpm layout in a normal user
          folder.
        </p>
        <div className="browser-index-guide">
          <div>
            <h4>Use a copied store</h4>
            <pre>
              <code>{`mkdir -p ~/pnpm-store-browser
rsync -a --delete "$(pnpm store path)/" ~/pnpm-store-browser/v10/`}</code>
            </pre>
            <p>Choose ~/pnpm-store-browser/v10 in the browser picker.</p>
          </div>
          <div>
            <h4>Move pnpm to the new store</h4>
            <pre>
              <code>{`pnpm config set store-dir ~/pnpm-store-browser/v10
pnpm store path`}</code>
            </pre>
            <p>Run pnpm install afterwards if the new store needs to be populated.</p>
          </div>
          <div>
            <h4>Restore pnpm default behavior</h4>
            <pre>
              <code>{`pnpm config delete store-dir
pnpm store path`}</code>
            </pre>
            <p>The browser index can still use the copied store after pnpm is reset.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
