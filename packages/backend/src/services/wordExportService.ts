import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
} from 'docx';
import OpenAI from 'openai';
import { loggingService } from './loggingService';

interface WorkflowData {
  projectName: string;
  step1?: any;
  step2?: any;
  step3?: any;
  step4?: any;
  step5?: any;
  step6?: any;
  step7?: any;
  step8?: any;
  step9?: any;
  step10?: any;
  createdAt?: string;
  updatedAt?: string;
}

// Progress callback for real-time updates
export interface DocumentGenerationProgress {
  stage: string;
  currentSection: string;
  sectionsCompleted: number;
  totalSections: number;
  message: string;
}

export type ProgressCallback = (progress: DocumentGenerationProgress) => void;

// Font specifications - Arial throughout
const FONT_FAMILY = 'Arial';
const FONT_SIZES = {
  H1: 32, // 16pt in half-points
  H2: 28, // 14pt
  H3: 24, // 12pt
  BODY: 22, // 11pt
  TABLE: 21, // 10.5pt
};

// Line spacing: 1.15
const LINE_SPACING = 276; // 240 * 1.15

// Paragraph spacing: 6pt before and after
const PARA_SPACING = {
  before: 120, // 6pt in twentieths of a point
  after: 120,
};

export class WordExportService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Intelligently format text using OpenAI
   * - Breaks long paragraphs into 4-7 line chunks
   * - Detects and converts appropriate content to bullet lists
   * - Removes duplicates and improves readability
   */
  private async formatTextIntelligently(
    text: string,
    context: string
  ): Promise<{ paragraphs: string[]; bullets: string[] }> {
    if (!text || text.trim().length === 0) {
      return { paragraphs: [], bullets: [] };
    }

    try {
      const prompt = `You are formatting curriculum content for a professional academic document.

Context: ${context}

Content to format:
${text}

Rules:
1. Break long blocks of text into logical academic paragraphs (4-7 lines each)
2. Identify content that should be bullet points (lists, competencies, aims, pathways, etc.)
3. Remove duplicate sentences
4. Maintain academic tone and meaning
5. DO NOT add new content

Return ONLY a JSON object with this structure:
{
  "paragraphs": ["paragraph 1", "paragraph 2", ...],
  "bullets": ["bullet 1", "bullet 2", ...] or []
}

If the content is better as paragraphs, put it all in paragraphs array and leave bullets empty.
If the content is better as bullets, put it in bullets array and leave paragraphs empty.`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a curriculum formatting expert. Return only valid JSON, no markdown formatting.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content);
      return {
        paragraphs: result.paragraphs || [],
        bullets: result.bullets || [],
      };
    } catch (error) {
      // Fallback: return original text as single paragraph
      loggingService.error('OpenAI formatting failed, using fallback', { error, context });
      return {
        paragraphs: [text],
        bullets: [],
      };
    }
  }

  /**
   * Create formatted paragraphs with Times New Roman font and proper spacing
   */
  private createFormattedParagraphs(
    texts: string[],
    options: { isBullet?: boolean; size?: number; isNumbered?: boolean } = {}
  ): Paragraph[] {
    const size = options.size || FONT_SIZES.BODY;
    return texts.map(
      (text, index) =>
        new Paragraph({
          children: [
            new TextRun({
              text: options.isBullet
                ? `• ${text}`
                : options.isNumbered
                  ? `${index + 1}. ${text}`
                  : text,
              font: FONT_FAMILY,
              size,
            }),
          ],
          spacing: {
            line: LINE_SPACING,
            ...PARA_SPACING,
          },
        })
    );
  }

  /**
   * Create table cell with Arial font
   */
  private createTableCell(
    text: string,
    options: { bold?: boolean; shading?: string; width?: number } = {}
  ): TableCell {
    return new TableCell({
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text,
              bold: options.bold ?? false,
              size: FONT_SIZES.TABLE,
              font: FONT_FAMILY,
            }),
          ],
          spacing: {
            line: LINE_SPACING,
          },
        }),
      ],
      shading: options.shading ? { fill: options.shading } : undefined,
      width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    });
  }

  /**
   * Build a KSC lookup map from Step 2 data for Step 4 references
   */
  private buildKSCMap(step2: any): Map<string, string> {
    const kscMap = new Map<string, string>();

    if (step2.knowledgeItems) {
      step2.knowledgeItems.forEach((item: any) => {
        if (item.id) {
          kscMap.set(item.id, item.statement || item.description || item.title || '');
        }
      });
    }

    if (step2.skillItems) {
      step2.skillItems.forEach((item: any) => {
        if (item.id) {
          kscMap.set(item.id, item.statement || item.description || item.title || '');
        }
      });
    }

    if (step2.competencyItems) {
      step2.competencyItems.forEach((item: any) => {
        if (item.id) {
          kscMap.set(item.id, item.statement || item.description || item.title || '');
        }
      });
    }

    // Also check for attitudeItems as fallback
    if (step2.attitudeItems) {
      step2.attitudeItems.forEach((item: any) => {
        if (item.id) {
          kscMap.set(item.id, item.statement || item.description || item.title || '');
        }
      });
    }

    return kscMap;
  }

  /**
   * Create H1 heading - Arial 16pt Bold
   */
  private createH1(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: FONT_SIZES.H1,
          font: FONT_FAMILY,
        }),
      ],
      spacing: {
        before: 400,
        after: 200,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Create H2 heading - Arial 14pt Bold
   */
  private createH2(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: FONT_SIZES.H2,
          font: FONT_FAMILY,
        }),
      ],
      spacing: {
        before: 200,
        after: 100,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Create H3 heading - Arial 12pt Bold
   */
  private createH3(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: FONT_SIZES.H3,
          font: FONT_FAMILY,
        }),
      ],
      spacing: {
        before: 150,
        after: 80,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Generate Step 10 (Lesson Plans) section
   */
  private async generateStep10Section(step10: any, contentChildren: any[]): Promise<void> {
    if (!step10) return;

    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      this.createH1('10. Lesson Plans & PPT Generation')
    );

    // Validation Summary
    if (step10.validation) {
      contentChildren.push(this.createH2('10.1 Validation Summary'));

      const validationRows = [
        new TableRow({
          children: [
            this.createTableCell('Validation Check', { bold: true, shading: 'e2e8f0' }),
            this.createTableCell('Status', { bold: true, shading: 'e2e8f0' }),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All Modules Have Lesson Plans'),
            this.createTableCell(step10.validation.allModulesHaveLessonPlans ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All Lesson Durations Valid (60-180 min)'),
            this.createTableCell(step10.validation.allLessonDurationsValid ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Hours Match Module Contact Hours'),
            this.createTableCell(step10.validation.totalHoursMatch ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All MLOs Covered'),
            this.createTableCell(step10.validation.allMLOsCovered ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Case Studies Integrated'),
            this.createTableCell(step10.validation.caseStudiesIntegrated ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Assessments Integrated'),
            this.createTableCell(step10.validation.assessmentsIntegrated ? '✓ Pass' : '✗ Fail'),
          ],
        }),
      ];

      contentChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: validationRows,
        }),
        new Paragraph({ children: [], spacing: { after: 300 } })
      );
    }

    // Summary Statistics
    if (step10.summary) {
      contentChildren.push(this.createH2('10.2 Summary Statistics'));

      const summaryRows = [
        new TableRow({
          children: [
            this.createTableCell('Metric', { bold: true, shading: 'e2e8f0' }),
            this.createTableCell('Value', { bold: true, shading: 'e2e8f0' }),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Lessons'),
            this.createTableCell(String(step10.summary.totalLessons || 0)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Contact Hours'),
            this.createTableCell(String(step10.summary.totalContactHours || 0)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Average Lesson Duration (minutes)'),
            this.createTableCell(String(Math.round(step10.summary.averageLessonDuration || 0))),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Case Studies Included'),
            this.createTableCell(String(step10.summary.caseStudiesIncluded || 0)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Formative Checks Included'),
            this.createTableCell(String(step10.summary.formativeChecksIncluded || 0)),
          ],
        }),
      ];

      contentChildren.push(
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: summaryRows,
        }),
        new Paragraph({ children: [], spacing: { after: 300 } })
      );
    }

    // Module Lesson Plans
    if (step10.moduleLessonPlans?.length) {
      contentChildren.push(this.createH2('10.3 Module Lesson Plans'));

      for (const modulePlan of step10.moduleLessonPlans) {
        // Module header
        contentChildren.push(
          this.createH3(`${modulePlan.moduleCode}: ${modulePlan.moduleTitle || 'Untitled Module'}`),
          new Paragraph({
            children: [
              new TextRun({
                text: `Total Contact Hours: ${modulePlan.totalContactHours || 0} | Total Lessons: ${modulePlan.totalLessons || 0}`,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
                italics: true,
                color: '4a5568',
              }),
            ],
            spacing: { after: 150, line: LINE_SPACING },
          })
        );

        // Lessons for this module
        if (modulePlan.lessons?.length) {
          for (const lesson of modulePlan.lessons) {
            // Lesson title and metadata
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Lesson ${lesson.lessonNumber}: ${lesson.lessonTitle || 'Untitled Lesson'}`,
                    bold: true,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { before: 150, after: 80, line: LINE_SPACING },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Duration: ${lesson.duration} minutes | Bloom Level: ${lesson.bloomLevel || 'N/A'}`,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                    italics: true,
                    color: '4a5568',
                  }),
                ],
                spacing: { after: 80, line: LINE_SPACING },
              })
            );

            // Linked MLOs and PLOs
            if (lesson.linkedMLOs?.length || lesson.linkedPLOs?.length) {
              const mloText = lesson.linkedMLOs?.length
                ? `MLOs: ${lesson.linkedMLOs.join(', ')}`
                : '';
              const ploText = lesson.linkedPLOs?.length
                ? `PLOs: ${lesson.linkedPLOs.join(', ')}`
                : '';
              const alignmentText = [mloText, ploText].filter(Boolean).join(' | ');

              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: alignmentText,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                      italics: true,
                    }),
                  ],
                  spacing: { after: 100, line: LINE_SPACING },
                })
              );
            }

            // Learning Objectives
            if (lesson.objectives?.length) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Learning Objectives:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 80, after: 50, line: LINE_SPACING },
                })
              );
              contentChildren.push(
                ...this.createFormattedParagraphs(lesson.objectives, { isBullet: true })
              );
            }

            // Activity Sequence
            if (lesson.activities?.length) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Activity Sequence:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                })
              );

              const activityRows = [
                new TableRow({
                  children: [
                    this.createTableCell('#', { bold: true, shading: 'e2e8f0', width: 5 }),
                    this.createTableCell('Activity', { bold: true, shading: 'e2e8f0', width: 30 }),
                    this.createTableCell('Type', { bold: true, shading: 'e2e8f0', width: 15 }),
                    this.createTableCell('Duration', {
                      bold: true,
                      shading: 'e2e8f0',
                      width: 10,
                    }),
                    this.createTableCell('Description', {
                      bold: true,
                      shading: 'e2e8f0',
                      width: 40,
                    }),
                  ],
                }),
              ];

              lesson.activities.forEach((activity: any) => {
                activityRows.push(
                  new TableRow({
                    children: [
                      this.createTableCell(String(activity.sequenceOrder || '')),
                      this.createTableCell(activity.title || '-'),
                      this.createTableCell(activity.type || '-'),
                      this.createTableCell(`${activity.duration || 0} min`),
                      this.createTableCell(activity.description || '-'),
                    ],
                  })
                );
              });

              contentChildren.push(
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: activityRows,
                }),
                new Paragraph({ children: [], spacing: { after: 100 } })
              );
            }

            // Materials List
            if (lesson.materials) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Required Materials:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                })
              );

              const materials: string[] = [];
              if (lesson.materials.pptDeckRef) {
                materials.push(`PPT Deck: ${lesson.materials.pptDeckRef}`);
              }
              if (lesson.materials.caseFiles?.length) {
                materials.push(`Case Files: ${lesson.materials.caseFiles.join(', ')}`);
              }
              if (lesson.materials.readingReferences?.length) {
                lesson.materials.readingReferences.forEach((ref: any) => {
                  materials.push(`Reading: ${ref.citation} (${ref.estimatedMinutes || 0} min)`);
                });
              }

              if (materials.length > 0) {
                contentChildren.push(
                  ...this.createFormattedParagraphs(materials, { isBullet: true })
                );
              }
            }

            // Instructor Notes
            if (lesson.instructorNotes) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Instructor Notes:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                })
              );

              if (lesson.instructorNotes.pedagogicalGuidance) {
                const formatted = await this.formatTextIntelligently(
                  lesson.instructorNotes.pedagogicalGuidance,
                  'Pedagogical Guidance'
                );
                if (formatted.paragraphs.length > 0) {
                  contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
                }
              }

              if (lesson.instructorNotes.adaptationOptions?.length) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Adaptation Options:',
                        bold: true,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { before: 80, after: 40, line: LINE_SPACING },
                  }),
                  ...this.createFormattedParagraphs(lesson.instructorNotes.adaptationOptions, {
                    isBullet: true,
                  })
                );
              }
            }

            // Case Study Activity (if present)
            if (lesson.caseStudyActivity) {
              const caseStudy = lesson.caseStudyActivity;
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Case Study: ${caseStudy.caseTitle}`,
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Type: ${caseStudy.activityType} | Duration: ${caseStudy.duration} min`,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                      italics: true,
                    }),
                  ],
                  spacing: { after: 80, line: LINE_SPACING },
                })
              );

              if (caseStudy.learningPurpose) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Purpose: ${caseStudy.learningPurpose}`,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { after: 80, line: LINE_SPACING },
                  })
                );
              }
            }

            // Independent Study
            if (lesson.independentStudy) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Independent Study (${lesson.independentStudy.estimatedEffort || 0} minutes):`,
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                })
              );

              if (lesson.independentStudy.coreReadings?.length) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Core Readings:',
                        bold: true,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { before: 60, after: 40, line: LINE_SPACING },
                  })
                );

                const coreReadings = lesson.independentStudy.coreReadings.map(
                  (reading: any) =>
                    `${reading.citation} (${reading.estimatedMinutes || 0} min, ${reading.complexityLevel || 'N/A'})`
                );
                contentChildren.push(
                  ...this.createFormattedParagraphs(coreReadings, { isBullet: true })
                );
              }

              if (lesson.independentStudy.supplementaryReadings?.length) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Supplementary Readings:',
                        bold: true,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { before: 60, after: 40, line: LINE_SPACING },
                  })
                );

                const suppReadings = lesson.independentStudy.supplementaryReadings.map(
                  (reading: any) =>
                    `${reading.citation} (${reading.estimatedMinutes || 0} min, ${reading.complexityLevel || 'N/A'})`
                );
                contentChildren.push(
                  ...this.createFormattedParagraphs(suppReadings, { isBullet: true })
                );
              }
            }

            // Spacing between lessons
            contentChildren.push(
              new Paragraph({
                children: [],
                spacing: { after: 300 },
              })
            );
          }
        }

        // PPT Deck References
        if (modulePlan.pptDecks?.length) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'PowerPoint Decks:',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 150, after: 80, line: LINE_SPACING },
            })
          );

          const pptRows = [
            new TableRow({
              children: [
                this.createTableCell('Lesson', { bold: true, shading: 'e2e8f0', width: 10 }),
                this.createTableCell('Deck ID', { bold: true, shading: 'e2e8f0', width: 30 }),
                this.createTableCell('Slides', { bold: true, shading: 'e2e8f0', width: 10 }),
                this.createTableCell('Formats', { bold: true, shading: 'e2e8f0', width: 50 }),
              ],
            }),
          ];

          modulePlan.pptDecks.forEach((deck: any) => {
            const formats: string[] = [];
            if (deck.pptxPath) formats.push('PPTX');
            if (deck.pdfPath) formats.push('PDF');
            if (deck.imagesPath) formats.push('Images');

            pptRows.push(
              new TableRow({
                children: [
                  this.createTableCell(String(deck.lessonNumber || '-')),
                  this.createTableCell(deck.deckId || '-'),
                  this.createTableCell(String(deck.slideCount || 0)),
                  this.createTableCell(formats.join(', ') || 'Not exported'),
                ],
              })
            );
          });

          contentChildren.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: pptRows,
            }),
            new Paragraph({ children: [], spacing: { after: 300 } })
          );
        }

        // Spacing between modules
        contentChildren.push(
          new Paragraph({
            children: [],
            spacing: { after: 400 },
          })
        );
      }
    }
  }

  /**
   * Generate the complete Word document with intelligent formatting and progress tracking
   */
  async generateDocument(
    workflow: WorkflowData,
    progressCallback?: ProgressCallback
  ): Promise<Buffer> {
    const sections: any[] = [];
    const step1 = workflow.step1 || {};

    // Build KSC lookup map from Step 2 for later use in Step 4
    const kscMap = workflow.step2 ? this.buildKSCMap(workflow.step2) : new Map<string, string>();

    // Count total sections for progress tracking
    const totalSections = [
      workflow.step1,
      workflow.step2,
      workflow.step3,
      workflow.step4,
      workflow.step5,
      workflow.step6,
      workflow.step7,
      workflow.step8,
      workflow.step9,
      workflow.step10,
    ].filter(Boolean).length;

    let sectionsCompleted = 0;

    const reportProgress = (currentSection: string, message: string) => {
      if (progressCallback) {
        progressCallback({
          stage: 'formatting',
          currentSection,
          sectionsCompleted,
          totalSections,
          message,
        });
      }
      loggingService.info('[Word Export] Progress', {
        currentSection,
        sectionsCompleted,
        totalSections,
        message,
      });
    };

    reportProgress('Title Page', 'Creating title page...');

    // =========================================================================
    // TITLE PAGE
    // =========================================================================
    sections.push({
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: step1.programTitle || workflow.projectName || 'Curriculum Package',
              bold: true,
              size: 56,
              font: FONT_FAMILY,
              color: '1a365d',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 3000, after: 400 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: 'Curriculum Design Document',
              size: 32,
              font: FONT_FAMILY,
              color: '4a5568',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 1000 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Level: ${step1.academicLevel || 'N/A'}`,
              size: 24,
              font: FONT_FAMILY,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Credits: ${step1.creditFramework?.credits || 'N/A'} | Total Hours: ${step1.creditFramework?.totalHours || 'N/A'}`,
              size: 24,
              font: FONT_FAMILY,
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
              size: 20,
              font: FONT_FAMILY,
              color: '718096',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 2000 },
        }),
      ],
    });

    // Content sections
    const contentChildren: any[] = [];

    // =========================================================================
    // SECTION 1: PROGRAM FOUNDATION
    // =========================================================================
    if (workflow.step1) {
      reportProgress(
        'Step 1: Program Foundation',
        `Formatting program foundation (${sectionsCompleted + 1}/${totalSections})...`
      );

      contentChildren.push(this.createH1('1. Program Foundation'));

      // Program Description with intelligent formatting
      if (step1.programDescription) {
        contentChildren.push(this.createH2('Program Description'));

        const formatted = await this.formatTextIntelligently(
          step1.programDescription,
          'Program Description'
        );

        if (formatted.paragraphs.length > 0) {
          contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
        }
        if (formatted.bullets.length > 0) {
          contentChildren.push(
            ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
          );
        }
      }

      // Executive Summary with intelligent formatting
      if (step1.executiveSummary) {
        contentChildren.push(this.createH2('Executive Summary'));

        const formatted = await this.formatTextIntelligently(
          step1.executiveSummary,
          'Executive Summary'
        );

        if (formatted.paragraphs.length > 0) {
          contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
        }
        if (formatted.bullets.length > 0) {
          contentChildren.push(
            ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
          );
        }
      }

      // Credit Framework Table
      if (step1.creditFramework) {
        contentChildren.push(
          this.createH2('Credit Framework'),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  this.createTableCell('Credit System', { bold: true, shading: 'e2e8f0' }),
                  this.createTableCell('Credits', { bold: true, shading: 'e2e8f0' }),
                  this.createTableCell('Total Hours', { bold: true, shading: 'e2e8f0' }),
                  this.createTableCell('Contact Hours', { bold: true, shading: 'e2e8f0' }),
                  this.createTableCell('Independent Hours', { bold: true, shading: 'e2e8f0' }),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell(
                    String(
                      step1.creditFramework.system || step1.creditFramework.creditSystem || '-'
                    )
                  ),
                  this.createTableCell(String(step1.creditFramework.credits || '-')),
                  this.createTableCell(String(step1.creditFramework.totalHours || '-')),
                  this.createTableCell(String(step1.creditFramework.contactHours || '-')),
                  this.createTableCell(
                    String(
                      step1.creditFramework.independentHours ||
                        step1.creditFramework.selfStudyHours ||
                        '-'
                    )
                  ),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [], spacing: { after: 300 } })
        );
      }

      // Program Aims - intelligent formatting for list
      if (step1.programAims?.length) {
        contentChildren.push(this.createH2('Program Aims'));

        const aimsText = step1.programAims.join('; ');
        const formatted = await this.formatTextIntelligently(aimsText, 'Program Aims List');

        if (formatted.bullets.length > 0) {
          contentChildren.push(
            ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
          );
        } else {
          // Fallback: use numbered list
          contentChildren.push(
            ...this.createFormattedParagraphs(step1.programAims, { isNumbered: true })
          );
        }
      }

      // Entry Requirements
      if (step1.entryRequirements) {
        contentChildren.push(this.createH2('Entry Requirements'));
        const formatted = await this.formatTextIntelligently(
          step1.entryRequirements,
          'Entry Requirements'
        );
        if (formatted.paragraphs.length > 0) {
          contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
        }
        if (formatted.bullets.length > 0) {
          contentChildren.push(
            ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
          );
        }
      }

      // Career Pathways
      if (step1.careerPathways?.length) {
        contentChildren.push(this.createH2('Career Pathways'));
        contentChildren.push(
          ...this.createFormattedParagraphs(step1.careerPathways, { isBullet: true })
        );
      }

      // Job Roles
      if (step1.jobRoles?.length) {
        contentChildren.push(this.createH2('Target Job Roles'));
        const roleTexts = step1.jobRoles.map((role: string | { title: string }) =>
          typeof role === 'string' ? role : role.title
        );
        contentChildren.push(...this.createFormattedParagraphs(roleTexts, { isBullet: true }));
      }

      sectionsCompleted++;
      reportProgress(
        'Step 1: Program Foundation',
        `✓ Step 1 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 2: COMPETENCY FRAMEWORK (KSC)
    // =========================================================================
    if (workflow.step2) {
      reportProgress(
        'Step 2: Competency Framework',
        `Formatting competency framework (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step2 = workflow.step2;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('2. Competency Framework (KSC)')
      );

      // Knowledge Items - in tabular format with detailed descriptions
      if (step2.knowledgeItems?.length) {
        contentChildren.push(this.createH2('Knowledge'));

        const knowledgeRows = [
          new TableRow({
            children: [
              this.createTableCell('ID', { bold: true, shading: 'e2e8f0', width: 15 }),
              this.createTableCell('Statement', { bold: true, shading: 'e2e8f0', width: 85 }),
            ],
          }),
        ];

        step2.knowledgeItems.forEach((item: any) => {
          knowledgeRows.push(
            new TableRow({
              children: [
                this.createTableCell(item.id || '-'),
                this.createTableCell(item.statement || item.description || item.title || '-'),
              ],
            })
          );
        });

        contentChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: knowledgeRows,
          })
        );

        // Add detailed descriptions below table
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Detailed Knowledge Requirements:',
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { before: 200, after: 100, line: LINE_SPACING },
          })
        );

        step2.knowledgeItems.forEach((item: any) => {
          const statement = item.statement || item.description || item.title || '';
          const detailedDesc =
            item.description && item.statement !== item.description ? item.description : statement;

          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${item.id || ''}: `,
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
                new TextRun({
                  text: detailedDesc,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { after: 100, line: LINE_SPACING },
            })
          );
        });
      }

      // Skills Items - in tabular format with detailed descriptions
      if (step2.skillItems?.length) {
        contentChildren.push(this.createH2('Skills'));

        const skillRows = [
          new TableRow({
            children: [
              this.createTableCell('ID', { bold: true, shading: 'e2e8f0', width: 15 }),
              this.createTableCell('Statement', { bold: true, shading: 'e2e8f0', width: 85 }),
            ],
          }),
        ];

        step2.skillItems.forEach((item: any) => {
          skillRows.push(
            new TableRow({
              children: [
                this.createTableCell(item.id || '-'),
                this.createTableCell(item.statement || item.description || item.title || '-'),
              ],
            })
          );
        });

        contentChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: skillRows,
          })
        );

        // Add detailed descriptions below table
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Detailed Skill Requirements:',
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { before: 200, after: 100, line: LINE_SPACING },
          })
        );

        step2.skillItems.forEach((item: any) => {
          const statement = item.statement || item.description || item.title || '';
          const detailedDesc =
            item.description && item.statement !== item.description ? item.description : statement;

          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${item.id || ''}: `,
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
                new TextRun({
                  text: detailedDesc,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { after: 100, line: LINE_SPACING },
            })
          );
        });
      }

      // Competency Items - in tabular format with detailed descriptions
      if (step2.competencyItems?.length) {
        contentChildren.push(this.createH2('Competencies'));

        const competencyRows = [
          new TableRow({
            children: [
              this.createTableCell('ID', { bold: true, shading: 'e2e8f0', width: 15 }),
              this.createTableCell('Statement', { bold: true, shading: 'e2e8f0', width: 85 }),
            ],
          }),
        ];

        step2.competencyItems.forEach((item: any) => {
          competencyRows.push(
            new TableRow({
              children: [
                this.createTableCell(item.id || '-'),
                this.createTableCell(item.statement || item.description || item.title || '-'),
              ],
            })
          );
        });

        contentChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: competencyRows,
          })
        );

        // Add detailed descriptions below table
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Detailed Competency Requirements:',
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { before: 200, after: 100, line: LINE_SPACING },
          })
        );

        step2.competencyItems.forEach((item: any) => {
          const statement = item.statement || item.description || item.title || '';
          const detailedDesc =
            item.description && item.statement !== item.description ? item.description : statement;

          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${item.id || ''}: `,
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
                new TextRun({
                  text: detailedDesc,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { after: 100, line: LINE_SPACING },
            })
          );
        });
      }

      sectionsCompleted++;
      reportProgress(
        'Step 2: Competency Framework',
        `✓ Step 2 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 3: PROGRAM LEARNING OUTCOMES (PLOs)
    // =========================================================================
    if (workflow.step3?.outcomes?.length) {
      reportProgress(
        'Step 3: Program Learning Outcomes',
        `Formatting PLOs (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step3 = workflow.step3;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('3. Program Learning Outcomes (PLOs)')
      );

      step3.outcomes.forEach((plo: any) => {
        contentChildren.push(
          this.createH3(`${plo.id || 'PLO'}: ${plo.statement || ''}`),
          new Paragraph({
            children: [
              new TextRun({
                text: `Bloom Level: ${plo.bloomLevel || 'N/A'}`,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
                italics: true,
                color: '4a5568',
              }),
            ],
            spacing: { after: 100, line: LINE_SPACING },
          })
        );

        // Add detailed explanation/description if available
        const explanation = plo.explanation || plo.description || plo.rationale;
        if (explanation && explanation !== plo.statement) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Explanation: ',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
                new TextRun({
                  text: explanation,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { after: 100, line: LINE_SPACING },
            })
          );
        }

        // Add competency links with full statements if available
        const competencyLinks = plo.competencyLinks || plo.linkedKSCs;
        if (competencyLinks && competencyLinks.length > 0) {
          const kscDetails = competencyLinks
            .map((kscId: string) => {
              const statement = kscMap.get(kscId);
              return statement ? `${kscId}: ${statement}` : kscId;
            })
            .join('; ');

          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Linked Competencies: ${kscDetails}`,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                  italics: true,
                }),
              ],
              spacing: { after: 200, line: LINE_SPACING },
            })
          );
        } else {
          contentChildren.push(
            new Paragraph({
              children: [],
              spacing: { after: 100 },
            })
          );
        }
      });

      sectionsCompleted++;
      reportProgress(
        'Step 3: Program Learning Outcomes',
        `✓ Step 3 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 4: COURSE STRUCTURE & MODULE LEARNING OUTCOMES
    // =========================================================================
    if (workflow.step4?.modules?.length) {
      reportProgress(
        'Step 4: Course Structure & MLOs',
        `Formatting modules (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step4 = workflow.step4;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('4. Course Structure & Module Learning Outcomes')
      );

      // Summary
      contentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Total Program Hours: ${step4.totalProgramHours || '-'} | Contact: ${step4.totalContactHours || '-'} | Independent: ${step4.totalIndependentHours || '-'}`,
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
              color: '4a5568',
            }),
          ],
          spacing: { after: 200, line: LINE_SPACING },
        })
      );

      // Module formatting template as specified
      for (const module of step4.modules) {
        // Module Title (H3)
        // Hours: X (Contact: X, Independent: X)
        // Calculate independent hours if not provided
        const independentHours =
          module.independentHours !== undefined && module.independentHours !== null
            ? module.independentHours
            : module.totalHours && module.contactHours
              ? module.totalHours - module.contactHours
              : '-';

        contentChildren.push(
          this.createH3(
            module.moduleCode
              ? `${module.moduleCode}: ${module.title || 'Untitled'}`
              : module.title || 'Untitled'
          ),
          new Paragraph({
            children: [
              new TextRun({
                text: `Hours: ${module.totalHours || '-'} (Contact: ${module.contactHours || '-'}, Independent: ${independentHours})`,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { after: 100, line: LINE_SPACING },
          })
        );

        // Module Learning Outcomes - in tabular format with KSC mappings
        if (module.mlos?.length) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Module Learning Outcomes:',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 100, after: 80, line: LINE_SPACING },
            })
          );

          const mloRows = [
            new TableRow({
              children: [
                this.createTableCell('ID', { bold: true, shading: 'e2e8f0', width: 10 }),
                this.createTableCell('Learning Outcome', {
                  bold: true,
                  shading: 'e2e8f0',
                  width: 50,
                }),
                this.createTableCell('Bloom Level', { bold: true, shading: 'e2e8f0', width: 15 }),
                this.createTableCell('Linked KSCs', { bold: true, shading: 'e2e8f0', width: 25 }),
              ],
            }),
          ];

          module.mlos.forEach((mlo: any) => {
            // Map KSC IDs to their actual statements
            // Check multiple possible property names (competencyLinks is the primary one in schema)
            const linkedKSCs =
              mlo.competencyLinks || mlo.linkedKSCs || mlo.linkedKSC || mlo.kscLinks || [];

            let kscStatements = '';
            if (Array.isArray(linkedKSCs) && linkedKSCs.length > 0) {
              kscStatements = linkedKSCs
                .map((kscId: string) => {
                  const statement = kscMap.get(kscId);
                  if (statement) {
                    // Truncate long statements for table readability
                    const truncatedStatement =
                      statement.length > 80 ? statement.substring(0, 80) + '...' : statement;
                    return `${kscId}: ${truncatedStatement}`;
                  }
                  return kscId;
                })
                .join('\n\n');
            } else {
              // If no competency links found, show "-"
              kscStatements = '-';
            }

            mloRows.push(
              new TableRow({
                children: [
                  this.createTableCell(mlo.id || '-'),
                  this.createTableCell(mlo.statement || '-'),
                  this.createTableCell(mlo.bloomLevel || '-'),
                  this.createTableCell(kscStatements),
                ],
              })
            );
          });

          contentChildren.push(
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: mloRows,
            })
          );
        }

        // Contact Activities:
        if (
          module.contactActivities &&
          Array.isArray(module.contactActivities) &&
          module.contactActivities.length > 0
        ) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Contact Activities:',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 100, after: 50, line: LINE_SPACING },
            })
          );

          module.contactActivities.forEach((activity: any) => {
            if (activity) {
              // Handle both object format { type, title, hours } and string format
              let activityText = '';
              if (typeof activity === 'object' && activity.type && activity.title) {
                const hours = activity.hours ? ` (${activity.hours}h)` : '';
                const type = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
                activityText = `${type}: ${activity.title}${hours}`;
              } else if (typeof activity === 'string') {
                activityText = activity;
              }

              if (activityText) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `• ${activityText}`,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { after: 30, line: LINE_SPACING },
                    indent: { left: 360 },
                  })
                );
              }
            }
          });
        }

        // Independent Activities:
        if (
          module.independentActivities &&
          Array.isArray(module.independentActivities) &&
          module.independentActivities.length > 0
        ) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Independent Activities:',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 100, after: 50, line: LINE_SPACING },
            })
          );

          module.independentActivities.forEach((activity: any) => {
            if (activity) {
              // Handle both object format { type, title, hours } and string format
              let activityText = '';
              if (typeof activity === 'object' && activity.type && activity.title) {
                const hours = activity.hours ? ` (${activity.hours}h)` : '';
                const type = activity.type.charAt(0).toUpperCase() + activity.type.slice(1);
                activityText = `${type}: ${activity.title}${hours}`;
              } else if (typeof activity === 'string') {
                activityText = activity;
              }

              if (activityText) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `• ${activityText}`,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { after: 30, line: LINE_SPACING },
                    indent: { left: 360 },
                  })
                );
              }
            }
          });
        }

        // Add spacing between modules
        contentChildren.push(
          new Paragraph({
            children: [],
            spacing: { after: 300 },
          })
        );
      }

      sectionsCompleted++;
      reportProgress(
        'Step 4: Course Structure & MLOs',
        `✓ Step 4 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 5: ACADEMIC SOURCES
    // =========================================================================
    if (workflow.step5?.sources?.length) {
      reportProgress(
        'Step 5: Academic Sources',
        `Formatting academic sources (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step5 = workflow.step5;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('5. Academic Sources')
      );

      // Group by module if moduleId exists, otherwise list all
      const sourcesByModule: { [key: string]: any[] } = {};
      const sourcesWithoutModule: any[] = [];

      step5.sources.forEach((source: any) => {
        if (source.moduleId) {
          if (!sourcesByModule[source.moduleId]) {
            sourcesByModule[source.moduleId] = [];
          }
          sourcesByModule[source.moduleId].push(source);
        } else {
          sourcesWithoutModule.push(source);
        }
      });

      // General sources first
      if (sourcesWithoutModule.length > 0) {
        contentChildren.push(this.createH2('General Sources'));
        sourcesWithoutModule.forEach((source: any) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${source.citation || source.title || 'Untitled'}`,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { after: 80, line: LINE_SPACING },
            })
          );
        });
      }

      // Module-specific sources
      Object.entries(sourcesByModule).forEach(([moduleId, sources]) => {
        contentChildren.push(this.createH2(`Module ${moduleId} Sources`));
        sources.forEach((source: any) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• ${source.citation || source.title || 'Untitled'}`,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { after: 80, line: LINE_SPACING },
            })
          );
        });
      });

      sectionsCompleted++;
      reportProgress(
        'Step 5: Academic Sources',
        `✓ Step 5 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 6: READING LISTS
    // =========================================================================
    if (workflow.step6) {
      reportProgress(
        'Step 6: Reading Lists',
        `Formatting reading lists (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step6 = workflow.step6;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('6. Reading Lists')
      );

      // Helper function to get reading text
      const getReadingText = (reading: any): string => {
        return typeof reading === 'string'
          ? reading
          : reading.citation || reading.title || 'Untitled';
      };

      // Collect all readings with de-duplication
      const allReadings = new Set<string>();

      // Core Readings - with de-duplication
      if (step6.coreReadings?.length) {
        contentChildren.push(this.createH2('Core Readings'));
        step6.coreReadings.forEach((reading: any) => {
          const readingText = getReadingText(reading);
          if (!allReadings.has(readingText)) {
            allReadings.add(readingText);
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${readingText}`,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { after: 80, line: LINE_SPACING },
              })
            );
          }
        });
      }

      // Supplementary Readings - with de-duplication
      if (step6.supplementaryReadings?.length) {
        contentChildren.push(this.createH2('Supplementary Readings'));
        const suppReadingsSet = new Set<string>();
        step6.supplementaryReadings.forEach((reading: any) => {
          const readingText = getReadingText(reading);
          // Check against all readings and supplementary set
          if (!allReadings.has(readingText) && !suppReadingsSet.has(readingText)) {
            allReadings.add(readingText);
            suppReadingsSet.add(readingText);
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `• ${readingText}`,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { after: 80, line: LINE_SPACING },
              })
            );
          }
        });
      }

      // Module-specific readings - with de-duplication
      if (step6.moduleReadings && typeof step6.moduleReadings === 'object') {
        Object.entries(step6.moduleReadings).forEach(([moduleId, readings]: [string, any]) => {
          if (Array.isArray(readings) && readings.length > 0) {
            const moduleReadingsSet = new Set<string>();
            const uniqueModuleReadings: string[] = [];

            // First pass: collect unique readings for this module
            readings.forEach((reading: any) => {
              const readingText = getReadingText(reading);
              if (!allReadings.has(readingText) && !moduleReadingsSet.has(readingText)) {
                allReadings.add(readingText);
                moduleReadingsSet.add(readingText);
                uniqueModuleReadings.push(readingText);
              }
            });

            // Only add section if there are unique readings
            if (uniqueModuleReadings.length > 0) {
              contentChildren.push(this.createH2(`Module ${moduleId} Readings`));
              uniqueModuleReadings.forEach((readingText) => {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `• ${readingText}`,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { after: 80, line: LINE_SPACING },
                  })
                );
              });
            }
          }
        });
      }

      sectionsCompleted++;
      reportProgress(
        'Step 6: Reading Lists',
        `✓ Step 6 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 7: COMPREHENSIVE ASSESSMENT PACKAGE
    // =========================================================================
    if (
      workflow.step7?.formativeAssessments?.length ||
      workflow.step7?.summativeAssessments?.length ||
      workflow.step7?.sampleQuestions
    ) {
      reportProgress(
        'Step 7: Assessment Package',
        `Formatting assessments (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step7 = workflow.step7;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('7. Comprehensive Assessment Package')
      );

      // Assessment Strategy Summary
      const userPrefs = step7.userPreferences || {};
      contentChildren.push(
        this.createH2('7.1 Assessment Strategy'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                this.createTableCell('Parameter', { bold: true, shading: 'e2e8f0' }),
                this.createTableCell('Value', { bold: true, shading: 'e2e8f0' }),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Assessment Structure'),
                this.createTableCell(
                  String(userPrefs.assessmentStructure || 'Both formative and summative')
                ),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Assessment Balance'),
                this.createTableCell(String(userPrefs.assessmentBalance || 'Blended mix')),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Formative Weight'),
                this.createTableCell(`${userPrefs.weightages?.formative || 0}%`),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Summative Weight'),
                this.createTableCell(`${userPrefs.weightages?.summative || 0}%`),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Total Formatives'),
                this.createTableCell(String(step7.formativeAssessments?.length || 0)),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Total Summatives'),
                this.createTableCell(String(step7.summativeAssessments?.length || 0)),
              ],
            }),
          ],
        }),
        new Paragraph({ children: [], spacing: { after: 200 } })
      );

      // Formative Assessments Section
      if (step7.formativeAssessments?.length) {
        contentChildren.push(this.createH2('7.2 Formative Assessments'));

        for (const assessment of step7.formativeAssessments) {
          contentChildren.push(
            this.createH3(`${assessment.title || 'Untitled Assessment'}`),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Module: ${assessment.moduleId || 'N/A'} | Type: ${assessment.assessmentType || 'N/A'} | Max Marks: ${assessment.maxMarks || 'N/A'}`,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                  italics: true,
                  color: '4a5568',
                }),
              ],
              spacing: { after: 100, line: LINE_SPACING },
            })
          );

          // Description
          if (assessment.description) {
            const formatted = await this.formatTextIntelligently(
              assessment.description,
              'Assessment Description'
            );
            if (formatted.paragraphs.length > 0) {
              contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
            }
          }

          // Instructions
          if (assessment.instructions) {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Instructions:',
                    bold: true,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { before: 100, after: 50, line: LINE_SPACING },
              })
            );

            const formatted = await this.formatTextIntelligently(
              assessment.instructions,
              'Assessment Instructions'
            );
            if (formatted.paragraphs.length > 0) {
              contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
            }
            if (formatted.bullets.length > 0) {
              contentChildren.push(
                ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
              );
            }
          }

          // Questions (if available)
          if (assessment.questions?.length) {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Questions:',
                    bold: true,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { before: 100, after: 50, line: LINE_SPACING },
              })
            );

            assessment.questions.forEach((q: any, idx: number) => {
              // Question text
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${idx + 1}. ${q.questionText || q.text || ''}`,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                      bold: true,
                    }),
                  ],
                  spacing: { before: 80, after: 40, line: LINE_SPACING },
                })
              );

              // MCQ options (indented)
              if (q.questionType === 'mcq' && q.options?.length) {
                q.options.forEach((option: string, optIdx: number) => {
                  const letter = String.fromCharCode(65 + optIdx); // A, B, C, D
                  const isCorrect = q.correctOptionIndex === optIdx || q.correctAnswer === optIdx;
                  contentChildren.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `    ${letter}. ${option}${isCorrect ? ' ✓' : ''}`,
                          size: FONT_SIZES.BODY,
                          font: FONT_FAMILY,
                          bold: isCorrect,
                        }),
                      ],
                      spacing: { after: 30, line: LINE_SPACING },
                    })
                  );
                });
              }

              // Rationale if available
              if (q.rationale) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `Rationale: ${q.rationale}`,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                        italics: true,
                        color: '4a5568',
                      }),
                    ],
                    spacing: { after: 60, line: LINE_SPACING },
                  })
                );
              }
            });
          }

          // Spacing between assessments
          contentChildren.push(
            new Paragraph({
              children: [],
              spacing: { after: 300 },
            })
          );
        }
      }

      // Summative Assessments Section
      if (step7.summativeAssessments?.length) {
        contentChildren.push(this.createH2('7.3 Summative Assessments'));

        for (const assessment of step7.summativeAssessments) {
          contentChildren.push(
            this.createH3(`${assessment.title || 'Untitled Assessment'}`),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Scope: ${assessment.scope || 'N/A'} | Format: ${assessment.format || 'N/A'}`,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                  italics: true,
                  color: '4a5568',
                }),
              ],
              spacing: { after: 100, line: LINE_SPACING },
            })
          );

          // Description
          if (assessment.description) {
            const formatted = await this.formatTextIntelligently(
              assessment.description,
              'Summative Assessment Description'
            );
            if (formatted.paragraphs.length > 0) {
              contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
            }
          }

          // Components (if any)
          if (assessment.components?.length) {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Components:',
                    bold: true,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { before: 100, after: 50, line: LINE_SPACING },
              })
            );

            assessment.components.forEach((comp: any) => {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `• ${comp.name || comp.componentType || 'Component'} - ${comp.weight || 0}% (${comp.description || ''})`,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { after: 40, line: LINE_SPACING },
                })
              );
            });
          }

          // Spacing between assessments
          contentChildren.push(
            new Paragraph({
              children: [],
              spacing: { after: 300 },
            })
          );
        }
      }

      sectionsCompleted++;
      reportProgress(
        'Step 7: Assessment Package',
        `✓ Step 7 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 8: CASE STUDIES
    // =========================================================================
    if (workflow.step8?.caseStudies?.length) {
      reportProgress(
        'Step 8: Case Studies',
        `Formatting case studies (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step8 = workflow.step8;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('8. Case Studies')
      );

      for (const caseStudy of step8.caseStudies) {
        contentChildren.push(this.createH3(caseStudy.title || 'Untitled Case Study'));

        if (caseStudy.scenario || caseStudy.description) {
          const formatted = await this.formatTextIntelligently(
            caseStudy.scenario || caseStudy.description,
            'Case Study Scenario'
          );
          if (formatted.paragraphs.length > 0) {
            contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
          }
        }

        // Learning objectives
        if (caseStudy.learningObjectives?.length) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Learning Objectives:',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 100, after: 50, line: LINE_SPACING },
            })
          );
          contentChildren.push(
            ...this.createFormattedParagraphs(caseStudy.learningObjectives, { isBullet: true })
          );
        }

        // Questions/prompts
        if (caseStudy.questions?.length || caseStudy.prompts?.length) {
          const questions = caseStudy.questions || caseStudy.prompts;
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Discussion Questions:',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 100, after: 50, line: LINE_SPACING },
            })
          );
          contentChildren.push(...this.createFormattedParagraphs(questions, { isNumbered: true }));
        }

        contentChildren.push(
          new Paragraph({
            children: [],
            spacing: { after: 300 },
          })
        );
      }

      sectionsCompleted++;
      reportProgress(
        'Step 8: Case Studies',
        `✓ Step 8 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 9: GLOSSARY
    // =========================================================================
    if (workflow.step9?.terms?.length || workflow.step9?.glossaryTerms?.length) {
      reportProgress(
        'Step 9: Glossary',
        `Formatting glossary (${sectionsCompleted + 1}/${totalSections})...`
      );

      const step9 = workflow.step9;
      const terms = step9.terms || step9.glossaryTerms || [];

      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        this.createH1('9. Glossary')
      );

      // Sort alphabetically
      const sortedTerms = [...terms].sort((a, b) => {
        const termA = (a.term || a.title || '').toLowerCase();
        const termB = (b.term || b.title || '').toLowerCase();
        return termA.localeCompare(termB);
      });

      for (const term of sortedTerms) {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: term.term || term.title || 'Term',
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { before: 100, after: 40, line: LINE_SPACING },
          })
        );

        if (term.definition || term.description) {
          const formatted = await this.formatTextIntelligently(
            term.definition || term.description,
            'Glossary Term Definition'
          );
          if (formatted.paragraphs.length > 0) {
            contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
          }
        }
      }

      sectionsCompleted++;
      reportProgress(
        'Step 9: Glossary',
        `✓ Step 9 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // SECTION 10: LESSON PLANS & PPT GENERATION
    // =========================================================================
    if (workflow.step10) {
      reportProgress(
        'Step 10: Lesson Plans',
        `Formatting lesson plans (${sectionsCompleted + 1}/${totalSections})...`
      );

      await this.generateStep10Section(workflow.step10, contentChildren);

      sectionsCompleted++;
      reportProgress(
        'Step 10: Lesson Plans',
        `✓ Step 10 formatted (${sectionsCompleted}/${totalSections})`
      );
    }

    // =========================================================================
    // FINALIZE DOCUMENT
    // =========================================================================
    reportProgress('Finalizing', 'Creating final document...');

    sections.push({
      properties: {},
      children: contentChildren,
    });

    const doc = new Document({
      sections,
    });

    reportProgress(
      'Complete',
      `✓ Document generation complete! (${sectionsCompleted}/${totalSections} sections)`
    );

    return await Packer.toBuffer(doc);
  }
}

// Export singleton instance
export const wordExportService = new WordExportService();
