/**
 * Benchmarking Service
 * Compares generated curricula against competitor institutions
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */

import { Pool } from 'pg';
import config from '../config';
import {
  CompetitorProgram,
  CompetitorProgramInput,
  BenchmarkReport,
  InstitutionComparison,
  Gap,
  Strength,
  TopicComparison,
} from '../types/benchmark';
import { ProgramSpecification, UnitSpecification } from '../types/curriculum';
import { embeddingService } from './embeddingService';

const pool = new Pool({
  connectionString: config.database.url,
});

export class BenchmarkingService {
  /**
   * Store a competitor program in the database
   * Requirement 7.1: Store competitor curriculum data
   */
  async storeCompetitorProgram(
    input: CompetitorProgramInput
  ): Promise<CompetitorProgram> {
    const query = `
      INSERT INTO competitor_programs (
        institution_name, program_name, level, topics, structure
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, institution_name, program_name, level, topics, structure, created_at
    `;

    const values = [
      input.institutionName,
      input.programName,
      input.level || null,
      JSON.stringify(input.topics),
      JSON.stringify(input.structure),
    ];

    const result = await pool.query(query, values);
    const row = result.rows[0];

    return {
      id: row.id,
      institutionName: row.institution_name,
      programName: row.program_name,
      level: row.level,
      topics: row.topics,
      structure: row.structure,
      createdAt: row.created_at,
    };
  }

  /**
   * Import multiple competitor programs
   * Requirement 7.1: Implement data import functionality
   */
  async importCompetitorPrograms(
    programs: CompetitorProgramInput[]
  ): Promise<CompetitorProgram[]> {
    const imported: CompetitorProgram[] = [];

    for (const program of programs) {
      const stored = await this.storeCompetitorProgram(program);
      imported.push(stored);
    }

    return imported;
  }

  /**
   * Get all competitor programs
   */
  async getAllCompetitorPrograms(): Promise<CompetitorProgram[]> {
    const query = `
      SELECT id, institution_name, program_name, level, topics, structure, created_at
      FROM competitor_programs
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);

    return result.rows.map((row) => ({
      id: row.id,
      institutionName: row.institution_name,
      programName: row.program_name,
      level: row.level,
      topics: row.topics,
      structure: row.structure,
      createdAt: row.created_at,
    }));
  }

  /**
   * Get competitor program by ID
   */
  async getCompetitorProgramById(id: string): Promise<CompetitorProgram | null> {
    const query = `
      SELECT id, institution_name, program_name, level, topics, structure, created_at
      FROM competitor_programs
      WHERE id = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      institutionName: row.institution_name,
      programName: row.program_name,
      level: row.level,
      topics: row.topics,
      structure: row.structure,
      createdAt: row.created_at,
    };
  }

  /**
   * Delete competitor program
   */
  async deleteCompetitorProgram(id: string): Promise<void> {
    const query = 'DELETE FROM competitor_programs WHERE id = $1';
    await pool.query(query, [id]);
  }

  /**
   * Compare generated curriculum against all competitor programs
   * Requirements: 7.2, 7.3, 7.4, 7.5
   */
  async compareCurriculum(
    programId: string,
    programSpec: ProgramSpecification,
    unitSpecs: UnitSpecification[]
  ): Promise<BenchmarkReport> {
    // Get all competitor programs
    const competitors = await this.getAllCompetitorPrograms();

    if (competitors.length === 0) {
      return {
        programId,
        generatedAt: new Date(),
        comparisons: [],
        overallSimilarity: 0,
        gaps: [],
        strengths: [],
        recommendations: ['No competitor programs available for comparison'],
        summary: 'No competitor data available for benchmarking',
      };
    }

    // Extract topics from generated curriculum
    const generatedTopics = this.extractTopicsFromCurriculum(programSpec, unitSpecs);

    // Perform comparisons with each competitor
    const comparisons: InstitutionComparison[] = [];
    const allGaps: Gap[] = [];
    const allStrengths: Strength[] = [];

    for (const competitor of competitors) {
      const comparison = await this.compareWithCompetitor(
        generatedTopics,
        programSpec,
        unitSpecs,
        competitor
      );

      comparisons.push(comparison.institutionComparison);
      allGaps.push(...comparison.gaps);
      allStrengths.push(...comparison.strengths);
    }

    // Calculate overall similarity
    const overallSimilarity =
      comparisons.reduce((sum, c) => sum + c.similarityScore, 0) / comparisons.length;

    // Generate recommendations
    const recommendations = this.generateRecommendations(allGaps, allStrengths);

    // Generate summary
    const summary = this.generateSummary(comparisons, allGaps, allStrengths);

    return {
      programId,
      generatedAt: new Date(),
      comparisons,
      overallSimilarity: Math.round(overallSimilarity),
      gaps: allGaps,
      strengths: allStrengths,
      recommendations,
      summary,
    };
  }

  /**
   * Extract topics from generated curriculum
   */
  private extractTopicsFromCurriculum(
    programSpec: ProgramSpecification,
    unitSpecs: UnitSpecification[]
  ): string[] {
    const topics = new Set<string>();

    // Extract from unit specs
    for (const unit of unitSpecs) {
      // Add unit title as a topic
      topics.add(unit.unitTitle);

      // Extract topics from indicative content
      if (unit.indicativeContent) {
        const contentTopics = unit.indicativeContent
          .split(/[,;.\n]/)
          .map((t) => t.trim())
          .filter((t) => t.length > 3);
        contentTopics.forEach((t) => topics.add(t));
      }
    }

    return Array.from(topics);
  }

  /**
   * Compare generated curriculum with a single competitor
   * Requirements: 7.2, 7.3, 7.4
   */
  private async compareWithCompetitor(
    generatedTopics: string[],
    programSpec: ProgramSpecification,
    unitSpecs: UnitSpecification[],
    competitor: CompetitorProgram
  ): Promise<{
    institutionComparison: InstitutionComparison;
    gaps: Gap[];
    strengths: Strength[];
  }> {
    // Calculate topic similarity using semantic comparison
    const topicSimilarity = await this.calculateTopicSimilarity(
      generatedTopics,
      competitor.topics
    );

    // Calculate assessment alignment
    const assessmentAlignment = this.calculateAssessmentAlignment(
      unitSpecs,
      competitor.structure
    );

    // Calculate structure alignment
    const structureAlignment = await this.calculateStructureAlignment(
      programSpec,
      unitSpecs,
      competitor.structure
    );

    // Calculate overall similarity score
    const similarityScore = Math.round(
      topicSimilarity * 0.5 + assessmentAlignment * 0.25 + structureAlignment * 0.25
    );

    // Identify gaps
    const gaps = await this.identifyGaps(
      generatedTopics,
      competitor.topics,
      competitor.institutionName
    );

    // Identify strengths
    const strengths = await this.identifyStrengths(
      generatedTopics,
      competitor.topics,
      unitSpecs,
      competitor.structure
    );

    return {
      institutionComparison: {
        institutionName: competitor.institutionName,
        programName: competitor.programName,
        similarityScore,
        topicCoverage: Math.round(topicSimilarity),
        assessmentAlignment: Math.round(assessmentAlignment),
        structureAlignment: Math.round(structureAlignment),
      },
      gaps,
      strengths,
    };
  }

  /**
   * Calculate topic similarity using semantic comparison
   * Requirement 7.2: Calculate similarity scores using semantic comparison
   */
  private async calculateTopicSimilarity(
    generatedTopics: string[],
    competitorTopics: any[]
  ): Promise<number> {
    if (competitorTopics.length === 0) {
      return 0;
    }

    const competitorTopicNames = competitorTopics.map((t) =>
      typeof t === 'string' ? t : t.name
    );

    // Generate embeddings for both sets of topics
    const generatedEmbeddings = await Promise.all(
      generatedTopics.map((topic) => embeddingService.generateQueryEmbedding(topic))
    );

    const competitorEmbeddings = await Promise.all(
      competitorTopicNames.map((topic) => embeddingService.generateQueryEmbedding(topic))
    );

    // Calculate similarity for each generated topic
    let totalSimilarity = 0;
    let matchCount = 0;

    for (const genEmbed of generatedEmbeddings) {
      let maxSimilarity = 0;

      for (const compEmbed of competitorEmbeddings) {
        const similarity = this.cosineSimilarity(genEmbed, compEmbed);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // Consider it a match if similarity > 0.7
      if (maxSimilarity > 0.7) {
        matchCount++;
        totalSimilarity += maxSimilarity;
      }
    }

    // Calculate coverage percentage
    const coverage = (matchCount / generatedTopics.length) * 100;

    return coverage;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Calculate assessment alignment
   * Requirement 7.2: Compare assessment alignment
   */
  private calculateAssessmentAlignment(
    unitSpecs: UnitSpecification[],
    competitorStructure: any
  ): number {
    if (!competitorStructure.assessmentTypes || competitorStructure.assessmentTypes.length === 0) {
      return 50; // Default score if no competitor assessment data
    }

    // Extract assessment types from unit specs
    const generatedAssessmentTypes = new Set<string>();
    for (const unit of unitSpecs) {
      if (unit.assessmentMethods) {
        unit.assessmentMethods.forEach((method) => {
          generatedAssessmentTypes.add(method.toLowerCase());
        });
      }
    }

    // Compare with competitor assessment types
    const competitorTypes = competitorStructure.assessmentTypes.map((t: string) =>
      t.toLowerCase()
    );

    let matchCount = 0;
    for (const compType of competitorTypes) {
      for (const genType of generatedAssessmentTypes) {
        if (genType.includes(compType) || compType.includes(genType)) {
          matchCount++;
          break;
        }
      }
    }

    const alignment = (matchCount / competitorTypes.length) * 100;
    return Math.min(alignment, 100);
  }

  /**
   * Calculate structure alignment
   * Requirement 7.2: Compare structure
   */
  private async calculateStructureAlignment(
    programSpec: ProgramSpecification,
    unitSpecs: UnitSpecification[],
    competitorStructure: any
  ): Promise<number> {
    let alignmentScore = 0;
    let factors = 0;

    // Compare total hours - fetch from database
    if (competitorStructure.totalHours) {
      try {
        const query = `
          SELECT COALESCE(SUM(hours), 0) as total_hours
          FROM modules
          WHERE program_id = $1
        `;
        const result = await pool.query(query, [programSpec.programId]);
        const generatedHours = result.rows[0]?.total_hours || 120; // Default to 120 if not found
        
        const hoursDiff = Math.abs(generatedHours - competitorStructure.totalHours);
        const hoursAlignment = Math.max(0, 100 - (hoursDiff / competitorStructure.totalHours) * 100);
        alignmentScore += hoursAlignment;
        factors++;
      } catch (error) {
        console.error('Error fetching module hours:', error);
        // Use default alignment if query fails
        alignmentScore += 50;
        factors++;
      }
    }

    // Compare number of modules
    if (competitorStructure.modules && competitorStructure.modules.length > 0) {
      const generatedModuleCount = unitSpecs.length;
      const competitorModuleCount = competitorStructure.modules.length;
      const moduleDiff = Math.abs(generatedModuleCount - competitorModuleCount);
      const moduleAlignment = Math.max(0, 100 - (moduleDiff / competitorModuleCount) * 50);
      alignmentScore += moduleAlignment;
      factors++;
    }

    return factors > 0 ? alignmentScore / factors : 50;
  }

  /**
   * Identify content gaps
   * Requirement 7.3: Identify content gaps
   */
  private async identifyGaps(
    generatedTopics: string[],
    competitorTopics: any[],
    institutionName: string
  ): Promise<Gap[]> {
    const gaps: Gap[] = [];

    const competitorTopicNames = competitorTopics.map((t) =>
      typeof t === 'string' ? t : t.name
    );

    // Generate embeddings
    const generatedEmbeddings = await Promise.all(
      generatedTopics.map((topic) => embeddingService.generateQueryEmbedding(topic))
    );

    const competitorEmbeddings = await Promise.all(
      competitorTopicNames.map((topic) => embeddingService.generateQueryEmbedding(topic))
    );

    // Find competitor topics not covered in generated curriculum
    for (let i = 0; i < competitorTopicNames.length; i++) {
      const compTopic = competitorTopicNames[i];
      const compEmbed = competitorEmbeddings[i];

      let maxSimilarity = 0;
      for (const genEmbed of generatedEmbeddings) {
        const similarity = this.cosineSimilarity(compEmbed, genEmbed);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // If similarity is low, it's a gap
      if (maxSimilarity < 0.6) {
        const severity = maxSimilarity < 0.3 ? 'high' : maxSimilarity < 0.5 ? 'medium' : 'low';

        gaps.push({
          type: 'topic',
          description: `Topic "${compTopic}" is covered by ${institutionName} but not adequately addressed in the generated curriculum`,
          competitorInstitution: institutionName,
          severity,
          recommendation: `Consider adding content on "${compTopic}" to improve curriculum comprehensiveness`,
        });
      }
    }

    return gaps;
  }

  /**
   * Identify strengths
   * Requirement 7.4: Identify strengths
   */
  private async identifyStrengths(
    generatedTopics: string[],
    competitorTopics: any[],
    unitSpecs: UnitSpecification[],
    competitorStructure: any
  ): Promise<Strength[]> {
    const strengths: Strength[] = [];

    const competitorTopicNames = competitorTopics.map((t) =>
      typeof t === 'string' ? t : t.name
    );

    // Generate embeddings
    const generatedEmbeddings = await Promise.all(
      generatedTopics.map((topic) => embeddingService.generateQueryEmbedding(topic))
    );

    const competitorEmbeddings = await Promise.all(
      competitorTopicNames.map((topic) => embeddingService.generateQueryEmbedding(topic))
    );

    // Find generated topics not covered by competitor
    for (let i = 0; i < generatedTopics.length; i++) {
      const genTopic = generatedTopics[i];
      const genEmbed = generatedEmbeddings[i];

      let maxSimilarity = 0;
      for (const compEmbed of competitorEmbeddings) {
        const similarity = this.cosineSimilarity(genEmbed, compEmbed);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // If similarity is low, it's a unique strength
      if (maxSimilarity < 0.5) {
        strengths.push({
          type: 'topic',
          description: `Unique topic: "${genTopic}"`,
          advantage: `This topic provides additional coverage not found in competitor programs`,
        });
      }
    }

    // Check for more comprehensive assessment methods
    const generatedAssessmentTypes = new Set<string>();
    for (const unit of unitSpecs) {
      if (unit.assessmentMethods) {
        unit.assessmentMethods.forEach((method) => generatedAssessmentTypes.add(method));
      }
    }

    if (
      competitorStructure.assessmentTypes &&
      generatedAssessmentTypes.size > competitorStructure.assessmentTypes.length
    ) {
      strengths.push({
        type: 'assessment',
        description: 'More diverse assessment methods',
        advantage: `Curriculum includes ${generatedAssessmentTypes.size} assessment types compared to competitor's ${competitorStructure.assessmentTypes.length}`,
      });
    }

    return strengths;
  }

  /**
   * Generate actionable recommendations
   * Requirement 7.5: Generate actionable improvement recommendations
   */
  private generateRecommendations(gaps: Gap[], strengths: Strength[]): string[] {
    const recommendations: string[] = [];

    // Group gaps by severity
    const highSeverityGaps = gaps.filter((g) => g.severity === 'high');
    const mediumSeverityGaps = gaps.filter((g) => g.severity === 'medium');

    // Recommendations based on high severity gaps
    if (highSeverityGaps.length > 0) {
      recommendations.push(
        `Priority: Address ${highSeverityGaps.length} high-severity content gaps to ensure curriculum competitiveness`
      );

      // Add specific recommendations for top gaps
      highSeverityGaps.slice(0, 3).forEach((gap) => {
        recommendations.push(gap.recommendation);
      });
    }

    // Recommendations based on medium severity gaps
    if (mediumSeverityGaps.length > 0) {
      recommendations.push(
        `Consider addressing ${mediumSeverityGaps.length} medium-severity gaps to enhance curriculum depth`
      );
    }

    // Recommendations based on strengths
    if (strengths.length > 0) {
      recommendations.push(
        `Leverage ${strengths.length} unique strengths in marketing materials to differentiate from competitors`
      );
    }

    // General recommendations
    if (gaps.length === 0) {
      recommendations.push(
        'Curriculum demonstrates excellent coverage compared to competitors. Continue monitoring industry trends.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Curriculum is well-aligned with competitor offerings');
    }

    return recommendations;
  }

  /**
   * Generate summary
   * Requirement 7.5: Generate comparison reports
   */
  private generateSummary(
    comparisons: InstitutionComparison[],
    gaps: Gap[],
    strengths: Strength[]
  ): string {
    const avgSimilarity =
      comparisons.reduce((sum, c) => sum + c.similarityScore, 0) / comparisons.length;

    let summary = `Benchmarking analysis compared the generated curriculum against ${comparisons.length} competitor institution(s). `;

    summary += `The overall similarity score is ${Math.round(avgSimilarity)}%, indicating `;

    if (avgSimilarity >= 80) {
      summary += 'strong alignment with industry standards. ';
    } else if (avgSimilarity >= 60) {
      summary += 'moderate alignment with opportunities for enhancement. ';
    } else {
      summary += 'significant opportunities for improvement to match competitor offerings. ';
    }

    summary += `Analysis identified ${gaps.length} content gap(s) and ${strengths.length} unique strength(s). `;

    const highSeverityGaps = gaps.filter((g) => g.severity === 'high').length;
    if (highSeverityGaps > 0) {
      summary += `${highSeverityGaps} high-priority gap(s) require immediate attention. `;
    }

    return summary;
  }
}

export const benchmarkingService = new BenchmarkingService();
