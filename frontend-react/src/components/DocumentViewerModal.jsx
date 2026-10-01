import { useState } from 'react';
import './DocumentViewerModal.css';

const DocumentViewerModal = ({ isOpen, onClose, docUrl, title = 'Document Preview' }) => {
  const [zoom, setZoom] = useState(1);

  if (!isOpen || !docUrl) return null;

  const isPdf = docUrl.toLowerCase().includes('.pdf') || 
                docUrl.startsWith('data:application/pdf') || 
                docUrl.includes('type=pdf');

  const isImage = !isPdf && (
    docUrl.startsWith('data:image') || 
    docUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) ||
    docUrl.startsWith('blob:')
  );

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = docUrl;
    a.download = isPdf ? 'certificate_document.pdf' : 'certificate_proof.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenNewTab = () => {
    if (docUrl.startsWith('data:')) {
      // Convert base64 to blob for safe new tab opening in Chrome
      try {
        const arr = docUrl.split(',');
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
    window.open(docUrl, '_blank', 'noopener,noreferrer');
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
                  onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
                  title="Zoom Out"
                >
                  🔍-
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button 
                  type="button" 
                  className="doc-action-btn"
                  onClick={() => setZoom(z => Math.min(3, z + 0.25))}
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
                src={docUrl}
                title="PDF Document Preview"
                className="pdf-iframe"
                frameBorder="0"
              />
            </div>
          ) : isImage ? (
            <div className="image-preview-wrapper">
              <img 
                src={docUrl} 
                alt="Document Preview" 
                className="preview-img"
                style={{ transform: `scale(${zoom})` }}
              />
            </div>
          ) : (
            <div className="generic-doc-preview">
              <iframe
                src={docUrl}
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
