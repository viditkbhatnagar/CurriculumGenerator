'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { flattenFolders, type Folder } from '@/hooks/useFolders';

interface MoveToFolderModalProps {
  workflowId: string;
  workflowName: string;
  currentFolderId: string | null;
  folders: Folder[];
  onClose: () => void;
  onMoved: () => void;
}

/** Move a single workflow into a folder (or out, to "Unfiled"). */
export default function MoveToFolderModal({
  workflowId,
  workflowName,
  currentFolderId,
  folders,
  onClose,
  onMoved,
}: MoveToFolderModalProps) {
  const [target, setTarget] = useState<string>(currentFolderId || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const flat = flattenFolders(folders);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const move = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/v3/workflow/${workflowId}/folder`, { folderId: target || null });
      onMoved();
      onClose();
    } catch {
      setError('Could not move the workflow.');
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl w-full max-w-sm overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Move to folder</h3>
          <p className="text-xs text-foreground-muted mt-0.5 truncate">{workflowName}</p>
        </div>
        <div className="p-4">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="">— Unfiled (no folder) —</option>
            {flat.map((f) => (
              <option key={f.id} value={f.id}>
                {'   '.repeat(f.depth)}
                {f.name}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-error mt-2">{error}</p>}
        </div>
        <div className="px-4 py-3 border-t border-border flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm rounded-lg">
            Cancel
          </button>
          <button
            onClick={move}
            disabled={saving}
            className="btn-primary px-3 py-1.5 text-sm rounded-lg disabled:opacity-50"
          >
            {saving ? 'Moving…' : 'Move'}
          </button>
        </div>
      </div>
    </div>
  );
}
