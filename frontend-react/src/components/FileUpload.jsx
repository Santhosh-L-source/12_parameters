import { useState, useRef } from 'react';
import { uploadAPI, API_BASE_URL } from '../services/api';

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
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const allowedExts = accept.split(',').map((e) => e.trim().toLowerCase());

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

    setUploading(true);
    try {
      const res = await uploadAPI.uploadFile(file);
      if (res.success && res.fileUrl) {
        const fullUrl = res.fileUrl.startsWith('http') ? res.fileUrl : `${API_BASE_URL}${res.fileUrl}`;
        setFileInfo({
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
          type: file.type.includes('pdf') ? 'pdf' : 'image',
          url: fullUrl,
        });
        onChange(fullUrl);
      } else {
        setError(res.message || 'Upload failed. Please try again.');
      }
    } catch (err) {
      setError(err.message || 'Network error during upload.');
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
    setError(null);
    onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isPdf = value?.toLowerCase().endsWith('.pdf') || fileInfo?.type === 'pdf';
  const hasValue = !!value;

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
            ⏳ Uploading document, please wait...
          </div>
        ) : hasValue ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>{isPdf ? '📄' : '🖼️'}</span>
              <div>
                <div style={{ fontWeight: 600, color: '#166534', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                  {fileInfo?.name || value.split('/').pop()}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: '2px' }}>
                  ✓ {isPdf ? 'PDF Document' : 'Image (JPEG/PNG)'} {fileInfo?.size && `• ${fileInfo.size}`} • Ready to Submit
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <a
                href={value}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{
                  padding: '0.35rem 0.75rem',
                  background: '#dcfce7',
                  color: '#15803d',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                View ↗
              </a>
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  background: '#fee2e2',
                  color: '#dc2626',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.35rem 0.65rem',
                  fontSize: '0.8rem',
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
    </div>
  );
};

export default FileUpload;
