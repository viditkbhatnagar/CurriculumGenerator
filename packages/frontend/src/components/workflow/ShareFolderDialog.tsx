'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { Folder } from '@/hooks/useFolders';

interface ShareUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ShareFolderDialogProps {
  folder: Folder;
  onClose: () => void;
  onSaved: () => void;
}

/** Pick which users a folder is shared with — a searchable multi-select. */
export default function ShareFolderDialog({ folder, onClose, onSaved }: ShareFolderDialogProps) {
  const [users, setUsers] = useState<ShareUser[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(folder.sharedWith));
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const resp = await api.get('/api/v3/folders/users');
        if (!cancelled) {
          setUsers((resp.data?.data ?? []).filter((u: ShareUser) => u.id !== folder.owner));
        }
      } catch {
        if (!cancelled) setError('Could not load the user list.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [folder.owner]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/api/v3/folders/${folder.id}/share`, { userIds: Array.from(selected) });
      onSaved();
      onClose();
    } catch {
      setError('Could not save sharing changes.');
      setSaving(false);
    }
  };

  const filtered = users.filter((u) =>
    [u.email, u.name].some((s) => s.toLowerCase().includes(query.trim().toLowerCase()))
  );

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Share “{folder.name}”</h3>
          <p className="text-xs text-foreground-muted mt-0.5">
            Shared users can see this folder and the workflows in it.
          </p>
        </div>

        <div className="p-3 border-b border-border">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="w-full px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-foreground-muted/60 focus:outline-none focus:border-primary"
          />
        </div>

        <div className="flex-1 overflow-auto p-2">
          {loading && (
            <p className="text-sm text-foreground-muted py-6 text-center">Loading people…</p>
          )}
          {error && <p className="text-sm text-error py-2 px-2">{error}</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-foreground-muted py-6 text-center">No people found.</p>
          )}
          {filtered.map((u) => (
            <label
              key={u.id}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-background-secondary cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selected.has(u.id)}
                onChange={() => toggle(u.id)}
                className="w-4 h-4 accent-primary shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm text-foreground truncate">{u.name}</span>
                <span className="block text-xs text-foreground-muted truncate">
                  {u.email} · {u.role}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border flex items-center justify-between gap-3">
          <span className="text-xs text-foreground-muted">{selected.size} selected</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary px-3 py-1.5 text-sm rounded-lg">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="btn-primary px-3 py-1.5 text-sm rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
