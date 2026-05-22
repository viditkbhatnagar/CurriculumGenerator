'use client';

import { useState, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Folder } from '@/hooks/useFolders';
import { FolderPlus, ChevronRight, MoreHorizontal, Layers, Inbox } from 'lucide-react';

const FOLDER_COLORS = ['#0f766e', '#7c3aed', '#dc2626', '#ea580c', '#2563eb', '#16a34a', '#64748b'];

/** A drop target — highlights when a workflow card is dragged onto it. */
function DroppableZone({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn('rounded-lg transition-shadow', isOver && 'ring-2 ring-primary ring-inset')}
    >
      {children}
    </div>
  );
}

interface FolderSidebarProps {
  folders: Folder[];
  /** 'all' | 'unfiled' | a folder id */
  selectedFolderId: string;
  onSelect: (id: string) => void;
  counts: { all: number; unfiled: number; byFolder: Record<string, number> };
  /** Refetch folders after a create/rename/delete/recolor. */
  onChanged: () => void;
  onShare: (folder: Folder) => void;
}

export default function FolderSidebar({
  folders,
  selectedFolderId,
  onSelect,
  counts,
  onChanged,
  onShare,
}: FolderSidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const childrenOf = (parentId: string | null) =>
    folders
      .filter((f) => (f.parentFolderId || null) === parentId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  const createFolder = async (parentFolderId: string | null) => {
    const name = prompt(parentFolderId ? 'New subfolder name' : 'New folder name');
    if (!name || !name.trim()) {
      setMenuFor(null);
      return;
    }
    setBusy(true);
    try {
      await api.post('/api/v3/folders', { name: name.trim(), parentFolderId });
      if (parentFolderId) setExpanded((e) => ({ ...e, [parentFolderId]: true }));
      onChanged();
    } catch {
      alert('Could not create the folder.');
    } finally {
      setBusy(false);
      setMenuFor(null);
    }
  };

  const renameFolder = async (folder: Folder) => {
    const name = prompt('Rename folder', folder.name);
    setMenuFor(null);
    if (!name || !name.trim() || name.trim() === folder.name) return;
    setBusy(true);
    try {
      await api.patch(`/api/v3/folders/${folder.id}`, { name: name.trim() });
      onChanged();
    } catch {
      alert('Could not rename the folder.');
    } finally {
      setBusy(false);
    }
  };

  const recolorFolder = async (folder: Folder, color: string) => {
    setBusy(true);
    try {
      await api.patch(`/api/v3/folders/${folder.id}`, { color });
      onChanged();
    } catch {
      alert('Could not update the folder colour.');
    } finally {
      setBusy(false);
      setMenuFor(null);
    }
  };

  const deleteFolder = async (folder: Folder) => {
    setMenuFor(null);
    if (
      !confirm(
        `Delete "${folder.name}"?\n\nIts subfolders and workflows move up one level — nothing is deleted.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api.delete(`/api/v3/folders/${folder.id}`);
      if (selectedFolderId === folder.id) onSelect('all');
      onChanged();
    } catch {
      alert('Could not delete the folder.');
    } finally {
      setBusy(false);
    }
  };

  const renderFolder = (folder: Folder, depth: number) => {
    const kids = childrenOf(folder.id);
    const isOpen = !!expanded[folder.id];
    const active = selectedFolderId === folder.id;
    return (
      <div key={folder.id}>
        <DroppableZone id={`folder:${folder.id}`}>
          <div
            className={cn(
              'group flex items-center gap-0.5 rounded-lg pr-0.5 transition-colors',
              active ? 'bg-primary/10' : 'hover:bg-background-secondary'
            )}
            style={{ paddingLeft: `${depth * 14}px` }}
          >
            <button
              onClick={() => setExpanded((e) => ({ ...e, [folder.id]: !isOpen }))}
              className={cn(
                'p-0.5 shrink-0 text-foreground-muted',
                kids.length === 0 && 'invisible'
              )}
              aria-label={isOpen ? 'Collapse' : 'Expand'}
            >
              <ChevronRight
                className={cn('w-3.5 h-3.5 transition-transform', isOpen && 'rotate-90')}
              />
            </button>
            <button
              onClick={() => onSelect(folder.id)}
              className="flex-1 flex items-center gap-1.5 py-1.5 min-w-0 text-left"
            >
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: folder.color || '#64748b' }}
              />
              <span
                className={cn(
                  'text-sm truncate',
                  active ? 'text-foreground font-medium' : 'text-foreground-muted'
                )}
              >
                {folder.name}
              </span>
              <span className="ml-auto text-[10px] text-foreground-muted/70 tabular-nums pl-1">
                {counts.byFolder[folder.id] || 0}
              </span>
            </button>
            <div className="relative shrink-0">
              <button
                onClick={() => setMenuFor(menuFor === folder.id ? null : folder.id)}
                className="p-1 rounded text-foreground-muted opacity-0 group-hover:opacity-100 hover:bg-background-secondary transition-opacity"
                aria-label="Folder actions"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
              {menuFor === folder.id && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuFor(null)} />
                  <div className="absolute right-0 top-7 z-20 w-44 bg-card border border-border rounded-lg shadow-lg py-1 text-sm">
                    <button
                      onClick={() => createFolder(folder.id)}
                      disabled={busy}
                      className="w-full px-3 py-1.5 text-left text-foreground hover:bg-background-secondary"
                    >
                      New subfolder
                    </button>
                    {folder.isOwner && (
                      <>
                        <button
                          onClick={() => renameFolder(folder)}
                          disabled={busy}
                          className="w-full px-3 py-1.5 text-left text-foreground hover:bg-background-secondary"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => {
                            setMenuFor(null);
                            onShare(folder);
                          }}
                          className="w-full px-3 py-1.5 text-left text-foreground hover:bg-background-secondary"
                        >
                          Share…
                        </button>
                        <div className="flex items-center gap-1.5 px-3 py-1.5">
                          {FOLDER_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => recolorFolder(folder, c)}
                              className={cn(
                                'w-4 h-4 rounded-sm border',
                                folder.color === c ? 'border-foreground' : 'border-transparent'
                              )}
                              style={{ background: c }}
                              aria-label={`Set colour ${c}`}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => deleteFolder(folder)}
                          disabled={busy}
                          className="w-full px-3 py-1.5 text-left text-error hover:bg-error-muted"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </DroppableZone>
        {isOpen && kids.map((k) => renderFolder(k, depth + 1))}
      </div>
    );
  };

  const roots = childrenOf(null);

  return (
    <aside className="w-full lg:w-60 shrink-0">
      <div className="card p-3">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[11px] uppercase tracking-[0.12em] font-medium text-foreground-muted">
            Folders
          </span>
          <button
            onClick={() => createFolder(null)}
            disabled={busy}
            title="New folder"
            className="p-1 rounded hover:bg-background-secondary text-foreground-muted hover:text-foreground transition-colors"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => onSelect('all')}
          className={cn(
            'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
            selectedFolderId === 'all'
              ? 'bg-primary/10 text-foreground font-medium'
              : 'text-foreground-muted hover:bg-background-secondary'
          )}
        >
          <Layers className="w-4 h-4 shrink-0" />
          All workflows
          <span className="ml-auto text-[10px] tabular-nums">{counts.all}</span>
        </button>
        <DroppableZone id="unfiled">
          <button
            onClick={() => onSelect('unfiled')}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors',
              selectedFolderId === 'unfiled'
                ? 'bg-primary/10 text-foreground font-medium'
                : 'text-foreground-muted hover:bg-background-secondary'
            )}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            Unfiled
            <span className="ml-auto text-[10px] tabular-nums">{counts.unfiled}</span>
          </button>
        </DroppableZone>

        <div className="my-2 border-t border-border/50" />

        {roots.length === 0 ? (
          <p className="text-xs text-foreground-muted/70 px-2 py-3 leading-relaxed">
            No folders yet. Use the + above to create one and organize your workflows.
          </p>
        ) : (
          <div className="space-y-0.5">{roots.map((r) => renderFolder(r, 0))}</div>
        )}
      </div>
    </aside>
  );
}
