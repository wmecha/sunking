'use client';

import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ImportResult {
  filename: string;
  total: number;
  published: number;
  notPublished: number;
  duplicate: number;
  accountStatusUpdates?: number;
}

interface ImportDropzoneProps {
  onImportSuccess: () => void;
}

export function ImportDropzone({ onImportSuccess }: ImportDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file.');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Upload failed');
        return;
      }

      setResult({
        filename: data.filename,
        total: data.total,
        published: data.published,
        notPublished: data.notPublished,
        duplicate: data.duplicate,
        accountStatusUpdates: data.accountStatusUpdates,
      });
      onImportSuccess();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl px-8 py-12 text-center cursor-pointer transition-colors duration-150
          ${isDragging
            ? 'border-[#F5C000] bg-yellow-50'
            : 'border-[#E5E7EB] bg-gray-50 hover:border-[#F5C000] hover:bg-yellow-50'
          }
          ${uploading ? 'cursor-not-allowed opacity-70' : ''}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin h-10 w-10 text-[#F5C000]" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm font-medium text-[#374151]">Uploading and parsing CSV...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[#F5C000]/10 flex items-center justify-center">
              <Upload size={28} className="text-[#F5C000]" />
            </div>
            <div>
              <p className="text-base font-semibold text-[#1C2B3A]">
                Drop your GBP CSV here
              </p>
              <p className="text-sm text-gray-500 mt-1">
                or <span className="text-[#F5C000] font-medium">click to browse</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <FileText size={14} />
              Expected columns: Status, Shop code, Business name, Address, Locality, Country/Region
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle size={16} className="flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle size={18} className="text-green-600" />
            <p className="text-sm font-semibold text-green-800">Import successful: {result.filename}</p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-[#1C2B3A] tabular-nums">{result.total}</p>
              <p className="text-xs text-gray-500">Total locations</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700 tabular-nums">{result.published}</p>
              <p className="text-xs text-gray-500">Published</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600 tabular-nums">{result.notPublished}</p>
              <p className="text-xs text-gray-500">Not published</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-purple-700 tabular-nums">{result.duplicate}</p>
              <p className="text-xs text-gray-500">Duplicate</p>
            </div>
          </div>
          {typeof result.accountStatusUpdates === 'number' && (
            <p className="mt-3 text-xs text-green-800">
              Updated OV/OU and tracker status for {result.accountStatusUpdates} matching tracker row(s).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
