/**
 * Skill Book Types
 * Types for skill mappings, practical activities, and KPIs
 * Implements Requirements 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { CompetencyDomain, Module } from './excel';

export interface PracticalActivity {
  name: string;
  description: string;
  unitLink: string;
  durationHours: number;
  assessmentType: string;
  resources: string[];
}

export interface MeasurableKPI {
  name: string;
  description: string;
  measurementCriteria: string;
  threshold?: number;
  unit?: string;
  completionCriteria?: string;
}

export interface SkillMapping {
  skillId: string;
  skillName: string;
  domain: string;
  activities: PracticalActivity[];
  kpis: MeasurableKPI[];
  linkedOutcomes: string[]; // learning outcome IDs
  assessmentCriteria: string[];
  workplaceApplications?: string[];
}

export interface SkillMappingGenerationRequest {
  programId: string;
  competencyDomains: CompetencyDomain[];
  modules: Module[];
}

export interface SkillMappingGenerationResult {
  skillMappings: SkillMapping[];
  generatedAt: Date;
  programId: string;
}

export interface LLMSkillMappingOutput {
  skillMappings: Array<{
    skillName: string;
    domain: string;
    activities: Array<{
      name: string;
      description: string;
      unitLink: string;
      durationHours: number;
      assessmentType: string;
      resources: string[];
    }>;
    kpis: Array<{
      name: string;
      description: string;
      measurementCriteria: string;
      threshold?: number;
      unit?: string;
      completionCriteria?: string;
    }>;
    assessmentCriteria: string[];
    workplaceApplications?: string[];
  }>;
}
