import React, { useState } from 'react';
import { Maximize2, Download, ExternalLink, X } from 'lucide-react';

interface ImagePreviewProps {
  imageUrl?: string;
  originalImageUrl?: string;
  isEdited?: boolean;
  altText?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({
  imageUrl,
  originalImageUrl,
  isEdited,
  altText = 'Generated image'
}) => {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async (url: string, filename: string) => {
    try {
      setDownloading(true);
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (e) {
      console.error('Download failed:', e);
      window.open(url, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  if (!imageUrl && !originalImageUrl) return null;

  return (
    <div className="mt-3 space-y-3">
      {isEdited && originalImageUrl ? (
        // Comparison view for edited images
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
            {/* Original Image */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80 px-1">
                Original
              </span>
              <div className="relative group rounded-xl overflow-hidden border border-border bg-surface-2 shadow-sm aspect-square sm:aspect-auto">
                <img
                  src={originalImageUrl}
                  alt="Original image before edit"
                  className="w-full h-auto max-h-72 object-contain sm:object-cover rounded-xl"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => setLightboxSrc(originalImageUrl)}
                    className="p-2 bg-background/80 hover:bg-background text-foreground rounded-lg shadow-sm transition"
                    title="View full size"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDownload(originalImageUrl, 'original_image.png')}
                    className="p-2 bg-background/80 hover:bg-background text-foreground rounded-lg shadow-sm transition"
                    title="Download original"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Edited Image */}
            <div className="space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-foreground px-1 flex items-center gap-1">
                Edited Result
              </span>
              <div className="relative group rounded-xl overflow-hidden border-2 border-primary/40 bg-surface-2 shadow-sm aspect-square sm:aspect-auto">
                <img
                  src={imageUrl}
                  alt={altText}
                  className="w-full h-auto max-h-72 object-contain sm:object-cover rounded-xl"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={() => setLightboxSrc(imageUrl || null)}
                    className="p-2 bg-background/80 hover:bg-background text-foreground rounded-lg shadow-sm transition"
                    title="View full size"
                  >
                    <Maximize2 size={16} />
                  </button>
                  <button
                    onClick={() => imageUrl && handleDownload(imageUrl, 'edited_image.png')}
                    className="p-2 bg-background/80 hover:bg-background text-foreground rounded-lg shadow-sm transition"
                    title="Download edited"
                    disabled={downloading}
                  >
                    <Download size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Single generated image view
        <div className="relative group max-w-md rounded-2xl overflow-hidden border border-border bg-surface-2 shadow-sm">
          <img
            src={imageUrl}
            alt={altText}
            className="w-full h-auto max-h-96 object-contain rounded-2xl transition duration-300"
            loading="lazy"
          />

          {/* Action overlay */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-background/85 dark:bg-surface-1/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-border shadow-md opacity-90 hover:opacity-100 transition-opacity">
            <button
              onClick={() => setLightboxSrc(imageUrl || null)}
              className="p-1.5 text-foreground hover:text-primary transition rounded-lg hover:bg-surface-2"
              title="View full size"
            >
              <Maximize2 size={15} />
            </button>
            <button
              onClick={() => imageUrl && handleDownload(imageUrl, 'generated_image.png')}
              className="p-1.5 text-foreground hover:text-primary transition rounded-lg hover:bg-surface-2"
              title="Download image"
              disabled={downloading}
            >
              <Download size={15} />
            </button>
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 text-foreground hover:text-primary transition rounded-lg hover:bg-surface-2"
              title="Open in new tab"
            >
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxSrc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] flex flex-col items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition p-1 rounded-full bg-black/40"
              title="Close"
            >
              <X size={24} />
            </button>
            <img
              src={lightboxSrc}
              alt="Enlarged preview"
              className="max-h-[85vh] max-w-full rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => handleDownload(lightboxSrc, 'image.png')}
                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-xl text-sm font-medium hover:bg-gray-100 transition shadow-lg"
              >
                <Download size={16} />
                <span>Download High-Res</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
