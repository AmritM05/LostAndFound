"use client";
import { useEffect, useState } from "react";
import { request } from "../services/apiClient";
export default function PrivatePhoto({
  url,
  index,
}: {
  url: string;
  index: number;
}) {
  const [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false),
    [filename, setFilename] = useState("");
  useEffect(() => {
    let cancelled = false;
    request(`${url}${url.includes("?") ? "&" : "?"}metadata=1`)
      .then((data) => {
        if (cancelled) return;
        setFilename(data.filename);
        setFailed(
          !data.hasPreview &&
            [
              "image/heic",
              "image/heif",
              "image/heic-sequence",
              "image/heif-sequence",
            ].includes(data.mimeType),
        );
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [url]);
  return (
    <div>
      {!ready ? (
        <p>Loading photo preview…</p>
      ) : !failed ? (
        <img
          src={url}
          alt={`Report photograph ${index + 1}`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <p>Preview unavailable for {filename || "this image"}.</p>
      )}
      <a
        className="text-link"
        href={`${url}${url.includes("?") ? "&" : "?"}original=1`}
        download
      >
        Download original photo {index + 1}
      </a>
    </div>
  );
}
