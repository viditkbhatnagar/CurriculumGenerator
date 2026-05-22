import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Folder {
  id: string;
  name: string;
  parentFolderId: string | null;
  color: string;
  position: number;
  owner: string;
  sharedWith: string[];
  isOwner: boolean;
  createdAt: string;
}

/** Folders the current user owns or that have been shared with them. */
export function useFolders() {
  return useQuery<Folder[]>({
    queryKey: ['folders'],
    queryFn: async () => {
      const resp = await api.get('/api/v3/folders');
      return resp.data?.data ?? [];
    },
  });
}

/**
 * Flatten the folder tree depth-first — used to render a folder picker
 * (`<select>`) where nesting is shown by an indent prefix.
 */
export function flattenFolders(folders: Folder[]): Array<Folder & { depth: number }> {
  const childrenOf = (parentId: string | null) =>
    folders
      .filter((f) => (f.parentFolderId || null) === parentId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));

  const out: Array<Folder & { depth: number }> = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const f of childrenOf(parentId)) {
      out.push({ ...f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}
