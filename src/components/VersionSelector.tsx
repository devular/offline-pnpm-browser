import { useNavigate } from '@tanstack/react-router';

export function VersionSelector({
  currentVersion,
  versions,
  packageName,
}: {
  currentVersion: string;
  versions: Array<{ id: number; version: string }>;
  packageName: string;
}) {
  const navigate = useNavigate();

  if (versions.length <= 1) {
    return <span className="pkg-ver">{currentVersion}</span>;
  }

  return (
    <div className="version-select-wrap">
      <select
        className="version-select"
        value={currentVersion}
        onChange={(e) => {
          const newVersion = e.target.value;
          navigate({
            to: '/package/$name',
            params: { name: packageName },
            search: { v: newVersion },
          });
        }}
        aria-label="Package version"
      >
        {versions.map((v) => (
          <option key={v.id} value={v.version}>
            {v.version}
          </option>
        ))}
      </select>
      <span className="version-count">{versions.length} versions</span>
    </div>
  );
}
