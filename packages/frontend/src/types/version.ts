export interface CurriculumVersion {
  id: string;
  program_id: string;
  version_number: number;
  created_at: string;
  created_by: string;
  author_email: string;
  changes_summary: string;
  content: any;
}

export interface VersionDiff {
  field: string;
  oldValue: any;
  newValue: any;
  changeType: 'added' | 'removed' | 'modified';
}
