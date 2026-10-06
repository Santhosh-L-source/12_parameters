import { useState, useRef, useEffect } from 'react';
import { uploadAPI, API_BASE_URL } from '../services/api';
import DocumentViewerModal from './DocumentViewerModal';

const FileUpload = ({
  label = 'Upload Proof Document (PDF or JPEG/PNG)',
  required = false,
  value = '',
  onChange,
  accept = '.pdf,.jpg,.jpeg,.png,.webp',
  maxSizeMB = 15,
}) => {
  const [uploading, setUploading] = useState(false);
  const [fileInfo, setFileInfo] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const fileInputRef = useRef(null);

  const allowedExts = accept.split(',').map((e) => e.trim().toLowerCase());

  useEffect(() => {
    if (value && !previewUrl) {
      setPreviewUrl(value);
    }
  }, [value]);

  const handleFile = async (file) => {
    if (!file) return;

    setError(null);
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    // Validate extension
    if (!allowedExts.includes(ext)) {
      setError(`Invalid format (${ext}). Please upload a PDF or JPG/JPEG/PNG file.`);
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds ${maxSizeMB}MB limit.`);
      return;
    }

    // Client-side image compression helper for lightning-fast submission
    const compressImage = async (imgFile) => {
      if (!imgFile.type.startsWith('image/')) return null;
      return new Promise((resolve) => {
        const img = new Image();
        const objUrl = URL.createObjectURL(imgFile);
        img.onload = () => {
          URL.revokeObjectURL(objUrl);
          const maxDim = 1400;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => {
          URL.revokeObjectURL(objUrl);
          resolve(null);
        };
        img.src = objUrl;
      });
    };

    setUploading(true);
    try {
      let clientDataUri = '';
      if (file.type.startsWith('image/')) {
        clientDataUri = await compressImage(file);
      }
      if (!clientDataUri) {
        const fileReader = new FileReader();
        clientDataUri = await new Promise((resolve) => {
          fileReader.onload = (e) => resolve(e.target.result);
          fileReader.onerror = () => resolve('');
          fileReader.readAsDataURL(file);
        });
      }

      if (clientDataUri) {
        setPreviewUrl(clientDataUri);
      }

      // Upload to server
      let chosenUrl = clientDataUri;
      try {
        const res = await uploadAPI.uploadFile(file);
        if (res && res.success && res.localUrl) {
          chosenUrl = res.localUrl;
        }
      } catch (uploadErr) {
        console.warn('Server upload fallback to clientDataUri:', uploadErr.message);
      }

      setFileInfo({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type: file.type.includes('pdf') ? 'pdf' : 'image',
        url: chosenUrl,
      });
      setPreviewUrl(clientDataUri || chosenUrl);
      onChange(chosenUrl);
    } catch (err) {
      console.warn('File processing warning:', err.message);
      setError('Failed to process document. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setFileInfo(null);
    setPreviewUrl('');
    setError(null);
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeDocUrl = previewUrl || value;
  const isPdf = activeDocUrl?.toLowerCase().includes('.pdf') || 
                activeDocUrl?.startsWith('data:application/pdf') || 
                fileInfo?.type === 'pdf';
  const hasValue = !!activeDocUrl;

  const handleOpenPreview = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsViewerOpen(true);
  };

  return (
    <div style={{ marginBottom: '1.25rem', width: '100%' }}>
      {label && (
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#334155', marginBottom: '0.4rem' }}>
          {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
        </label>
      )}

      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: dragActive ? '2px dashed #4f46e5' : hasValue ? '1.5px solid #10b981' : '2px dashed #cbd5e1',
          background: dragActive ? '#eef2ff' : hasValue ? '#f0fdf4' : '#f8fafc',
          borderRadius: '12px',
          padding: '1.25rem',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          position: 'relative',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          style={{ display: 'none' }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFile(e.target.files[0]);
            }
          }}
        />

        {uploading ? (
          <div style={{ padding: '0.75rem 0', color: '#4f46e5', fontWeight: 600, fontSize: '0.9rem' }}>
            ⏳ Uploading & validating document, please wait...
          </div>
        ) : hasValue ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', textAlign: 'left', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>{isPdf ? '📄' : '🖼️'}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                  {fileInfo?.name || (activeDocUrl.startsWith('data:') ? 'Document_Proof' : activeDocUrl.split('/').pop())}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '2px' }}>
                  ✓ {isPdf ? 'PDF Document' : 'Image (JPEG/PNG)'} {fileInfo?.size && `• ${fileInfo.size}`} • Ready to Submit
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleOpenPreview}
                style={{
                  padding: '0.45rem 0.85rem',
                  background: '#dcfce7',
                  color: '#15803d',
                  border: '1px solid #86efac',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                🔍 View Document
              </button>
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: '1px solid #fca5a5',
                  borderRadius: '6px',
                  padding: '0.45rem 0.75rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                ✕ Change
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.4rem' }}>📁</div>
            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.925rem' }}>
              Click to upload or drag & drop document
            </div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
              Supported formats: <strong>PDF (.pdf)</strong> or <strong>Image (.jpg, .jpeg, .png)</strong> (Max {maxSizeMB}MB)
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '0.4rem', fontWeight: 500 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Embedded Document Viewer Modal */}
      <DocumentViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        docUrl={activeDocUrl}
        title={fileInfo?.name || 'Uploaded Proof Document'}
      />
    </div>
  );
};

export default FileUpload;
