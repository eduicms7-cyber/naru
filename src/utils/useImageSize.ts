import { useEffect, useState } from 'react';
import { Image } from 'react-native';

interface Size {
  width: number;
  height: number;
}

const sizeCache = new Map<string, Size>();

// 이미지 원본 비율을 알아야 잘리지 않게 세로 크기를 정할 수 있어서, Image.getSize로 한 번만 조회해 캐시한다.
export function useImageSize(uri: string | undefined): Size | null {
  const [size, setSize] = useState<Size | null>(uri ? sizeCache.get(uri) ?? null : null);

  useEffect(() => {
    if (!uri) {
      setSize(null);
      return;
    }
    const cached = sizeCache.get(uri);
    if (cached) {
      setSize(cached);
      return;
    }
    let cancelled = false;
    Image.getSize(
      uri,
      (width, height) => {
        if (cancelled) return;
        const result = { width, height };
        sizeCache.set(uri, result);
        setSize(result);
      },
      () => {
        if (!cancelled) setSize(null);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [uri]);

  return size;
}
