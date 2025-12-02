export interface CurriculumVersion {
  id: string;
  program_id: string;
  version_number: number;
  created_at: string;
  created_by: string;
  author_email: string;
  changes_summary: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
}

export interface VersionDiff {
  field: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  oldValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}
