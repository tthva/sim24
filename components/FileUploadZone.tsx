"use client";
import { useState, useRef, useEffect } from "react";

interface UploadedAttachment {
  id: string;
  fileKey: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  publicUrl: string;
}

interface Props {
  onAttachmentIdsChange: (ids: string[]) => void;
  maxFiles?: number;
  acceptedTypes?: string;
}

export default function FileUploadZone({
  onAttachmentIdsChange,
  maxFiles = 5,
  acceptedTypes = "image/*,.pdf,.doc,.docx",
}: Props) {
  const [attachments, setAttachments] = useState<UploadedAttachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync parent state whenever attachments change
  useEffect(() => {
    onAttachmentIdsChange(attachments.map((a) => a.id));
  }, [attachments, onAttachmentIdsChange]);

  const handleUpload = async (files: FileList) => {
    if (attachments.length + files.length > maxFiles) {
      setError(`حداکثر ${maxFiles} فایل قابل بارگذاری است.`);
      return;
    }
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const newAttachments: UploadedAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size === 0) continue;

      try {
        // Step 1: Get presigned PUT URL from our API
        const presignRes = await fetch("/api/storage/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalName: file.name,
            mimeType: file.type || "application/octet-stream",
            fileSize: file.size,
          }),
        });

        if (!presignRes.ok) {
          const err = await presignRes.json();
          throw new Error(err.error || "خطا در دریافت URL بارگذاری");
        }

        const presignData = await presignRes.json();
        const { id, uploadUrl, fileKey, publicUrl } = presignData.data;

        // Step 2: Upload file directly to S3/MinIO via PUT
        const uploadRes = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type || "application/octet-stream",
          },
        });

        if (!uploadRes.ok) {
          throw new Error(`خطا در بارگذاری ${file.name}`);
        }

        // Step 3: Record the attachment ID
        newAttachments.push({
          id,
          fileKey,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileSize: file.size,
          publicUrl,
        });
      } catch (err: any) {
        setError(err.message || "خطا در بارگذاری فایل");
        console.error("Upload error:", err);
      }
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    setUploading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files);
    }
  };

  const handleRemove = (idToRemove: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== idToRemove));
  };

  return (
    <div className="afu d7">
      <label className="text-white text-sm font-medium mb-2 block text-right" dir="rtl">
        پیوست‌ها (اختیاری)
      </label>
      <div
        className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center cursor-pointer hover:border-[#51BB70] hover:bg-white/5 transition-all"
        onClick={() => fileInputRef.current?.click()}
        dir="rtl"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={acceptedTypes}
          multiple
          className="hidden"
          disabled={uploading}
        />
        {uploading ? (
          <span className="text-white/70 text-sm">در حال آپلود...</span>
        ) : (
          <span className="text-white/70 text-sm">
            روی اینجا کلیک کنید یا فایل بکشید
          </span>
        )}
      </div>
      {error && (
        <p className="text-[#FF6B6B] text-xs text-right mt-2" dir="rtl">
          {error}
        </p>
      )}
      {attachments.length > 0 && (
        <div className="mt-3 space-y-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 border border-white/10"
              dir="rtl"
            >
              <span className="text-sm text-white/80 truncate">
                {att.originalName} ({Math.round(att.fileSize / 1024)}KB)
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(att.id);
                }}
                className="text-[#FF6B6B] text-xs hover:text-[#FF6B6B]/70"
              >
                حذف
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
