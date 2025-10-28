export type ProgramStatus = 'draft' | 'submitted' | 'under review' | 'approved';

export interface Program {
  id: string;
  program_name: string;
  qualification_level: string;
  qualification_type: string;
  total_credits: number;
  industry_sector: string;
  status: ProgramStatus;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface ProgramDetail extends Program {
  modules: Module[];
  learning_outcomes: LearningOutcome[];
}

export interface Module {
  id: string;
  program_id: string;
  module_code: string;
  module_title: string;
  hours: number;
  module_aim: string;
  core_elective: string;
  sequence_order: number;
}

export interface LearningOutcome {
  id: string;
  module_id: string;
  outcome_text: string;
  assessment_criteria: any;
  knowledge_skill_competency: string;
  bloom_level: string;
}

export interface ProgramFeedback {
  id: string;
  program_id: string;
  reviewer_id: string;
  feedback_text: string;
  created_at: string;
}
