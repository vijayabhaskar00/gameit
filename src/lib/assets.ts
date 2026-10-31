import { useEffect, useState } from 'react';

interface Manifest {
  basePath: string;
  images: { key: string; file: string; ready: boolean }[];
}

let manifest: Promise<Manifest> | undefined;

/** URL of a page image from assets.json, or null while it is not ready. */
export function useAsset(key: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    manifest ??= fetch('/assets/assets.json').then((r) => r.json() as Promise<Manifest>);
    manifest
      .then((m) => {
        const entry = m.images.find((image) => image.key === key);
        if (entry?.ready) setUrl(m.basePath + entry.file);
      })
      .catch(() => {});
  }, [key]);
  return url;
}
