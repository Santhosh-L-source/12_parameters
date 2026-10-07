import { useState, useEffect } from 'react';
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
  const [blobPdfUrl, setBlobPdfUrl] = useState('');

  if (!isOpen || !docUrl) return null;

  const targetUrl = getNormalizedDocUrl(docUrl);

  const isPdf =
    targetUrl.toLowerCase().includes('.pdf') ||
    targetUrl.startsWith('data:application/pdf') ||
    targetUrl.includes('type=pdf') ||
    targetUrl.includes('/pdf');

  const isExternalWebUrl =
    (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) &&
    !targetUrl.includes('/uploads/') &&
    !targetUrl.includes('/api/upload/') &&
    !targetUrl.match(/\.(pdf|jpeg|jpg|png|webp|gif|svg)($|\?)/i);

  const isImage =
    !isPdf &&
    !isExternalWebUrl &&
    (targetUrl.startsWith('data:image') ||
      targetUrl.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)($|\?)/i) ||
      targetUrl.startsWith('blob:') ||
      targetUrl.includes('/uploads/'));

  useEffect(() => {
    setImgError(false);
    setZoom(1);

    // Convert data:application/pdf to blob URL for flawless Chrome PDF rendering
    if (isPdf && targetUrl.startsWith('data:')) {
      try {
        const arr = targetUrl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        const blob = new Blob([u8arr], { type: mime });
        const objUrl = URL.createObjectURL(blob);
        setBlobPdfUrl(objUrl);

        return () => {
          URL.revokeObjectURL(objUrl);
        };
      } catch (e) {
        console.warn('PDF blob generation error:', e);
      }
    } else {
      setBlobPdfUrl('');
    }
  }, [targetUrl, isPdf]);

  const activeViewUrl = blobPdfUrl || targetUrl;

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = activeViewUrl;
    a.download = isPdf ? 'certificate_document.pdf' : 'certificate_proof.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (activeViewUrl.startsWith('data:')) {
      try {
        const arr = activeViewUrl.split(',');
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
    window.open(activeViewUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="doc-modal-overlay" onClick={onClose}>
      <div className="doc-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Header Bar */}
        <div className="doc-modal-header">
          <div className="doc-modal-title">
            <span className="doc-modal-icon">{isPdf ? '📄' : isExternalWebUrl ? '🔗' : '🖼️'}</span>
            <div>
              <h3>{title}</h3>
              <span className="doc-modal-subtitle">
                {isPdf ? 'PDF Document' : isExternalWebUrl ? 'Online Credential Link' : isImage ? 'Image Proof' : 'Credential File'}
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

            {!isExternalWebUrl && (
              <button
                type="button"
                className="doc-action-btn primary"
                onClick={handleDownload}
                title="Download File"
              >
                ⬇ Download
              </button>
            )}

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
                src={activeViewUrl}
                title="PDF Document Preview"
                className="pdf-iframe"
                frameBorder="0"
              />
            </div>
          ) : isExternalWebUrl ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🔗</div>
              <h3 style={{ fontSize: '1.25rem', color: '#1e293b', marginBottom: '0.5rem' }}>External Credential Verification</h3>
              <p style={{ color: '#64748b', maxWidth: '480px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
                This credential is hosted on an external verification platform ({new URL(targetUrl).hostname}).
              </p>
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '0.75rem 1.75rem',
                  background: '#4f46e5',
                  color: '#ffffff',
                  borderRadius: '8px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontSize: '0.95rem',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
                }}
              >
                ↗ View Official Certificate Verification
              </a>
            </div>
          ) : isImage && !imgError ? (
            <div className="image-preview-wrapper">
              <img
                src={activeViewUrl}
                alt="Document Preview"
                className="preview-img"
                style={{ transform: `scale(${zoom})` }}
                onError={() => setImgError(true)}
              />
            </div>
          ) : imgError ? (
            <div style={{ padding: '3rem', textAlign: 'center', background: '#ffffff', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <h3 style={{ fontSize: '1.2rem', color: '#1e293b', marginBottom: '0.5rem' }}>Document Preview Unavailable</h3>
              <p style={{ color: '#64748b', maxWidth: '440px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
                This previously submitted file reference is not available on temporary storage. Please submit your certificate proof again to attach the permanent document.
              </p>
            </div>
          ) : (
            <div className="generic-doc-preview">
              <iframe
                src={activeViewUrl}
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

