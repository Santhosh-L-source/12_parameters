import { useState } from 'react';
import { API_BASE_URL } from '../services/api';
import './DocumentViewerModal.css';

export const getNormalizedDocUrl = (url) => {
  if (!url) return '';
  const str = String(url).trim();
  if (
    str.startsWith('data:') ||
    str.startsWith('blob:') ||
    str.startsWith('http://') ||
    str.startsWith('https://')
  ) {
    return str;
  }
  if (str.startsWith('/')) {
    return `${API_BASE_URL}${str}`;
  }
  if (str.startsWith('uploads/')) {
    return `${API_BASE_URL}/${str}`;
  }
  return `${API_BASE_URL}/uploads/${str}`;
};

const DocumentViewerModal = ({ isOpen, onClose, docUrl, title = 'Document Preview' }) => {
  const [zoom, setZoom] = useState(1);
  const [imgError, setImgError] = useState(false);

  if (!isOpen || !docUrl) return null;

  const targetUrl = getNormalizedDocUrl(docUrl);

  const isPdf =
    targetUrl.toLowerCase().includes('.pdf') ||
    targetUrl.startsWith('data:application/pdf') ||
    targetUrl.includes('type=pdf') ||
    targetUrl.includes('/pdf');

  const isImage =
    !isPdf &&
    (targetUrl.startsWith('data:image') ||
      targetUrl.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)($|\?)/i) ||
      targetUrl.startsWith('blob:') ||
      targetUrl.includes('/uploads/'));

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = targetUrl;
    a.download = isPdf ? 'certificate_document.pdf' : 'certificate_proof.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (targetUrl.startsWith('data:')) {
      // Convert base64 to blob for safe new tab opening in Chrome
      try {
        const arr = targetUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
        return;
      } catch (e) {
        console.warn('Blob conversion error:', e);
      }
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="doc-modal-overlay" onClick={onClose}>
      <div className="doc-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="doc-modal-header">
          <div className="doc-modal-title">
            <span className="doc-modal-icon">{isPdf ? '📄' : '🖼️'}</span>
            <div>
              <h3>{title}</h3>
              <span className="doc-modal-subtitle">
                {isPdf ? 'PDF Document' : isImage ? 'Image Proof' : 'Credential File'}
              </span>
            </div>
          </div>

          <div className="doc-modal-actions">
            {!isPdf && isImage && (
              <div className="zoom-controls">
                <button
                  type="button"
                  className="doc-action-btn"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  title="Zoom Out"
                >
                  🔍-
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  className="doc-action-btn"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  title="Zoom In"
                >
                  🔍+
                </button>
              </div>
            )}

            <button
              type="button"
              className="doc-action-btn"
              onClick={handleOpenNewTab}
              title="Open in New Tab"
            >
              ↗ Open
            </button>

            <button
              type="button"
              className="doc-action-btn primary"
              onClick={handleDownload}
              title="Download File"
            >
              ⬇ Download
            </button>

            <button
              type="button"
              className="doc-modal-close"
              onClick={onClose}
              title="Close Preview"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="doc-modal-body">
          {isPdf ? (
            <div className="pdf-frame-wrapper">
              <iframe
                src={targetUrl}
                title="PDF Document Preview"
                className="pdf-iframe"
                frameBorder="0"
              />
            </div>
          ) : isImage && !imgError ? (
            <div className="image-preview-wrapper">
              <img
                src={targetUrl}
                alt="Document Preview"
                className="preview-img"
                style={{ transform: `scale(${zoom})` }}
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            <div className="generic-doc-preview">
              <iframe
                src={targetUrl}
                title="Document Preview"
                className="pdf-iframe"
                frameBorder="0"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentViewerModal;

