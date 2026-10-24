"use client";
import { useEffect, useState } from "react";
import { Upload, X, FileImage, LoaderCircle } from "lucide-react";
import { imagePreview, type Preview } from "../lib/imagePreview";
import {
  validateImage,
  MAX_IMAGE_UPLOAD_MB,
  MAX_IMAGES,
  IMAGE_ACCEPT,
} from "../lib/uploadConfig";
export default function PhotoUploader({
  files,
  onChange,
  disabled = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}) {
  const [previews, setPreviews] = useState<Preview[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setPreviews([]);
    void (async () => {
      const next: Preview[] = [];
      for (const file of files) {
        const preview = await imagePreview(file);
        if (preview.url) urls.push(preview.url);
        if (cancelled) {
          urls.forEach(URL.revokeObjectURL);
          return;
        }
        next.push(preview);
        setPreviews([...next]);
      }
    })();
    return () => {
      cancelled = true;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [files]);
  function choose(selected: File[]) {
    if (disabled) return;
    const invalid = selected.map((file) => validateImage(file)).find(Boolean);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (files.length + selected.length > MAX_IMAGES) {
      setError(`Choose up to ${MAX_IMAGES} photos.`);
      return;
    }
    setError("");
    onChange([...files, ...selected]);
  }
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        choose(Array.from(event.dataTransfer.files));
      }}
    >
      <label className="upload-box">
        <Upload size={23} />
        <strong>Upload photographs</strong>
        <span>
          Up to {MAX_IMAGES} photos · JPG, PNG, WebP, HEIC/HEIF ·{" "}
          {MAX_IMAGE_UPLOAD_MB} MB each
        </span>
        <small>
          Choose photos, use your camera, or drop files here. Originals stay in
          private storage.
        </small>
        <input
          aria-label="Upload photographs"
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          disabled={disabled}
          onChange={(event) => {
            choose(Array.from(event.target.files || []));
            event.target.value = "";
          }}
        />
      </label>
      {error && (
        <p className="alert error" role="alert">
          {error}
        </p>
      )}
      <div className="upload-previews">
        {files.map((file, index) => (
          <div
            className="upload-preview"
            key={`${file.name}-${file.lastModified}-${index}`}
          >
            {previews[index]?.url ? (
              <img src={previews[index].url} alt={`Preview of ${file.name}`} />
            ) : (
              <div className="preview-file">
                {previews[index] ? (
                  <FileImage size={24} />
                ) : (
                  <LoaderCircle className="spin" size={24} />
                )}
              </div>
            )}
            <div>
              <strong>{file.name}</strong>
              <small>
                {(file.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                {previews[index]
                  ? previews[index].warning ||
                    "Preview ready · original preserved"
                  : "Preparing preview…"}
              </small>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={`Remove photograph ${index + 1}`}
              disabled={disabled}
              onClick={() => onChange(files.filter((_, i) => i !== index))}
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
