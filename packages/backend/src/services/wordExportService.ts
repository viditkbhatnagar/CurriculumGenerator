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
  BorderStyle,
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

// Font specifications - Times New Roman throughout
const FONT_FAMILY = 'Times New Roman';
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
   * Create table cell with Times New Roman font
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
   * Create H1 heading - Times New Roman 16pt Bold
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
   * Create H2 heading - Times New Roman 14pt Bold
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
   * Create H3 heading - Times New Roman 12pt Bold
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
   * Generate the complete Word document with intelligent formatting and progress tracking
   */
  async generateDocument(
    workflow: WorkflowData,
    progressCallback?: ProgressCallback
  ): Promise<Buffer> {
    const sections: any[] = [];
    const step1 = workflow.step1 || {};

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

      // Knowledge Items - with intelligent formatting
      if (step2.knowledgeItems?.length) {
        contentChildren.push(this.createH2('Knowledge'));

        for (const item of step2.knowledgeItems) {
          const itemText = `${item.id || ''}: ${item.title || item.description || ''}`;
          const formatted = await this.formatTextIntelligently(itemText, 'Knowledge Item');

          if (formatted.paragraphs.length > 0) {
            contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
          } else if (formatted.bullets.length > 0) {
            contentChildren.push(
              ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
            );
          }
        }
      }

      // Skills Items
      if (step2.skillItems?.length) {
        contentChildren.push(this.createH2('Skills'));

        for (const item of step2.skillItems) {
          const itemText = `${item.id || ''}: ${item.title || item.description || ''}`;
          const formatted = await this.formatTextIntelligently(itemText, 'Skill Item');

          if (formatted.paragraphs.length > 0) {
            contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
          } else if (formatted.bullets.length > 0) {
            contentChildren.push(
              ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
            );
          }
        }
      }

      // Competency Items
      if (step2.competencyItems?.length) {
        contentChildren.push(this.createH2('Competencies'));

        for (const item of step2.competencyItems) {
          const itemText = `${item.id || ''}: ${item.title || item.description || ''}`;
          const formatted = await this.formatTextIntelligently(itemText, 'Competency Item');

          if (formatted.paragraphs.length > 0) {
            contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
          } else if (formatted.bullets.length > 0) {
            contentChildren.push(
              ...this.createFormattedParagraphs(formatted.bullets, { isBullet: true })
            );
          }
        }
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
            spacing: { after: 200, line: LINE_SPACING },
          })
        );
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

        // Module Learning Outcomes:
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

          module.mlos.forEach((mlo: any) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${mlo.id || 'M-LO'}: ${mlo.statement || ''} [${mlo.bloomLevel || 'N/A'}]`,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { after: 50, line: LINE_SPACING },
              })
            );
          });
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

      // Core Readings
      if (step6.coreReadings?.length) {
        contentChildren.push(this.createH2('Core Readings'));
        step6.coreReadings.forEach((reading: any) => {
          const readingText =
            typeof reading === 'string' ? reading : reading.citation || reading.title || 'Untitled';
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

      // Supplementary Readings
      if (step6.supplementaryReadings?.length) {
        contentChildren.push(this.createH2('Supplementary Readings'));
        step6.supplementaryReadings.forEach((reading: any) => {
          const readingText =
            typeof reading === 'string' ? reading : reading.citation || reading.title || 'Untitled';
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

      // Module-specific readings
      if (step6.moduleReadings && typeof step6.moduleReadings === 'object') {
        Object.entries(step6.moduleReadings).forEach(([moduleId, readings]: [string, any]) => {
          if (Array.isArray(readings) && readings.length > 0) {
            contentChildren.push(this.createH2(`Module ${moduleId} Readings`));
            readings.forEach((reading: any) => {
              const readingText =
                typeof reading === 'string'
                  ? reading
                  : reading.citation || reading.title || 'Untitled';
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
