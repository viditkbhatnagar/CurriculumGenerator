import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from 'docx';
import { loggingService } from './loggingService';

export class DocxGenerationService {
  /**
   * Generate a comprehensive Word document from curriculum package
   */
  async generateCurriculumDocument(fullPackage: any): Promise<Buffer> {
    try {
      const sections = [];

      // Title Page
      sections.push(
        new Paragraph({
          text: 'Full Curriculum Package',
          heading: HeadingLevel.TITLE,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          text: `Generated on: ${new Date().toLocaleDateString()}`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        new Paragraph({
          text: `AGI Compliance Score: ${fullPackage.agiCompliance?.complianceScore || 0}%`,
          alignment: AlignmentType.CENTER,
          spacing: { after: 800 },
        })
      );

      // Table of Contents placeholder
      sections.push(
        new Paragraph({
          text: 'Table of Contents',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          text: '1. Module Plans',
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: '2. Case Studies',
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: '3. Interactive Simulations',
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: '4. Assessment Bank',
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: '5. Grading Rubrics',
          spacing: { after: 100 },
        }),
        new Paragraph({
          text: '6. Slide Decks',
          spacing: { after: 400 },
        })
      );

      // 1. Module Plans
      sections.push(
        new Paragraph({
          text: '1. Module Plans',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: true,
        })
      );

      for (const module of fullPackage.modulePlans || []) {
        sections.push(
          new Paragraph({
            text: `${module.moduleCode}: ${module.moduleTitle}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          })
        );

        // Week by Week breakdown
        if (module.weekByWeek && module.weekByWeek.length > 0) {
          sections.push(
            new Paragraph({
              text: 'Weekly Breakdown:',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            })
          );

          for (const week of module.weekByWeek) {
            sections.push(
              new Paragraph({
                children: [new TextRun({ text: `Week ${week.week}`, bold: true })],
                spacing: { before: 150, after: 50 },
              }),
              new Paragraph({
                text: `Topics: ${week.topics?.join(', ') || 'N/A'}`,
                spacing: { after: 50 },
              }),
              new Paragraph({
                text: `Activities: ${week.activities?.join('; ') || 'N/A'}`,
                spacing: { after: 50 },
              }),
              new Paragraph({
                text: `Assessments: ${week.assessments?.join('; ') || 'N/A'}`,
                spacing: { after: 50 },
              }),
              new Paragraph({
                text: `Estimated Hours: ${week.estimatedHours || 0}`,
                spacing: { after: 100 },
              })
            );
          }
        }

        // Assessment Schedule
        if (module.assessmentSchedule && module.assessmentSchedule.length > 0) {
          sections.push(
            new Paragraph({
              text: 'Assessment Schedule:',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            })
          );

          for (const assessment of module.assessmentSchedule) {
            sections.push(
              new Paragraph({
                text: `• ${assessment.type} - Week ${assessment.dueWeek} (${assessment.weight}%)`,
                spacing: { after: 50 },
              })
            );
          }
        }
      }

      // 2. Case Studies
      sections.push(
        new Paragraph({
          text: '2. Case Studies',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: true,
        })
      );

      for (const caseStudy of fullPackage.caseStudies || []) {
        sections.push(
          new Paragraph({
            text: caseStudy.title || 'Untitled Case Study',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          }),
          new Paragraph({
            text: caseStudy.scenarioDescription || '',
            spacing: { after: 200 },
          })
        );

        if (caseStudy.discussionQuestions && caseStudy.discussionQuestions.length > 0) {
          sections.push(
            new Paragraph({
              text: 'Discussion Questions:',
              heading: HeadingLevel.HEADING_3,
              spacing: { before: 200, after: 100 },
            })
          );

          caseStudy.discussionQuestions.forEach((q: string, i: number) => {
            sections.push(
              new Paragraph({
                text: `${i + 1}. ${q}`,
                spacing: { after: 50 },
              })
            );
          });
        }
      }

      // 3. Simulations
      sections.push(
        new Paragraph({
          text: '3. Interactive Simulations',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: true,
        })
      );

      for (const simulation of fullPackage.simulations || []) {
        sections.push(
          new Paragraph({
            text: simulation.title || 'Untitled Simulation',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          }),
          new Paragraph({
            text: simulation.description || '',
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `Learning Objectives: ${simulation.learningObjectives?.join(', ') || 'N/A'}`,
            spacing: { after: 100 },
          }),
          new Paragraph({
            text: `Duration: ${simulation.estimatedDuration || 'N/A'} minutes`,
            spacing: { after: 200 },
          })
        );
      }

      // 4. Assessment Bank
      sections.push(
        new Paragraph({
          text: '4. Assessment Bank',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: true,
        })
      );

      for (const mcq of fullPackage.mcqExams || []) {
        sections.push(
          new Paragraph({
            text: mcq.questionText || '',
            heading: HeadingLevel.HEADING_3,
            spacing: { before: 200, after: 100 },
          })
        );

        if (mcq.options && Array.isArray(mcq.options)) {
          mcq.options.forEach((option: string, i: number) => {
            const letter = String.fromCharCode(65 + i); // A, B, C, D
            const isCorrect = mcq.correctAnswer === letter;
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${letter}. ${option}`,
                    bold: isCorrect,
                  }),
                  ...(isCorrect ? [new TextRun({ text: ' ✓', bold: true, color: '00AA00' })] : []),
                ],
                spacing: { after: 50 },
              })
            );
          });
        }

        if (mcq.explanation) {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Explanation: ', bold: true }),
                new TextRun({ text: mcq.explanation }),
              ],
              spacing: { before: 100, after: 200 },
            })
          );
        }
      }

      // 5. Grading Rubrics
      sections.push(
        new Paragraph({
          text: '5. Grading Rubrics',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: true,
        })
      );

      // Extract rubrics from case studies
      for (const caseStudy of fullPackage.caseStudies || []) {
        if (caseStudy.rubric && caseStudy.rubric.levels) {
          sections.push(
            new Paragraph({
              text: `Rubric for: ${caseStudy.title}`,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 },
            })
          );

          for (const level of caseStudy.rubric.levels) {
            sections.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${level.level}: `, bold: true }),
                  new TextRun({ text: `${level.marks} marks` }),
                ],
                spacing: { after: 50 },
              }),
              new Paragraph({
                text: level.descriptor || '',
                spacing: { after: 150 },
              })
            );
          }
        }
      }

      // 6. Slide Decks
      sections.push(
        new Paragraph({
          text: '6. Slide Decks',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
          pageBreakBefore: true,
        })
      );

      for (const deck of fullPackage.slideDecks || []) {
        sections.push(
          new Paragraph({
            text: deck.title || 'Untitled Deck',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 200 },
          }),
          new Paragraph({
            text: `Module: ${deck.moduleCode}`,
            spacing: { after: 50 },
          }),
          new Paragraph({
            text: `Slides: ${deck.slideCount || 0}`,
            spacing: { after: 200 },
          })
        );
      }

      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {},
            children: sections,
          },
        ],
      });

      // Generate buffer
      const buffer = await Packer.toBuffer(doc);
      return buffer;
    } catch (error) {
      loggingService.error('Error generating DOCX document', { error });
      throw error;
    }
  }
}

export const docxGenerationService = new DocxGenerationService();
