'use client';

import { useRef, useState } from 'react';
import { Upload, X, ImageIcon, Loader2 } from 'lucide-react';

type Slot = 'logo' | 'cover' | 'other';

interface PhotoUploaderProps {
  storeCode: string;
  logoUrl: string | null | undefined;
  coverUrl: string | null | undefined;
  otherUrls: string[];
  onChange: (next: { logo_photo_url?: string | null; cover_photo_url?: string | null; other_photo_urls?: string[] }) => void;
}

const MAX_OTHER = 10;
const ACCEPT = 'image/jpeg,image/png,image/webp';

export function PhotoUploader({ storeCode, logoUrl, coverUrl, otherUrls, onChange }: PhotoUploaderProps) {
  const [uploading, setUploading] = useState<Slot | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(slot: Slot, file: File) {
    setError(null);
    setUploading(slot);
    try {
      const form = new FormData();
      form.append('slot', slot);
      form.append('file', file);
      const res = await fetch(`/api/locations/${encodeURIComponent(storeCode)}/photos`, {
        method: 'POST',
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Upload failed');
      if (slot === 'logo') onChange({ logo_photo_url: json.url });
      else if (slot === 'cover') onChange({ cover_photo_url: json.url });
      else onChange({ other_photo_urls: [...otherUrls, json.url] });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(null);
    }
  }

  async function remove(slot: Slot, url?: string) {
    setError(null);
    setUploading(slot);
    try {
      const qs = new URLSearchParams({ slot });
      if (url) qs.set('url', url);
      const res = await fetch(`/api/locations/${encodeURIComponent(storeCode)}/photos?${qs}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Delete failed');
      if (slot === 'logo') onChange({ logo_photo_url: null });
      else if (slot === 'cover') onChange({ cover_photo_url: null });
      else onChange({ other_photo_urls: otherUrls.filter((u) => u !== url) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <PhotoSlot
          label="Logo"
          hint="Square recommended (≥ 720×720)"
          url={logoUrl}
          uploading={uploading === 'logo'}
          onUpload={(f) => upload('logo', f)}
          onRemove={() => remove('logo')}
        />
        <PhotoSlot
          label="Cover"
          hint="16:9 recommended (≥ 1080×608)"
          url={coverUrl}
          uploading={uploading === 'cover'}
          onUpload={(f) => upload('cover', f)}
          onRemove={() => remove('cover')}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-500">
            Other photos <span className="text-gray-400">({otherUrls.length}/{MAX_OTHER})</span>
          </label>
          <AddOtherButton
            disabled={otherUrls.length >= MAX_OTHER || uploading === 'other'}
            uploading={uploading === 'other'}
            onSelect={(f) => upload('other', f)}
          />
        </div>

        {otherUrls.length === 0 ? (
          <div className="border border-dashed border-[#E5E7EB] rounded-md p-4 text-center text-xs text-gray-400">
            No additional photos yet. Use the button above to add up to {MAX_OTHER}.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {otherUrls.map((url) => (
              <div key={url} className="relative group aspect-square bg-gray-50 border border-[#E5E7EB] rounded-md overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => remove('other', url)}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        JPEG, PNG, or WebP. Max 5MB. URLs auto-fill the Logo / Cover / Other photo columns when you export the Google Bulk Upload CSV.
      </p>
    </div>
  );
}

function PhotoSlot({
  label,
  hint,
  url,
  uploading,
  onUpload,
  onRemove,
}: {
  label: string;
  hint: string;
  url: string | null | undefined;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="border border-[#E5E7EB] rounded-md p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-[10px] text-gray-400">{hint}</span>
      </div>
      <div className="aspect-video bg-gray-50 rounded relative overflow-hidden flex items-center justify-center">
        {uploading ? (
          <Loader2 size={20} className="animate-spin text-[#F5C000]" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="w-full h-full object-contain" />
        ) : (
          <ImageIcon size={28} className="text-gray-300" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded border border-[#E5E7EB] hover:border-[#F5C000] hover:text-[#1C2B3A] disabled:opacity-50 transition-colors"
        >
          <Upload size={12} /> {url ? 'Replace' : 'Upload'}
        </button>
        {url && (
          <button
            onClick={onRemove}
            disabled={uploading}
            className="flex items-center justify-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            <X size={12} /> Remove
          </button>
        )}
      </div>
    </div>
  );
}

function AddOtherButton({
  disabled,
  uploading,
  onSelect,
}: {
  disabled: boolean;
  uploading: boolean;
  onSelect: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSelect(f);
          e.target.value = '';
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded border border-[#E5E7EB] hover:border-[#F5C000] disabled:opacity-50 transition-colors"
      >
        {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        Add photo
      </button>
    </>
  );
}
