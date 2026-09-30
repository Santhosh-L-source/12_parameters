import { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X } from 'lucide-react';

export default function EditableCell({ value, onSave, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  function startEdit() {
    if (disabled) return;
    setDraft(value);
    setEditing(true);
  }

  async function save() {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 0) return cancel();
    setEditing(false);
    if (num !== value) await onSave(num);
  }

  function cancel() {
    setEditing(false);
    setDraft(value);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  }

  if (editing) {
    return (
      <span className="edit-inline">
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={save}
        />
        <button className="btn btn-icon btn-ghost" onClick={save} title="Save">
          <Check size={14} />
        </button>
        <button className="btn btn-icon btn-ghost" onMouseDown={cancel} title="Cancel">
          <X size={14} />
        </button>
      </span>
    );
  }

  return (
    <span
      className={`editable-cell ${disabled ? '' : ''}`}
      onClick={startEdit}
      title={disabled ? '' : 'Click to edit'}
    >
      <span className={`num-highlight ${value === 0 ? 'num-zero' : ''}`}>{value}</span>
      {!disabled && <Pencil size={13} className="edit-icon" />}
    </span>
  );
}
