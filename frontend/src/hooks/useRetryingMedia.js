import { useEffect, useState } from "react";
import {
  resolveMediaUrl,
  withMediaRetry
} from "../utils/media";

export function useRetryingMedia(source, { width } = {}) {
  const resolvedSource = resolveMediaUrl(source, { width });
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    setFailed(false);
    setRetry(0);
  }, [resolvedSource]);

  function handleError() {
    setRetry((currentRetry) => {
      if (currentRetry < 1) {
        return currentRetry + 1;
      }

      setFailed(true);
      return currentRetry;
    });
  }

  return {
    handleError,
    hasImage: Boolean(resolvedSource) && !failed,
    imageUrl: withMediaRetry(resolvedSource, retry)
  };
}
