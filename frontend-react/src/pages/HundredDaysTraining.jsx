import React, { useState, useEffect } from 'react';
import { moduleAPI } from '../services/api';
import './ModulePage.css';

const HundredDaysTraining = () => {
  const student = JSON.parse(localStorage.getItem('student'));
  const [evidence, setEvidence] = useState(null);
  const [marks, setMarks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Form state - matches hundred_days_evidence schema
  const [formData, setFormData] = useState({
    training_program: '',
    selection_year: '',
    selection_letter_url: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [evidenceData, marksData] = await Promise.all([
        moduleAPI.getHundredDays(student.roll_number),
        moduleAPI.getHundredDaysMarks(student.roll_number)
      ]);

      setEvidence(evidenceData.evidence);
      setMarks(marksData);

      // Populate form if evidence exists
      if (evidenceData.evidence) {
        setFormData({
          training_program: evidenceData.evidence.training_program || '',
          selection_year: evidenceData.evidence.selection_year || '',
          selection_letter_url: evidenceData.evidence.selection_letter_url || ''
        });
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ text: 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ text: '', type: '' });

    try {
      // Validate required fields
      if (!formData.training_program) {
        setMessage({ text: 'Training program is required', type: 'error' });
        setSubmitting(false);
        return;
      }

      const result = await moduleAPI.submitHundredDays({
        training_program: formData.training_program,
        selection_year: formData.selection_year ? parseInt(formData.selection_year) : null,
        selection_letter_url: formData.selection_letter_url || null
      });

      setMessage({
        text: result.is_update
          ? 'Evidence updated successfully! Status reset to PENDING.'
          : 'Evidence submitted successfully!',
        type: 'success'
      });

      // Reload data
      await loadData();
    } catch (error) {
      console.error('Error submitting:', error);
      setMessage({
        text: error.message || 'Failed to submit evidence',
        type: 'error'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return <div className="module-page"><div className="loading">Loading...</div></div>;
  }

  const getStatusBadge = (status) => {
    const badges = {
      'PENDING': { class: 'status-pending', text: 'Pending Review' },
      'VERIFIED': { class: 'status-verified', text: 'Verified' },
      'REJECTED': { class: 'status-rejected', text: 'Rejected' }
    };
    const badge = badges[status] || badges.PENDING;
    return <span className={`status-badge ${badge.class}`}>{badge.text}</span>;
  };

  const getProgramLabel = (program) => {
    const labels = {
      'PEP': 'PEP (5 marks)',
      'HOPE_NON_ELITE': 'HOPE Non-Elite (10 marks)',
      'HOPE_ELITE': 'HOPE Elite (15 marks)',
      'NOT_SELECTED': 'Not Selected (0 marks)'
    };
    return labels[program] || program;
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <h1>100 Days Training</h1>
        <p className="module-description">
          One-time submission for PEP/HOPE training program selection
        </p>
        <div className="marks-display">
          <span className="current-marks">{marks?.marks || 0}</span>
          <span className="max-marks">/ {marks?.max_marks || 15} marks</span>
        </div>
      </div>

      {message.text && (
        <div className={`message ${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Current Status */}
      {evidence && (
        <div className="evidence-card">
          <h3>Current Submission</h3>
          <div className="evidence-details">
            <div className="detail-row">
              <span className="label">Status:</span>
              <span className="value">{getStatusBadge(evidence.status)}</span>
            </div>
            <div className="detail-row">
              <span className="label">Training Program:</span>
              <span className="value">{getProgramLabel(evidence.training_program)}</span>
            </div>
            {evidence.selection_year && (
              <div className="detail-row">
                <span className="label">Selection Year:</span>
                <span className="value">{evidence.selection_year}</span>
              </div>
            )}
            {evidence.selection_letter_url && (
              <div className="detail-row">
                <span className="label">Selection Letter:</span>
                <span className="value">
                  <a href={evidence.selection_letter_url} target="_blank" rel="noopener noreferrer">
                    View Document
                  </a>
                </span>
              </div>
            )}
            {evidence.rejection_reason && (
              <div className="detail-row rejection">
                <span className="label">Rejection Reason:</span>
                <span className="value">{evidence.rejection_reason}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="label">Submitted:</span>
              <span className="value">{new Date(evidence.submitted_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Submission Form */}
      <div className="form-card">
        <h3>{evidence ? 'Update Submission' : 'Submit Evidence'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="training_program">
              Training Program <span className="required">*</span>
            </label>
            <select
              id="training_program"
              name="training_program"
              value={formData.training_program}
              onChange={handleChange}
              required
            >
              <option value="">Select Program</option>
              <option value="PEP">PEP (5 marks)</option>
              <option value="HOPE_NON_ELITE">HOPE Non-Elite (10 marks)</option>
              <option value="HOPE_ELITE">HOPE Elite (15 marks)</option>
              <option value="NOT_SELECTED">Not Selected (0 marks)</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="selection_year">Selection Year</label>
            <input
              type="number"
              id="selection_year"
              name="selection_year"
              value={formData.selection_year}
              onChange={handleChange}
              placeholder="e.g., 2024"
              min="2020"
              max="2030"
            />
            <small>Year you were selected for the program</small>
          </div>

          <div className="form-group">
            <label htmlFor="selection_letter_url">Selection Letter URL</label>
            <input
              type="url"
              id="selection_letter_url"
              name="selection_letter_url"
              value={formData.selection_letter_url}
              onChange={handleChange}
              placeholder="https://..."
            />
            <small>Link to your selection letter document (Google Drive, etc.)</small>
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={submitting}
          >
            {submitting ? 'Submitting...' : (evidence ? 'Update Evidence' : 'Submit Evidence')}
          </button>
        </form>
      </div>

      {/* Scoring Information */}
      <div className="info-card">
        <h3>Scoring Information</h3>
        <ul>
          <li><strong>PEP:</strong> 5 marks</li>
          <li><strong>HOPE Non-Elite:</strong> 10 marks</li>
          <li><strong>HOPE Elite:</strong> 15 marks</li>
          <li><strong>Not Selected:</strong> 0 marks</li>
        </ul>
        <p className="note">
          <strong>Note:</strong> This is a one-time submission. Only one record per student is allowed.
          You can update your submission, but it will reset the verification status to PENDING.
        </p>
      </div>
    </div>
  );
};

export default HundredDaysTraining;
