import { useRef, useState, type ChangeEvent } from "react";
import { validateImageFile } from "../../src/lib/image-file";
import { registerLocalImage } from "../../src/lib/offline/image-store";
import { OfflineImage } from "./offline-image";

export function ImagePickerField({
  label,
  value,
  online,
  onChange,
}: {
  label: string;
  value: string | null;
  online: boolean;
  onChange: (next: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const ref = await registerLocalImage(file);
      onChange(ref);
    } catch {
      setError("Couldn't save the image on this device.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="image-picker">
      <span className="image-picker__label">{label}</span>
      {value ? (
        <div className="image-picker__preview">
          <OfflineImage src={value} alt={label} className="image-picker__img" online={online} />
          <button type="button" className="btn secondary btn--sm" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="btn secondary btn--sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Saving…" : value ? "Replace image" : "Add image"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="image-picker__file"
        onChange={handleFile}
      />
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
