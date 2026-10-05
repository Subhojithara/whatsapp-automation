"use client";

import React, { useState, useRef } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle2, FileUp } from "lucide-react";

interface UploadDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClearFile?: () => void;
  acceptedFormats?: string;
  maxSizeMB?: number;
  subtitle?: string;
}

export function UploadDropzone({
  onFileSelect,
  selectedFile,
  onClearFile,
  acceptedFormats = ".csv, .xlsx, .xls",
  maxSizeMB = 10,
  subtitle = "Drag & drop CSV or Excel contacts file, or browse files",
}: UploadDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats}
        onChange={handleChange}
        className="hidden"
      />

      {selectedFile ? (
        <div className="flex items-center justify-between p-4 bg-emerald-500/10 dark:bg-emerald-500/10 border border-emerald-500/30 rounded-2xl animate-in fade-in duration-200">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                  {selectedFile.name}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ready for recipient parsing & mapping</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-zinc-800 hover:bg-zinc-100 text-zinc-700 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-white/10 transition-colors shadow-xs"
            >
              Replace
            </button>
            {onClearFile && (
              <button
                type="button"
                onClick={onClearFile}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                title="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 select-none group ${
            isDragOver
              ? "border-emerald-500 bg-emerald-500/10 scale-[1.01]"
              : "border-zinc-200 dark:border-white/10 hover:border-emerald-500/50 bg-zinc-50/60 dark:bg-[#111216] hover:bg-zinc-50 dark:hover:bg-[#14151a]"
          }`}
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 group-hover:bg-emerald-500/20 group-hover:text-emerald-500 text-zinc-400 flex items-center justify-center mx-auto mb-3 transition-colors shadow-xs">
            <FileUp className="w-6 h-6 group-hover:-translate-y-0.5 transition-transform" />
          </div>

          <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            Upload Recipient File
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto mb-3">
            {subtitle}
          </p>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
            <span>Formats: CSV, XLSX, XLS</span>
            <span>•</span>
            <span>Max {maxSizeMB}MB</span>
          </div>
        </div>
      )}
    </div>
  );
}
