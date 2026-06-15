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
  step11?: any;
  step12?: any;
  step13?: any;
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
   * Split prose into readable paragraphs WITHOUT an OpenAI round-trip.
   * Used for content that is already well-formed (e.g. generated lesson-plan
   * guidance) where calling formatTextIntelligently per item would add a
   * network call per lesson and make large exports time out. Honours existing
   * blank-line breaks; otherwise groups sentences into ~4-sentence blocks.
   */
  private splitIntoParagraphs(text: string): string[] {
    const trimmed = (text || '').trim();
    if (!trimmed) return [];
    const byBlankLine = trimmed
      .split(/\n\s*\n+/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (byBlankLine.length > 1) return byBlankLine;
    const sentences = trimmed.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [
      trimmed,
    ];
    const paras: string[] = [];
    for (let i = 0; i < sentences.length; i += 4) {
      paras.push(
        sentences
          .slice(i, i + 4)
          .join('')
          .trim()
      );
    }
    return paras.filter(Boolean);
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
   * Generate Step 1 (Program Foundation) section
   */
  private async generateStep1Section(step1: any, contentChildren: any[]): Promise<void> {
    if (!step1) return;

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
                  String(step1.creditFramework.system || step1.creditFramework.creditSystem || '-')
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
  }

  /**
   * Generate Step 2 (Competency Framework) section
   */
  private async generateStep2Section(step2: any, contentChildren: any[]): Promise<void> {
    if (!step2) return;

    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      this.createH1('2. Competency Framework (KSC)')
    );

    // Helper to generate KSC item section (knowledge, skills, competencies)
    const generateKSCItems = (items: any[], title: string, detailedLabel: string) => {
      if (!items?.length) return;

      contentChildren.push(this.createH2(title));

      const rows = [
        new TableRow({
          children: [
            this.createTableCell('ID', { bold: true, shading: 'e2e8f0', width: 15 }),
            this.createTableCell('Statement', { bold: true, shading: 'e2e8f0', width: 85 }),
          ],
        }),
      ];

      items.forEach((item: any) => {
        rows.push(
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
          rows,
        })
      );

      // Add detailed descriptions below table
      contentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `${detailedLabel}:`,
              bold: true,
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
            }),
          ],
          spacing: { before: 200, after: 100, line: LINE_SPACING },
        })
      );

      items.forEach((item: any) => {
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
    };

    generateKSCItems(step2.knowledgeItems, 'Knowledge', 'Detailed Knowledge Requirements');
    generateKSCItems(step2.skillItems, 'Skills', 'Detailed Skill Requirements');
    generateKSCItems(step2.competencyItems, 'Competencies', 'Detailed Competency Requirements');
  }

  /**
   * Generate Step 3 (Program Learning Outcomes) section
   */
  private async generateStep3Section(
    step3: any,
    contentChildren: any[],
    kscMap: Map<string, string>
  ): Promise<void> {
    if (!step3?.outcomes?.length) return;

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
  }

  /**
   * Generate Step 4 (Course Structure & MLOs) section
   */
  private async generateStep4Section(
    step4: any,
    contentChildren: any[],
    kscMap: Map<string, string>
  ): Promise<void> {
    if (!step4?.modules?.length) return;

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

    for (const module of step4.modules) {
      // Real generated modules store the code under `code` (frontend shape);
      // the typed model calls it `moduleCode`. Accept either so the heading
      // always carries a code — the re-import parser keys modules on it.
      const moduleCode = module.moduleCode || module.code;
      const independentHours =
        module.independentHours !== undefined && module.independentHours !== null
          ? module.independentHours
          : module.selfStudyHours !== undefined && module.selfStudyHours !== null
            ? module.selfStudyHours
            : module.totalHours && module.contactHours
              ? module.totalHours - module.contactHours
              : '-';

      contentChildren.push(
        this.createH3(
          moduleCode ? `${moduleCode}: ${module.title || 'Untitled'}` : module.title || 'Untitled'
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

      // Module description — needed so SMEs can edit it in Word and have
      // the change round-trip back via the curriculum re-upload feature.
      if (module.description && String(module.description).trim()) {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Description: ',
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: String(module.description),
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { before: 80, after: 100, line: LINE_SPACING },
          })
        );
      }

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

        // The "Code" column carries the SME-visible MLO code (M1-LO1 etc.)
        // The re-upload parser uses this code as the match key, so the SME
        // can edit the statement freely without breaking the mapping.
        const mloRows = [
          new TableRow({
            children: [
              this.createTableCell('Code', { bold: true, shading: 'e2e8f0', width: 10 }),
              this.createTableCell('Learning Outcome', {
                bold: true,
                shading: 'e2e8f0',
                width: 42,
              }),
              this.createTableCell('Bloom Level', { bold: true, shading: 'e2e8f0', width: 12 }),
              this.createTableCell('Verb', { bold: true, shading: 'e2e8f0', width: 10 }),
              this.createTableCell('Linked PLOs', { bold: true, shading: 'e2e8f0', width: 12 }),
              this.createTableCell('Linked KSCs', { bold: true, shading: 'e2e8f0', width: 14 }),
            ],
          }),
        ];

        module.mlos.forEach((mlo: any) => {
          const linkedKSCs =
            mlo.competencyLinks || mlo.linkedKSCs || mlo.linkedKSC || mlo.kscLinks || [];

          let kscStatements = '';
          if (Array.isArray(linkedKSCs) && linkedKSCs.length > 0) {
            kscStatements = linkedKSCs
              .map((kscId: string) => {
                const statement = kscMap.get(kscId);
                if (statement) {
                  const truncatedStatement =
                    statement.length > 80 ? statement.substring(0, 80) + '...' : statement;
                  return `${kscId}: ${truncatedStatement}`;
                }
                return kscId;
              })
              .join('\n\n');
          } else {
            kscStatements = '-';
          }

          const linkedPLOs = Array.isArray(mlo.linkedPLOs) ? mlo.linkedPLOs.join(', ') : '-';

          mloRows.push(
            new TableRow({
              children: [
                this.createTableCell(mlo.code || mlo.id || '-'),
                this.createTableCell(mlo.statement || '-'),
                this.createTableCell(mlo.bloomLevel || '-'),
                this.createTableCell(mlo.verb || '-'),
                this.createTableCell(linkedPLOs || '-'),
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

      // Topics — included so SMEs can edit/reorder/add/remove them in Word.
      // Bullet format keeps it lightweight and easy for the re-upload parser
      // to pick up: "• [n] Title (Xh)".
      if (Array.isArray(module.topics) && module.topics.length > 0) {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Topics:',
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { before: 100, after: 50, line: LINE_SPACING },
          })
        );
        module.topics.forEach((topic: any, idx: number) => {
          const seq = topic.sequence ?? idx + 1;
          const hoursPart =
            typeof topic.hours === 'number' && topic.hours > 0 ? ` (${topic.hours}h)` : '';
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `• [${seq}] ${topic.title || 'Untitled topic'}${hoursPart}`,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { after: 30, line: LINE_SPACING },
              indent: { left: 360 },
            })
          );
        });
      }

      // Contact Activities
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

      // Independent Activities
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
  }

  /**
   * Generate Step 5 (Academic Sources) section
   */
  private async generateStep5Section(step5: any, contentChildren: any[]): Promise<void> {
    if (!step5?.sources?.length) return;

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
  }

  /**
   * Generate Step 6 (Reading Lists) section
   */
  private async generateStep6Section(step6: any, contentChildren: any[]): Promise<void> {
    if (!step6) return;

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

          readings.forEach((reading: any) => {
            const readingText = getReadingText(reading);
            if (!allReadings.has(readingText) && !moduleReadingsSet.has(readingText)) {
              allReadings.add(readingText);
              moduleReadingsSet.add(readingText);
              uniqueModuleReadings.push(readingText);
            }
          });

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
  }

  /**
   * Generate Step 7 (Assessment Package) section
   */
  private async generateStep7Section(step7: any, contentChildren: any[]): Promise<void> {
    if (
      !step7?.formativeAssessments?.length &&
      !step7?.summativeAssessments?.length &&
      !step7?.sampleQuestions
    ) {
      return;
    }

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
                const letter = String.fromCharCode(65 + optIdx);
                // Tick by index (correctOptionIndex / legacy numeric correctAnswer)
                // OR by text (canonical correctAnswer = the option's full text).
                const isCorrect =
                  q.correctOptionIndex === optIdx ||
                  q.correctAnswer === optIdx ||
                  (typeof q.correctAnswer === 'string' && q.correctAnswer === option);
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
  }

  /**
   * Generate Step 8 (Case Studies) section
   */
  private async generateStep8Section(step8: any, contentChildren: any[]): Promise<void> {
    if (!step8?.caseStudies?.length) return;

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
  }

  /**
   * Generate Step 9 (Glossary) section
   */
  private async generateStep9Section(step9: any, contentChildren: any[]): Promise<void> {
    const terms = step9?.terms || step9?.glossaryTerms || [];
    if (!terms.length) return;

    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      this.createH1('9. Glossary')
    );

    // Sort alphabetically
    const sortedTerms = [...terms].sort((a: any, b: any) => {
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
  }

  /**
   * Generate Step 11 (PowerPoint Decks) section
   */
  private async generateStep11Section(step11: any, contentChildren: any[]): Promise<void> {
    if (!step11) return;

    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      this.createH1('11. PowerPoint Decks'),
      new Paragraph({
        children: [
          new TextRun({
            text: 'PowerPoint presentation decks have been generated for each lesson across all modules. These are available as a separate download in ZIP format from the Final Review page.',
            font: FONT_FAMILY,
            size: FONT_SIZES.BODY,
            italics: true,
          }),
        ],
        spacing: { line: LINE_SPACING, ...PARA_SPACING },
      })
    );

    // Show PPT inventory if step11 has module data
    if (step11.modules?.length) {
      for (const mod of step11.modules) {
        contentChildren.push(
          this.createH3(`${mod.moduleCode || ''} — ${mod.moduleTitle || mod.moduleName || ''}`),
          new Paragraph({
            children: [
              new TextRun({
                text: `${mod.pptDecks?.length || mod.lessons?.length || 0} PowerPoint deck(s) generated`,
                font: FONT_FAMILY,
                size: FONT_SIZES.BODY,
              }),
            ],
            spacing: { line: LINE_SPACING, ...PARA_SPACING },
          })
        );
      }
    }
  }

  /**
   * Order module-keyed entries (lesson plans / assignment packs) by their
   * position in Step 4. These arrays are stored in GENERATION order, so a module
   * generated later (e.g. a re-generated MOD103) would otherwise render after
   * MOD108. Matches by moduleId first, then module code; unmatched entries keep
   * their relative order at the end. Returns a new array (does not mutate input).
   */
  private orderModulesByStep4(items: any[], step4?: any): any[] {
    if (!Array.isArray(items) || items.length < 2 || !step4?.modules?.length) {
      return Array.isArray(items) ? items : [];
    }
    const orderOf = new Map<string, number>();
    step4.modules.forEach((m: any, i: number) => {
      if (m?.id) orderOf.set(`id:${m.id}`, i);
      const c = m?.code || m?.moduleCode;
      if (c) orderOf.set(`code:${c}`, i);
    });
    const rank = (p: any): number => {
      const byId = p?.moduleId != null ? orderOf.get(`id:${p.moduleId}`) : undefined;
      if (byId !== undefined) return byId;
      const byCode = p?.moduleCode != null ? orderOf.get(`code:${p.moduleCode}`) : undefined;
      return byCode !== undefined ? byCode : Number.MAX_SAFE_INTEGER;
    };
    return items
      .map((p, i) => ({ p, r: rank(p), i }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map((x) => x.p);
  }

  /**
   * Generate Step 10 (Lesson Plans) section
   */
  private async generateStep10Section(
    step10: any,
    contentChildren: any[],
    step4?: any
  ): Promise<void> {
    if (!step10) return;

    // Index step4 modules by id and normalised title so each lesson-plan
    // module can pull its independent activities / independent hours / MLOs.
    const step4ById = new Map<string, any>();
    const step4ByTitle = new Map<string, any>();
    (step4?.modules || []).forEach((m: any) => {
      if (m.id) step4ById.set(String(m.id), m);
      if (m.title) step4ByTitle.set(String(m.title).toLowerCase().replace(/\s+/g, ' ').trim(), m);
    });
    const findStep4Module = (mp: any): any =>
      (mp.moduleId && step4ById.get(String(mp.moduleId))) ||
      step4ByTitle.get(
        String(mp.moduleTitle || mp.title || '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim()
      );

    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      this.createH1('10. Lesson Plans & PPT Generation')
    );

    // Counts computed LIVE from the lesson plans actually present (the array
    // is filtered to one module for per-module exports). step10.summary is
    // written once at generation time and goes stale after modules are
    // regenerated — that caused the screen/doc lesson-count mismatch and made
    // per-module files repeat whole-programme totals.
    const plans: any[] = this.orderModulesByStep4(
      Array.isArray(step10.moduleLessonPlans) ? step10.moduleLessonPlans : [],
      step4
    );
    const allLessons: any[] = plans.flatMap((p: any) =>
      Array.isArray(p.lessons) ? p.lessons : []
    );
    const liveLessonCount =
      allLessons.length || plans.reduce((s: number, p: any) => s + (p.totalLessons || 0), 0);
    const liveContactHours =
      Math.round(plans.reduce((s: number, p: any) => s + (p.totalContactHours || 0), 0) * 100) /
      100;
    const liveIndependentHours = plans.reduce((s: number, p: any) => {
      const m = findStep4Module(p);
      return s + (m?.selfStudyHours ?? m?.independentHours ?? 0);
    }, 0);
    const liveCaseStudies = allLessons.filter((l: any) => l.caseStudyActivity).length;
    const liveFormative = allLessons.reduce(
      (s: number, l: any) => s + (Array.isArray(l.formativeChecks) ? l.formativeChecks.length : 0),
      0
    );
    const liveAvgDuration =
      liveLessonCount > 0 ? Math.round((liveContactHours * 60) / liveLessonCount) : 0;
    const allHaveLessons =
      plans.length > 0 && plans.every((p: any) => (p.lessons?.length || p.totalLessons || 0) > 0);

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
            this.createTableCell(allHaveLessons ? '✓ Pass' : '✗ Fail'),
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

    // Summary Statistics — computed live (see note above) so the figures
    // always match the lessons actually in this document.
    if (plans.length) {
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
            this.createTableCell(String(liveLessonCount)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Contact Hours'),
            this.createTableCell(String(liveContactHours)),
          ],
        }),
        ...(liveIndependentHours > 0
          ? [
              new TableRow({
                children: [
                  this.createTableCell('Total Independent Hours'),
                  this.createTableCell(String(liveIndependentHours)),
                ],
              }),
            ]
          : []),
        new TableRow({
          children: [
            this.createTableCell('Average Lesson Duration (minutes)'),
            this.createTableCell(String(liveAvgDuration)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Case Studies Included'),
            this.createTableCell(String(liveCaseStudies)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Formative Checks Included'),
            this.createTableCell(String(liveFormative)),
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

    // Module Lesson Plans — rendered in Step 4 module order (see `plans` above).
    if (plans.length) {
      contentChildren.push(this.createH2('10.3 Module Lesson Plans'));

      for (let modIdx = 0; modIdx < plans.length; modIdx++) {
        const modulePlan = plans[modIdx];
        const modCode = modulePlan.moduleCode || modulePlan.code || `M${modIdx + 1}`;
        const s4mod = findStep4Module(modulePlan);
        const independentHours = s4mod?.selfStudyHours ?? s4mod?.independentHours;
        const lessonCount = modulePlan.lessons?.length ?? modulePlan.totalLessons ?? 0;
        // Module header — now also surfaces independent hours.
        contentChildren.push(
          this.createH3(
            `${modCode}: ${modulePlan.moduleTitle || modulePlan.title || 'Untitled Module'}`
          ),
          new Paragraph({
            children: [
              new TextRun({
                text:
                  `Total Contact Hours: ${modulePlan.totalContactHours || 0}` +
                  (independentHours !== undefined
                    ? ` | Total Independent Hours: ${independentHours}`
                    : '') +
                  ` | Total Lessons: ${lessonCount}`,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
                italics: true,
                color: '4a5568',
              }),
            ],
            spacing: { after: 150, line: LINE_SPACING },
          })
        );

        // Module Alignment Map (MLO → Linked PLOs → Linked KSCs), from step4.
        if (s4mod?.mlos?.length) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Module Alignment Map:',
                  bold: true,
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 60, after: 50, line: LINE_SPACING },
            })
          );
          const alignRows = [
            new TableRow({
              children: [
                this.createTableCell('MLO', { bold: true, shading: 'e2e8f0', width: 18 }),
                this.createTableCell('Linked PLOs', { bold: true, shading: 'e2e8f0', width: 41 }),
                this.createTableCell('Linked KSCs', { bold: true, shading: 'e2e8f0', width: 41 }),
              ],
            }),
          ];
          s4mod.mlos.forEach((mlo: any) => {
            const plos = Array.isArray(mlo.linkedPLOs) ? mlo.linkedPLOs.join(', ') : '';
            const kscs = Array.isArray(mlo.competencyLinks)
              ? mlo.competencyLinks.join(', ')
              : Array.isArray(mlo.linkedKSCs)
                ? mlo.linkedKSCs.join(', ')
                : '';
            alignRows.push(
              new TableRow({
                children: [
                  this.createTableCell(mlo.code || mlo.id || '-'),
                  this.createTableCell(plos || '-'),
                  this.createTableCell(kscs || '-'),
                ],
              })
            );
          });
          contentChildren.push(
            new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: alignRows }),
            new Paragraph({ children: [], spacing: { after: 150 } })
          );
        }

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

            // Linked MLOs, PLOs and KSCs
            if (
              lesson.linkedMLOs?.length ||
              lesson.linkedPLOs?.length ||
              lesson.linkedKSCs?.length
            ) {
              const mloText = lesson.linkedMLOs?.length
                ? `MLOs: ${lesson.linkedMLOs.join(', ')}`
                : '';
              const ploText = lesson.linkedPLOs?.length
                ? `PLOs: ${lesson.linkedPLOs.join(', ')}`
                : '';
              const kscText = lesson.linkedKSCs?.length
                ? `KSCs: ${lesson.linkedKSCs.join(', ')}`
                : '';
              const alignmentText = [mloText, ploText, kscText].filter(Boolean).join(' | ');

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

            // Topic Coverage / Practical Skill Coverage — what to teach.
            const tc = lesson.topicCoverage;
            if (tc && (tc.exactTopic || tc.subtopics?.length || tc.practicalActivity)) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Topic Coverage / Practical Skill Coverage:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                })
              );
              const labelled = (label: string, value: string) =>
                new Paragraph({
                  spacing: { after: 30, line: LINE_SPACING },
                  children: [
                    new TextRun({
                      text: `${label} `,
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                    new TextRun({ text: value, size: FONT_SIZES.BODY, font: FONT_FAMILY }),
                  ],
                });
              if (tc.exactTopic)
                contentChildren.push(labelled('Exact Topic to Teach:', tc.exactTopic));
              if (tc.subtopics?.length)
                contentChildren.push(
                  labelled('Specific Subtopics / Skill List:', tc.subtopics.join('; '))
                );
              if (tc.practicalActivity)
                contentChildren.push(
                  labelled('Practical / AI / Case Activity:', tc.practicalActivity)
                );
              if (tc.studentEvidence)
                contentChildren.push(labelled('Student Evidence:', tc.studentEvidence));
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
                const deckRef = String(lesson.materials.pptDeckRef).replace(
                  /^undefined-/,
                  `${modCode}-`
                );
                materials.push(`PPT Deck: ${deckRef}`);
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
                // Plain split — no OpenAI call per lesson. With many lessons
                // the per-lesson round-trip was the dominant cost and made the
                // full Step 10 export time out (~5 min); the guidance text is
                // already well-formed prose.
                const paras = this.splitIntoParagraphs(lesson.instructorNotes.pedagogicalGuidance);
                if (paras.length > 0) {
                  contentChildren.push(...this.createFormattedParagraphs(paras));
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

            // Independent Activity Block — per-lesson self-study (the format the
            // SME asked for). Hours are split evenly from the module's
            // independent hours so they sum to the module total; the qualitative
            // columns come from the lesson generator.
            const ia = lesson.independentActivity;
            if (ia && (ia.independentTask || ia.sourceMaterialMapping || ia.studentEvidence)) {
              const perLessonIndep =
                independentHours !== undefined && lessonCount > 0
                  ? Math.round((Number(independentHours) / lessonCount) * 10) / 10
                  : undefined;
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Independent Activity Block:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                }),
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: [
                    new TableRow({
                      children: [
                        this.createTableCell('Independent Hours', {
                          bold: true,
                          shading: 'e2e8f0',
                          width: 12,
                        }),
                        this.createTableCell('Source-Material Mapping', {
                          bold: true,
                          shading: 'e2e8f0',
                          width: 22,
                        }),
                        this.createTableCell('Independent Task', {
                          bold: true,
                          shading: 'e2e8f0',
                          width: 26,
                        }),
                        this.createTableCell('AI / Platform Support and Human Validation', {
                          bold: true,
                          shading: 'e2e8f0',
                          width: 24,
                        }),
                        this.createTableCell('Student Evidence', {
                          bold: true,
                          shading: 'e2e8f0',
                          width: 16,
                        }),
                      ],
                    }),
                    new TableRow({
                      children: [
                        this.createTableCell(
                          perLessonIndep !== undefined ? `${perLessonIndep}h` : '-'
                        ),
                        this.createTableCell(ia.sourceMaterialMapping || '-'),
                        this.createTableCell(ia.independentTask || '-'),
                        this.createTableCell(ia.aiPlatformSupport || '-'),
                        this.createTableCell(ia.studentEvidence || '-'),
                      ],
                    }),
                  ],
                }),
                new Paragraph({ children: [], spacing: { after: 100 } })
              );
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

        // Independent Activities (module-level, from step4). The lesson loop
        // above only covers contact sessions; the SME flagged that independent
        // activities were missing from the export.
        const indepActs: string[] = Array.isArray(s4mod?.independentActivities)
          ? s4mod.independentActivities.filter((a: any) => typeof a === 'string' && a.trim())
          : [];
        if (indepActs.length) {
          contentChildren.push(
            this.createH3('Independent Activities'),
            new Paragraph({
              children: [
                new TextRun({
                  text:
                    independentHours !== undefined
                      ? `Total Independent Hours: ${independentHours}`
                      : 'Self-directed learning to complete outside contact sessions:',
                  size: FONT_SIZES.BODY,
                  font: FONT_FAMILY,
                  italics: true,
                  color: '4a5568',
                }),
              ],
              spacing: { after: 80, line: LINE_SPACING },
            }),
            ...this.createFormattedParagraphs(indepActs, { isBullet: true }),
            new Paragraph({ children: [], spacing: { after: 200 } })
          );
        }

        // Contact Activities (module-level summary, from step4) — complements
        // the per-lesson Activity Sequence tables above.
        const contactActs: string[] = Array.isArray(s4mod?.contactActivities)
          ? s4mod.contactActivities.filter((a: any) => typeof a === 'string' && a.trim())
          : [];
        if (contactActs.length) {
          contentChildren.push(
            this.createH3('Contact Activities (Module Summary)'),
            ...this.createFormattedParagraphs(contactActs, { isBullet: true }),
            new Paragraph({ children: [], spacing: { after: 200 } })
          );
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
                  this.createTableCell((deck.deckId || '-').replace(/^undefined-/, `${modCode}-`)),
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
   * Generate Step 12 (Assignment Packs) section
   */
  private async generateStep12Section(
    step12: any,
    contentChildren: any[],
    step4?: any
  ): Promise<void> {
    if (!step12) return;

    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      this.createH1('12. Assignment Packs')
    );

    // Validation summary
    if (step12.validation) {
      contentChildren.push(this.createH2('12.1 Validation Summary'));

      const validationRows = [
        new TableRow({
          children: [
            this.createTableCell('Validation Check', { bold: true, shading: 'E8F5E9' }),
            this.createTableCell('Result', { bold: true, shading: 'E8F5E9' }),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All Modules Have Assignments'),
            this.createTableCell(step12.validation.allModulesHaveAssignments ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All Variants Generated'),
            this.createTableCell(step12.validation.allVariantsGenerated ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All MLOs Covered'),
            this.createTableCell(step12.validation.allMLOsCovered ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All Rubrics Complete'),
            this.createTableCell(step12.validation.allRubricsComplete ? '✓ Pass' : '✗ Fail'),
          ],
        }),
      ];

      contentChildren.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: validationRows }),
        new Paragraph({ children: [], spacing: { after: 200 } })
      );
    }

    // Summary stats
    if (step12.summary) {
      contentChildren.push(this.createH2('12.2 Summary'));
      const summaryRows = [
        new TableRow({
          children: [
            this.createTableCell('Metric', { bold: true, shading: 'E8F5E9' }),
            this.createTableCell('Value', { bold: true, shading: 'E8F5E9' }),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Modules'),
            this.createTableCell(String(step12.summary.totalModules || 0)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Assignment Packs'),
            this.createTableCell(String(step12.summary.totalAssignmentPacks || 0)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Avg. Criteria per Rubric'),
            this.createTableCell(String(step12.summary.averageCriteriaPerRubric || 0)),
          ],
        }),
      ];

      contentChildren.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: summaryRows }),
        new Paragraph({ children: [], spacing: { after: 200 } })
      );
    }

    // Module assignment packs — rendered in Step 4 module order.
    if (step12.moduleAssignmentPacks?.length) {
      contentChildren.push(this.createH2('12.3 Module Assignment Packs'));

      const orderedPacks = this.orderModulesByStep4(step12.moduleAssignmentPacks, step4);
      for (const modulePack of orderedPacks) {
        contentChildren.push(
          this.createH3(`${modulePack.moduleCode || ''} — ${modulePack.moduleTitle || ''}`)
        );

        const variants: [string, any][] = [
          ['In-Person', modulePack.variants?.in_person],
          ['Self-Study', modulePack.variants?.self_study],
          ['Hybrid', modulePack.variants?.hybrid],
        ];

        for (const [variantLabel, variant] of variants) {
          if (!variant) continue;

          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Delivery Variant: ${variantLabel}`,
                  bold: true,
                  size: FONT_SIZES.H3,
                  font: FONT_FAMILY,
                }),
              ],
              spacing: { before: 200, after: 100, line: LINE_SPACING },
            })
          );

          // Overview table
          if (variant.overview) {
            const overviewRows = [
              new TableRow({
                children: [
                  this.createTableCell('Field', { bold: true, shading: 'FFF3E0' }),
                  this.createTableCell('Details', { bold: true, shading: 'FFF3E0' }),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Title'),
                  this.createTableCell(variant.overview.title || ''),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Assignment Type'),
                  this.createTableCell(variant.overview.assignmentType || ''),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Weighting'),
                  this.createTableCell(`${variant.overview.weighting || 0}%`),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Group/Individual'),
                  this.createTableCell(variant.overview.groupOrIndividual || ''),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Submission Format'),
                  this.createTableCell(variant.overview.submissionFormat || ''),
                ],
              }),
            ];

            contentChildren.push(
              new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: overviewRows }),
              new Paragraph({ children: [], spacing: { after: 100 } })
            );
          }

          // Brief
          if (variant.brief) {
            if (variant.brief.studentFacingIntro) {
              const formatted = await this.formatTextIntelligently(
                variant.brief.studentFacingIntro,
                'Assignment Brief Introduction'
              );
              if (formatted.paragraphs.length > 0) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: 'Brief:',
                        bold: true,
                        size: FONT_SIZES.BODY,
                        font: FONT_FAMILY,
                      }),
                    ],
                    spacing: { before: 100, after: 50, line: LINE_SPACING },
                  }),
                  ...this.createFormattedParagraphs(formatted.paragraphs)
                );
              }
            }

            if (variant.brief.deliverables?.length) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Deliverables:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                }),
                ...this.createFormattedParagraphs(variant.brief.deliverables, { isBullet: true })
              );
            }
          }

          // Rubric table
          if (variant.rubric?.length) {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Rubric:',
                    bold: true,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { before: 100, after: 50, line: LINE_SPACING },
              })
            );

            const rubricHeaderRow = new TableRow({
              children: [
                this.createTableCell('Criterion', { bold: true, shading: 'E3F2FD' }),
                this.createTableCell('Weight', { bold: true, shading: 'E3F2FD' }),
                this.createTableCell('Fail', { bold: true, shading: 'FFEBEE' }),
                this.createTableCell('Pass', { bold: true, shading: 'E8F5E9' }),
                this.createTableCell('Merit', { bold: true, shading: 'FFF3E0' }),
                this.createTableCell('Distinction', { bold: true, shading: 'E8EAF6' }),
              ],
            });

            const rubricDataRows = variant.rubric.map(
              (criterion: any) =>
                new TableRow({
                  children: [
                    this.createTableCell(criterion.criterionName || ''),
                    this.createTableCell(`${criterion.weight || 0}%`),
                    this.createTableCell(criterion.fail || ''),
                    this.createTableCell(criterion.pass || ''),
                    this.createTableCell(criterion.merit || ''),
                    this.createTableCell(criterion.distinction || ''),
                  ],
                })
            );

            contentChildren.push(
              new Table({
                width: { size: 100, type: WidthType.PERCENTAGE },
                rows: [rubricHeaderRow, ...rubricDataRows],
              }),
              new Paragraph({ children: [], spacing: { after: 100 } })
            );
          }

          // Evidence requirements
          if (variant.evidenceRequirements?.length) {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Evidence Requirements:',
                    bold: true,
                    size: FONT_SIZES.BODY,
                    font: FONT_FAMILY,
                  }),
                ],
                spacing: { before: 100, after: 50, line: LINE_SPACING },
              }),
              ...variant.evidenceRequirements.map(
                (ev: any) =>
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `• ${ev.artefactType || ''} — ${ev.wordCountOrDuration || ''} (${ev.fileType || ''})${ev.additionalNotes ? ': ' + ev.additionalNotes : ''}`,
                        font: FONT_FAMILY,
                        size: FONT_SIZES.BODY,
                      }),
                    ],
                    spacing: { line: LINE_SPACING, ...PARA_SPACING },
                  })
              )
            );
          }

          // Academic integrity
          if (variant.academicIntegrity) {
            const formatted = await this.formatTextIntelligently(
              variant.academicIntegrity,
              'Academic Integrity Statement'
            );
            if (formatted.paragraphs.length > 0) {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Academic Integrity:',
                      bold: true,
                      size: FONT_SIZES.BODY,
                      font: FONT_FAMILY,
                    }),
                  ],
                  spacing: { before: 100, after: 50, line: LINE_SPACING },
                }),
                ...this.createFormattedParagraphs(formatted.paragraphs)
              );
            }
          }

          contentChildren.push(new Paragraph({ children: [], spacing: { after: 200 } }));
        }

        // Spacing between modules
        contentChildren.push(new Paragraph({ children: [], spacing: { after: 400 } }));
      }
    }
  }

  /**
   * Generate Step 13 (Summative Exam) section
   */
  private async generateStep13Section(step13: any, contentChildren: any[]): Promise<void> {
    if (!step13) return;

    contentChildren.push(
      new Paragraph({ children: [new PageBreak()] }),
      this.createH1('13. Summative Exam')
    );

    // Exam overview
    if (step13.overview) {
      contentChildren.push(this.createH2('13.1 Exam Overview'));

      const overviewRows = [
        new TableRow({
          children: [
            this.createTableCell('Field', { bold: true, shading: 'E8EAF6' }),
            this.createTableCell('Details', { bold: true, shading: 'E8EAF6' }),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Exam Title'),
            this.createTableCell(step13.overview.examTitle || ''),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Marks'),
            this.createTableCell(String(step13.overview.totalMarks || 0)),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Duration'),
            this.createTableCell(step13.overview.totalDuration || step13.overview.duration || ''),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Permitted Materials'),
            this.createTableCell(step13.overview.permittedMaterials || ''),
          ],
        }),
      ];

      contentChildren.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: overviewRows }),
        new Paragraph({ children: [], spacing: { after: 200 } })
      );

      // Section breakdown table
      if (step13.overview.sectionBreakdown?.length) {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Section Breakdown:',
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
            ],
            spacing: { before: 100, after: 50, line: LINE_SPACING },
          })
        );

        const breakdownHeaderRow = new TableRow({
          children: [
            this.createTableCell('Section', { bold: true, shading: 'E8EAF6' }),
            this.createTableCell('Marks', { bold: true, shading: 'E8EAF6' }),
            this.createTableCell('Questions', { bold: true, shading: 'E8EAF6' }),
            this.createTableCell('Time Allocation', { bold: true, shading: 'E8EAF6' }),
          ],
        });

        const breakdownRows = step13.overview.sectionBreakdown.map(
          (s: any) =>
            new TableRow({
              children: [
                this.createTableCell(s.section || ''),
                this.createTableCell(String(s.marks || 0)),
                this.createTableCell(String(s.questionCount || 0)),
                this.createTableCell(s.timeAllocation || ''),
              ],
            })
        );

        contentChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [breakdownHeaderRow, ...breakdownRows],
          }),
          new Paragraph({ children: [], spacing: { after: 200 } })
        );
      }
    }

    // Section A: MCQ / Short Answer
    if (step13.sectionA?.length) {
      contentChildren.push(this.createH2('13.2 Section A — Multiple Choice & Short Answer'));

      for (let i = 0; i < step13.sectionA.length; i++) {
        const q = step13.sectionA[i];
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Q${i + 1}. ${q.questionText || ''}`,
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `  [${q.marks || 0} mark${(q.marks || 0) !== 1 ? 's' : ''} — ${q.type === 'mcq' ? 'MCQ' : 'Short Answer'}]`,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
                italics: true,
              }),
            ],
            spacing: { before: 150, after: 50, line: LINE_SPACING },
          })
        );

        // MCQ options
        if (q.type === 'mcq' && q.options?.length) {
          const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
          for (let j = 0; j < q.options.length; j++) {
            // Tick by text (canonical correctAnswer) OR index (correctOptionIndex
            // / legacy numeric correctAnswer).
            const isCorrect =
              q.options[j] === q.correctAnswer ||
              q.correctOptionIndex === j ||
              q.correctAnswer === j;
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `   ${optionLabels[j] || String(j + 1)}. ${q.options[j]}${isCorrect ? ' ✓' : ''}`,
                    font: FONT_FAMILY,
                    size: FONT_SIZES.BODY,
                    bold: isCorrect,
                  }),
                ],
                spacing: { line: LINE_SPACING, before: 20, after: 20 },
              })
            );
          }
        }

        // Correct answer (for short answer)
        if (q.type === 'short_answer' && q.correctAnswer) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Answer: ',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                }),
                new TextRun({ text: q.correctAnswer, font: FONT_FAMILY, size: FONT_SIZES.BODY }),
              ],
              spacing: { line: LINE_SPACING, before: 50, after: 50 },
            })
          );
        }

        // Rationale
        if (q.rationale) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Rationale: ',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                  italics: true,
                }),
                new TextRun({
                  text: q.rationale,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                  italics: true,
                }),
              ],
              spacing: { line: LINE_SPACING, before: 30, after: 100 },
            })
          );
        }
      }
    }

    // Section B: Scenario-Based (conditional)
    if (step13.sectionBIncluded && step13.sectionB?.length) {
      contentChildren.push(this.createH2('13.3 Section B — Scenario-Based Questions'));

      for (let i = 0; i < step13.sectionB.length; i++) {
        const scenario = step13.sectionB[i];
        contentChildren.push(
          this.createH3(`Scenario ${i + 1} (${scenario.totalMarks || 0} marks)`)
        );

        if (scenario.scenarioText) {
          const formatted = await this.formatTextIntelligently(
            scenario.scenarioText,
            'Exam Scenario'
          );
          if (formatted.paragraphs.length > 0) {
            contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
          }
        }

        if (scenario.workplaceContext) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Workplace Context: ',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                }),
                new TextRun({
                  text: scenario.workplaceContext,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                }),
              ],
              spacing: { line: LINE_SPACING, ...PARA_SPACING },
            })
          );
        }

        if (scenario.questions?.length) {
          for (let j = 0; j < scenario.questions.length; j++) {
            const sq = scenario.questions[j];
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `  ${String.fromCharCode(97 + j)}) ${sq.questionText || ''} [${sq.marks || 0} marks]`,
                    font: FONT_FAMILY,
                    size: FONT_SIZES.BODY,
                  }),
                ],
                spacing: { line: LINE_SPACING, before: 50, after: 30 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: '     Model Answer: ',
                    bold: true,
                    font: FONT_FAMILY,
                    size: FONT_SIZES.BODY,
                    italics: true,
                  }),
                  new TextRun({
                    text: sq.modelAnswer || '',
                    font: FONT_FAMILY,
                    size: FONT_SIZES.BODY,
                    italics: true,
                  }),
                ],
                spacing: { line: LINE_SPACING, before: 20, after: 80 },
              })
            );
          }
        }
      }
    }

    // Section C: Extended Tasks
    if (step13.sectionC?.length) {
      contentChildren.push(
        this.createH2(
          step13.sectionBIncluded
            ? '13.4 Section C — Extended Response Tasks'
            : '13.3 Section C — Extended Response Tasks'
        )
      );

      for (let i = 0; i < step13.sectionC.length; i++) {
        const task = step13.sectionC[i];
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Task ${i + 1}: ${task.taskDescription || ''}`,
                bold: true,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              }),
              new TextRun({
                text: `  [${task.marks || 0} marks]`,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
                italics: true,
              }),
            ],
            spacing: { before: 150, after: 50, line: LINE_SPACING },
          })
        );

        if (task.instructions?.length) {
          contentChildren.push(
            ...this.createFormattedParagraphs(task.instructions, { isNumbered: true })
          );
        }

        if (task.assessmentCriteria?.length) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Assessment Criteria:',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                }),
              ],
              spacing: { before: 80, after: 40, line: LINE_SPACING },
            }),
            ...this.createFormattedParagraphs(task.assessmentCriteria, { isBullet: true })
          );
        }

        if (task.modelAnswer) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Model Answer: ',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                  italics: true,
                }),
                new TextRun({
                  text: task.modelAnswer,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                  italics: true,
                }),
              ],
              spacing: { line: LINE_SPACING, before: 50, after: 150 },
            })
          );
        }
      }
    }

    // Marking Scheme
    if (step13.markingScheme) {
      const sectionNum = step13.sectionBIncluded ? '13.5' : '13.4';
      contentChildren.push(this.createH2(`${sectionNum} Marking Scheme`));

      // Section A marking
      if (step13.markingScheme.sectionA?.length) {
        contentChildren.push(this.createH3('Section A Marking'));
        const markingHeaderRow = new TableRow({
          children: [
            this.createTableCell('Q#', { bold: true, shading: 'E8EAF6' }),
            this.createTableCell('Model Answer', { bold: true, shading: 'E8EAF6' }),
            this.createTableCell('Mark Allocation', { bold: true, shading: 'E8EAF6' }),
          ],
        });

        const markingRows = step13.markingScheme.sectionA.map(
          (m: any, idx: number) =>
            new TableRow({
              children: [
                this.createTableCell(`Q${idx + 1}`),
                this.createTableCell(m.modelAnswer || ''),
                this.createTableCell(m.markAllocation || ''),
              ],
            })
        );

        contentChildren.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [markingHeaderRow, ...markingRows],
          }),
          new Paragraph({ children: [], spacing: { after: 200 } })
        );
      }

      // Section B marking
      if (step13.markingScheme.sectionB?.length) {
        contentChildren.push(this.createH3('Section B Marking'));
        for (const scenarioMark of step13.markingScheme.sectionB) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Scenario ${scenarioMark.scenarioId || ''}: ${scenarioMark.markAllocation || ''}`,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                }),
              ],
              spacing: { line: LINE_SPACING, ...PARA_SPACING },
            })
          );
        }
        contentChildren.push(new Paragraph({ children: [], spacing: { after: 200 } }));
      }

      // Section C marking
      if (step13.markingScheme.sectionC?.length) {
        contentChildren.push(this.createH3('Section C Marking'));
        for (const taskMark of step13.markingScheme.sectionC) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Task ${taskMark.taskId || ''}: ${taskMark.markAllocation || ''}`,
                  font: FONT_FAMILY,
                  size: FONT_SIZES.BODY,
                }),
              ],
              spacing: { line: LINE_SPACING, ...PARA_SPACING },
            })
          );
          if (taskMark.modelAnswer) {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Model Answer: ',
                    bold: true,
                    font: FONT_FAMILY,
                    size: FONT_SIZES.BODY,
                    italics: true,
                  }),
                  new TextRun({
                    text: taskMark.modelAnswer,
                    font: FONT_FAMILY,
                    size: FONT_SIZES.BODY,
                    italics: true,
                  }),
                ],
                spacing: { line: LINE_SPACING, before: 30, after: 80 },
              })
            );
          }
        }
        contentChildren.push(new Paragraph({ children: [], spacing: { after: 200 } }));
      }
    }

    // Integrity & Security
    if (step13.integrityAndSecurity) {
      const sectionNum = step13.sectionBIncluded ? '13.6' : '13.5';
      contentChildren.push(this.createH2(`${sectionNum} Integrity & Security`));
      const formatted = await this.formatTextIntelligently(
        step13.integrityAndSecurity,
        'Exam Integrity and Security'
      );
      if (formatted.paragraphs.length > 0) {
        contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
      }
    }

    // Accessibility
    if (step13.accessibilityProvisions) {
      const sectionNum = step13.sectionBIncluded ? '13.7' : '13.6';
      contentChildren.push(this.createH2(`${sectionNum} Accessibility Provisions`));
      const formatted = await this.formatTextIntelligently(
        step13.accessibilityProvisions,
        'Exam Accessibility Provisions'
      );
      if (formatted.paragraphs.length > 0) {
        contentChildren.push(...this.createFormattedParagraphs(formatted.paragraphs));
      }
    }

    // Validation summary
    if (step13.validation) {
      const sectionNum = step13.sectionBIncluded ? '13.8' : '13.7';
      contentChildren.push(this.createH2(`${sectionNum} Validation`));

      const validationRows = [
        new TableRow({
          children: [
            this.createTableCell('Check', { bold: true, shading: 'E8EAF6' }),
            this.createTableCell('Result', { bold: true, shading: 'E8EAF6' }),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Total Marks Correct'),
            this.createTableCell(step13.validation.totalMarksCorrect ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All Sections Present'),
            this.createTableCell(step13.validation.allSectionsPresent ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('All PLOs Covered'),
            this.createTableCell(step13.validation.allPLOsCovered ? '✓ Pass' : '✗ Fail'),
          ],
        }),
        new TableRow({
          children: [
            this.createTableCell('Marking Scheme Complete'),
            this.createTableCell(step13.validation.markingSchemeComplete ? '✓ Pass' : '✗ Fail'),
          ],
        }),
      ];

      contentChildren.push(
        new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: validationRows })
      );
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
      workflow.step11,
      workflow.step12,
      workflow.step13,
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

    // Step names for progress reporting
    const stepNames: Record<number, string> = {
      1: 'Program Foundation',
      2: 'Competency Framework',
      3: 'Program Learning Outcomes',
      4: 'Course Structure & MLOs',
      5: 'Academic Sources',
      6: 'Reading Lists',
      7: 'Assessment Package',
      8: 'Case Studies',
      9: 'Glossary',
      10: 'Lesson Plans',
      11: 'PowerPoints',
      12: 'Assignment Packs',
      13: 'Summative Exam',
    };

    // Each step section renders into its own children array so the
    // per-section OpenAI reflow calls run concurrently rather than one
    // step after another. Promise.all preserves input order, so the
    // arrays are concatenated back in document order afterwards. The
    // rendered document is byte-identical to the sequential version.
    const sectionBuilders: Array<{ step: number; build: (out: any[]) => Promise<void> }> = [];
    const addSection = (step: number, build: (out: any[]) => Promise<void>) => {
      sectionBuilders.push({ step, build });
    };

    if (workflow.step1) {
      addSection(1, (out) => this.generateStep1Section(workflow.step1, out));
    }
    if (workflow.step2) {
      addSection(2, (out) => this.generateStep2Section(workflow.step2, out));
    }
    if (workflow.step3?.outcomes?.length) {
      addSection(3, (out) => this.generateStep3Section(workflow.step3, out, kscMap));
    }
    if (workflow.step4?.modules?.length) {
      addSection(4, (out) => this.generateStep4Section(workflow.step4, out, kscMap));
    }
    if (workflow.step5?.sources?.length) {
      addSection(5, (out) => this.generateStep5Section(workflow.step5, out));
    }
    if (workflow.step6) {
      addSection(6, (out) => this.generateStep6Section(workflow.step6, out));
    }
    if (
      workflow.step7?.formativeAssessments?.length ||
      workflow.step7?.summativeAssessments?.length ||
      workflow.step7?.sampleQuestions
    ) {
      addSection(7, (out) => this.generateStep7Section(workflow.step7, out));
    }
    if (workflow.step8?.caseStudies?.length) {
      addSection(8, (out) => this.generateStep8Section(workflow.step8, out));
    }
    if (workflow.step9?.terms?.length || workflow.step9?.glossaryTerms?.length) {
      addSection(9, (out) => this.generateStep9Section(workflow.step9, out));
    }
    if (workflow.step10) {
      addSection(10, (out) => this.generateStep10Section(workflow.step10, out, workflow.step4));
    }
    if (workflow.step11) {
      addSection(11, (out) => this.generateStep11Section(workflow.step11, out));
    }
    if (workflow.step12) {
      addSection(12, (out) => this.generateStep12Section(workflow.step12, out, workflow.step4));
    }
    if (workflow.step13) {
      addSection(13, (out) => this.generateStep13Section(workflow.step13, out));
    }

    const sectionResults = await Promise.all(
      sectionBuilders.map(async ({ step, build }) => {
        reportProgress(
          `Step ${step}: ${stepNames[step]}`,
          `Formatting ${stepNames[step].toLowerCase()}...`
        );
        const children: any[] = [];
        await build(children);
        sectionsCompleted++;
        reportProgress(
          `Step ${step}: ${stepNames[step]}`,
          `✓ Step ${step} formatted (${sectionsCompleted}/${totalSections})`
        );
        return children;
      })
    );
    for (const children of sectionResults) {
      for (const child of children) contentChildren.push(child);
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

  /**
   * Filter module-level step data to a single module by index
   */
  private filterStepForModule(stepData: any, moduleArrayKey: string, moduleIndex: number): any {
    if (!stepData || !stepData[moduleArrayKey]) return stepData;
    const modules = stepData[moduleArrayKey];
    if (!Array.isArray(modules) || moduleIndex < 0 || moduleIndex >= modules.length) {
      return stepData;
    }
    return { ...stepData, [moduleArrayKey]: [modules[moduleIndex]] };
  }

  /**
   * Generate a standalone Word document for a single step
   */
  async generateStepDocument(
    workflow: WorkflowData,
    stepNumber: number,
    options?: { moduleIndex?: number }
  ): Promise<Buffer> {
    const STEP_TITLES: Record<number, string> = {
      1: 'Program Foundation',
      2: 'Competency Framework (KSC)',
      3: 'Program Learning Outcomes',
      4: 'Course Structure & MLOs',
      5: 'Academic Sources',
      6: 'Reading Lists',
      7: 'Assessment Package',
      8: 'Case Studies',
      9: 'Glossary',
      10: 'Lesson Plans',
      11: 'PowerPoint Decks',
      12: 'Assignment Packs',
      13: 'Summative Exam',
    };

    const stepTitle = STEP_TITLES[stepNumber] || `Step ${stepNumber}`;
    const step1 = workflow.step1 || {};
    const programTitle = step1.programTitle || workflow.projectName || 'Curriculum';

    // Build KSC map if needed for steps 3 and 4
    const kscMap =
      (stepNumber === 3 || stepNumber === 4) && workflow.step2
        ? this.buildKSCMap(workflow.step2)
        : new Map<string, string>();

    // For a per-module export (steps 10-12) label the cover with the ACTUAL
    // module's code/title, not its positional index — the module arrays can be
    // out of order, so "Module {index+1}" mislabelled files (a "Module 6" file
    // could contain Module 8's content).
    let moduleLabel = '';
    if (options?.moduleIndex !== undefined) {
      const moduleArrayKeys: Record<number, string> = {
        10: 'moduleLessonPlans',
        11: 'modulePPTDecks',
        12: 'moduleAssignmentPacks',
      };
      const arrKey = moduleArrayKeys[stepNumber];
      const mod = arrKey
        ? ((workflow as any)[`step${stepNumber}`]?.[arrKey] || [])[options.moduleIndex]
        : undefined;
      const code = mod?.moduleCode || mod?.code || '';
      const title = mod?.moduleTitle || mod?.title || '';
      moduleLabel = [code, title].filter(Boolean).join(': ') || `Module ${options.moduleIndex + 1}`;
    }

    // Mini title page
    const titleSection = {
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: programTitle,
              bold: true,
              size: 48,
              font: FONT_FAMILY,
              color: '1a365d',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 2000, after: 300 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: stepTitle,
              size: 36,
              font: FONT_FAMILY,
              color: '4a5568',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        ...(options?.moduleIndex !== undefined
          ? [
              new Paragraph({
                children: [
                  new TextRun({
                    text: moduleLabel,
                    size: 28,
                    font: FONT_FAMILY,
                    color: '718096',
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
            ]
          : []),
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
          spacing: { before: 1000 },
        }),
      ],
    };

    // Content section
    const contentChildren: any[] = [];
    const stepKey = `step${stepNumber}` as keyof WorkflowData;
    let stepData = workflow[stepKey];

    if (!stepData) {
      // Return a document with just the title page if no data
      const doc = new Document({ sections: [titleSection] });
      return await Packer.toBuffer(doc);
    }

    // Filter for module-level exports (steps 10-12)
    if (options?.moduleIndex !== undefined) {
      const moduleArrayKeys: Record<number, string> = {
        10: 'moduleLessonPlans',
        11: 'modulePPTDecks',
        12: 'moduleAssignmentPacks',
      };
      const arrayKey = moduleArrayKeys[stepNumber];
      if (arrayKey) {
        stepData = this.filterStepForModule(stepData, arrayKey, options.moduleIndex);
      }
    }

    // Call the appropriate section generator
    switch (stepNumber) {
      case 1:
        await this.generateStep1Section(stepData, contentChildren);
        break;
      case 2:
        await this.generateStep2Section(stepData, contentChildren);
        break;
      case 3:
        await this.generateStep3Section(stepData, contentChildren, kscMap);
        break;
      case 4:
        await this.generateStep4Section(stepData, contentChildren, kscMap);
        break;
      case 5:
        await this.generateStep5Section(stepData, contentChildren);
        break;
      case 6:
        await this.generateStep6Section(stepData, contentChildren);
        break;
      case 7:
        await this.generateStep7Section(stepData, contentChildren);
        break;
      case 8:
        await this.generateStep8Section(stepData, contentChildren);
        break;
      case 9:
        await this.generateStep9Section(stepData, contentChildren);
        break;
      case 10:
        await this.generateStep10Section(stepData, contentChildren, workflow.step4);
        break;
      case 11:
        await this.generateStep11Section(stepData, contentChildren);
        break;
      case 12:
        await this.generateStep12Section(stepData, contentChildren, workflow.step4);
        break;
      case 13:
        await this.generateStep13Section(stepData, contentChildren);
        break;
    }

    const doc = new Document({
      sections: [titleSection, { properties: {}, children: contentChildren }],
    });

    return await Packer.toBuffer(doc);
  }
}

// Export singleton instance
export const wordExportService = new WordExportService();
