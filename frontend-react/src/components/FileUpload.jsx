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

    // Read file via FileReader as robust client-side Data URL
    const fileReader = new FileReader();
    const readAsDataUrlPromise = new Promise((resolve) => {
      fileReader.onload = (e) => resolve(e.target.result);
      fileReader.onerror = () => resolve('');
    });
    fileReader.readAsDataURL(file);

    setUploading(true);
    try {
      const clientDataUri = await readAsDataUrlPromise;
      if (clientDataUri) {
        setPreviewUrl(clientDataUri);
      }

      const res = await uploadAPI.uploadFile(file);
      const chosenUrl = (res && res.success && res.fileUrl) ? res.fileUrl : clientDataUri;

      setFileInfo({
        name: file.name,
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
        type: file.type.includes('pdf') ? 'pdf' : 'image',
        url: chosenUrl,
      });
      setPreviewUrl(chosenUrl);
      onChange(chosenUrl);

      if (!res || !res.success) {
        console.warn('Server upload fallback to client DataURI:', res?.message);
      }
    } catch (err) {
      console.warn('Network upload fallback to client DataURI:', err.message);
      // Fallback to clientDataUri
      const clientDataUri = await readAsDataUrlPromise;
      if (clientDataUri) {
        setFileInfo({
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          type: file.type.includes('pdf') ? 'pdf' : 'image',
          url: clientDataUri,
        });
        setPreviewUrl(clientDataUri);
        onChange(clientDataUri);
      } else {
        setError('Failed to process file. Please try again.');
      }
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
