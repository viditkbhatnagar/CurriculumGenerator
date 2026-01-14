/**
 * Standalone Word Export Service
 *
 * Generates Word documents for standalone step execution outputs.
 * Handles markdown-formatted content and converts it to proper Word formatting.
 *
 * Requirements: 6.2, 6.3, 6.4, 6.5
 */

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
  HeadingLevel,
  BorderStyle,
  convertInchesToTwip,
} from 'docx';
import { loggingService } from './loggingService';

// Font specifications
const FONT_FAMILY = 'Arial';
const FONT_SIZES = {
  TITLE: 48,    // 24pt
  H1: 32,       // 16pt
  H2: 28,       // 14pt
  H3: 24,       // 12pt
  BODY: 22,     // 11pt
  TABLE: 20,    // 10pt
};

// Line spacing
const LINE_SPACING = 276; // 1.15 line spacing

// Paragraph spacing
const PARA_SPACING = {
  before: 120,
  after: 120,
};

export interface StandaloneExportData {
  stepNumber: number;
  stepName: string;
  description: string;
  content: any; // Can be string (markdown) or object (legacy JSON)
}

class StandaloneWordExportService {
  /**
   * Generate a Word document for standalone step output
   * Requirements: 6.2, 6.3, 6.4, 6.5
   */
  async generateStepDocument(data: StandaloneExportData): Promise<Buffer> {
    try {
      const children: Paragraph[] = [];

      // Title page with step name (Requirement 6.3)
      children.push(
        this.createTitle(data.stepName),
        this.createSubtitle(`Step ${data.stepNumber}`),
        this.createGeneratedDate()
      );

      // User description section (Requirement 6.4)
      if (data.description) {
        children.push(
          this.createH1('Context'),
          this.createParagraph(data.description)
        );
      }

      // Content section - formatted appropriately (Requirement 6.5)
      children.push(this.createH1('Generated Content'));
      
      // Check if content is a string (new markdown format) or object (legacy JSON)
      let contentParagraphs: Paragraph[];
      if (typeof data.content === 'string') {
        // New format: Parse markdown string
        contentParagraphs = this.parseMarkdownContent(data.content);
      } else {
        // Legacy format: Use step-specific formatters
        contentParagraphs = await this.formatStepContent(data.stepNumber, data.content);
      }
      
      children.push(...contentParagraphs);

      // Create document
      const doc = new Document({
        sections: [
          {
            properties: {
              page: {
                margin: {
                  top: convertInchesToTwip(1),
                  bottom: convertInchesToTwip(1),
                  left: convertInchesToTwip(1),
                  right: convertInchesToTwip(1),
                },
              },
            },
            children,
          },
        ],
      });

      // Generate buffer (Requirement 6.2)
      const buffer = await Packer.toBuffer(doc);
      return buffer;
    } catch (error) {
      loggingService.error('Error generating standalone Word document', { error });
      throw error;
    }
  }

  /**
   * Parse markdown content and convert to Word paragraphs
   * This is the main method for handling the new human-readable format
   */
  private parseMarkdownContent(content: string): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    const lines = content.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Skip empty lines
      if (!line) {
        i++;
        continue;
      }

      // Skip horizontal rules
      if (line === '---' || line === '***' || line === '___') {
        paragraphs.push(this.createHorizontalRule());
        i++;
        continue;
      }

      // Handle headers
      if (line.startsWith('# ')) {
        paragraphs.push(this.createTitle(line.substring(2)));
        i++;
        continue;
      }
      
      if (line.startsWith('## ')) {
        paragraphs.push(this.createH1(line.substring(3)));
        i++;
        continue;
      }
      
      if (line.startsWith('### ')) {
        paragraphs.push(this.createH2(line.substring(4)));
        i++;
        continue;
      }
      
      if (line.startsWith('#### ')) {
        paragraphs.push(this.createH3(line.substring(5)));
        i++;
        continue;
      }

      // Handle bullet points
      if (line.startsWith('- ') || line.startsWith('* ')) {
        paragraphs.push(this.createBulletParagraph(this.parseInlineFormatting(line.substring(2))));
        i++;
        continue;
      }

      // Handle numbered lists
      const numberedMatch = line.match(/^(\d+)\.\s+(.+)$/);
      if (numberedMatch) {
        paragraphs.push(this.createNumberedParagraph(numberedMatch[1], this.parseInlineFormatting(numberedMatch[2])));
        i++;
        continue;
      }

      // Handle tables (simple markdown tables)
      if (line.startsWith('|') && line.endsWith('|')) {
        const tableLines: string[] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        const tableParagraphs = this.parseTable(tableLines);
        paragraphs.push(...tableParagraphs);
        continue;
      }

      // Handle blockquotes
      if (line.startsWith('>')) {
        paragraphs.push(this.createQuoteParagraph(line.substring(1).trim()));
        i++;
        continue;
      }

      // Regular paragraph with inline formatting
      paragraphs.push(this.createFormattedParagraph(line));
      i++;
    }

    return paragraphs;
  }

  /**
   * Parse inline formatting (bold, italic) and return TextRun array
   */
  private parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      // Check for bold (**text**)
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
      if (boldMatch) {
        runs.push(new TextRun({
          text: boldMatch[1],
          bold: true,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }));
        remaining = remaining.substring(boldMatch[0].length);
        continue;
      }

      // Check for italic (*text* or _text_)
      const italicMatch = remaining.match(/^\*(.+?)\*/) || remaining.match(/^_(.+?)_/);
      if (italicMatch) {
        runs.push(new TextRun({
          text: italicMatch[1],
          italics: true,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }));
        remaining = remaining.substring(italicMatch[0].length);
        continue;
      }

      // Check for inline code (`text`)
      const codeMatch = remaining.match(/^`(.+?)`/);
      if (codeMatch) {
        runs.push(new TextRun({
          text: codeMatch[1],
          size: FONT_SIZES.BODY,
          font: 'Courier New',
          color: '333333',
        }));
        remaining = remaining.substring(codeMatch[0].length);
        continue;
      }

      // Find next special character
      const nextSpecial = remaining.search(/[\*_`]/);
      if (nextSpecial === -1) {
        // No more special characters
        runs.push(new TextRun({
          text: remaining,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }));
        break;
      } else if (nextSpecial === 0) {
        // Special character at start but not matched - treat as regular text
        runs.push(new TextRun({
          text: remaining.charAt(0),
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }));
        remaining = remaining.substring(1);
      } else {
        // Regular text before special character
        runs.push(new TextRun({
          text: remaining.substring(0, nextSpecial),
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }));
        remaining = remaining.substring(nextSpecial);
      }
    }

    return runs.length > 0 ? runs : [new TextRun({ text: text, size: FONT_SIZES.BODY, font: FONT_FAMILY })];
  }

  /**
   * Create a paragraph with inline formatting
   */
  private createFormattedParagraph(text: string): Paragraph {
    return new Paragraph({
      children: this.parseInlineFormatting(text),
      spacing: {
        ...PARA_SPACING,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Parse a markdown table into paragraphs (simplified - creates formatted text)
   */
  private parseTable(tableLines: string[]): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    
    if (tableLines.length < 2) return paragraphs;

    // Skip separator line (usually second line with dashes)
    const dataLines = tableLines.filter(line => !line.match(/^\|[\s\-:|]+\|$/));

    for (const line of dataLines) {
      const cells = line.split('|')
        .map(cell => cell.trim())
        .filter(cell => cell.length > 0);
      
      if (cells.length > 0) {
        // First line is usually header
        if (dataLines.indexOf(line) === 0) {
          paragraphs.push(this.createBoldParagraph(cells.join('  |  ')));
        } else {
          paragraphs.push(this.createParagraph(cells.join('  |  ')));
        }
      }
    }

    return paragraphs;
  }

  /**
   * Create a horizontal rule paragraph
   */
  private createHorizontalRule(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: '─'.repeat(80),
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
          color: 'cccccc',
        }),
      ],
      spacing: { before: 200, after: 200 },
    });
  }

  /**
   * Create a numbered list paragraph
   */
  private createNumberedParagraph(number: string, textRuns: TextRun[]): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `${number}. `,
          bold: true,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }),
        ...textRuns,
      ],
      spacing: {
        after: 80,
        line: LINE_SPACING,
      },
      indent: {
        left: convertInchesToTwip(0.25),
      },
    });
  }

  /**
   * Create a quote paragraph
   */
  private createQuoteParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `"${text}"`,
          italics: true,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
          color: '666666',
        }),
      ],
      spacing: {
        before: 150,
        after: 150,
        line: LINE_SPACING,
      },
      indent: {
        left: convertInchesToTwip(0.5),
      },
    });
  }

  /**
   * Format content based on step type (LEGACY - for JSON content)
   */
  private async formatStepContent(stepNumber: number, content: any): Promise<Paragraph[]> {
    switch (stepNumber) {
      case 2:
        return this.formatKSCContent(content);
      case 3:
        return this.formatPLOContent(content);
      case 4:
        return this.formatCourseFrameworkContent(content);
      case 5:
        return this.formatSourcesContent(content);
      case 6:
        return this.formatReadingListContent(content);
      case 7:
        return this.formatAssessmentContent(content);
      case 8:
        return this.formatCaseStudyContent(content);
      case 9:
        return this.formatGlossaryContent(content);
      case 10:
        return this.formatLessonPlanContent(content);
      default:
        return this.formatGenericContent(content);
    }
  }

  /**
   * Step 2: Format KSC Framework content (LEGACY)
   */
  private formatKSCContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Summary
    const totalItems = (content.knowledgeItems?.length || 0) + 
                       (content.skillItems?.length || 0) + 
                       (content.competencyItems?.length || 0);
    paragraphs.push(
      this.createParagraph(`Total KSC Items: ${totalItems}`)
    );

    // Knowledge Items
    if (content.knowledgeItems?.length > 0) {
      paragraphs.push(this.createH2('Knowledge Items'));
      content.knowledgeItems.forEach((item: any, index: number) => {
        paragraphs.push(
          this.createBoldParagraph(`${item.id || `K${index + 1}`}: ${item.statement}`),
          this.createParagraph(item.description || ''),
          this.createItalicParagraph(`Importance: ${item.importance || 'N/A'} | Source: ${item.source || 'N/A'}`)
        );
      });
    }

    // Skill Items
    if (content.skillItems?.length > 0) {
      paragraphs.push(this.createH2('Skill Items'));
      content.skillItems.forEach((item: any, index: number) => {
        paragraphs.push(
          this.createBoldParagraph(`${item.id || `S${index + 1}`}: ${item.statement}`),
          this.createParagraph(item.description || ''),
          this.createItalicParagraph(`Importance: ${item.importance || 'N/A'} | Source: ${item.source || 'N/A'}`)
        );
      });
    }

    // Competency Items
    if (content.competencyItems?.length > 0) {
      paragraphs.push(this.createH2('Competency Items'));
      content.competencyItems.forEach((item: any, index: number) => {
        paragraphs.push(
          this.createBoldParagraph(`${item.id || `C${index + 1}`}: ${item.statement}`),
          this.createParagraph(item.description || ''),
          this.createItalicParagraph(`Importance: ${item.importance || 'N/A'} | Source: ${item.source || 'N/A'}`)
        );
      });
    }

    return paragraphs;
  }

  /**
   * Step 3: Format PLO content (LEGACY)
   */
  private formatPLOContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (content.bloomDistribution) {
      paragraphs.push(this.createH2("Bloom's Taxonomy Distribution"));
      const distribution = Object.entries(content.bloomDistribution)
        .map(([level, count]) => `${level}: ${count}`)
        .join(' | ');
      paragraphs.push(this.createParagraph(distribution));
    }

    if (content.outcomes?.length > 0) {
      paragraphs.push(this.createH2('Program Learning Outcomes'));
      content.outcomes.forEach((plo: any) => {
        paragraphs.push(
          this.createBoldParagraph(`${plo.code || plo.id}: ${plo.statement}`),
          this.createItalicParagraph(
            `Bloom Level: ${plo.bloomLevel} | Verb: ${plo.verb} | Measurable: ${plo.measurable ? 'Yes' : 'No'}`
          )
        );
        if (plo.assessmentAlignment) {
          paragraphs.push(this.createParagraph(`Assessment: ${plo.assessmentAlignment}`));
        }
      });
    }

    return paragraphs;
  }

  /**
   * Step 4: Format Course Framework content (LEGACY)
   */
  private formatCourseFrameworkContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    paragraphs.push(
      this.createParagraph(`Total Hours: ${content.totalHours || 0}`)
    );

    if (content.modules?.length > 0) {
      content.modules.forEach((module: any) => {
        paragraphs.push(
          this.createH2(`${module.moduleCode}: ${module.title}`),
          this.createParagraph(module.description || ''),
          this.createItalicParagraph(
            `Contact Hours: ${module.contactHours || 0} | Independent Hours: ${module.independentHours || 0} | Total: ${module.totalHours || 0}`
          )
        );

        if (module.mlos?.length > 0) {
          paragraphs.push(this.createH3('Module Learning Outcomes'));
          module.mlos.forEach((mlo: any) => {
            paragraphs.push(
              this.createBulletParagraph([new TextRun({
                text: `${mlo.id}: ${mlo.statement} (${mlo.bloomLevel})`,
                size: FONT_SIZES.BODY,
                font: FONT_FAMILY,
              })])
            );
          });
        }

        if (module.topics?.length > 0) {
          paragraphs.push(this.createH3('Topics'));
          module.topics.forEach((topic: string) => {
            paragraphs.push(this.createBulletParagraph([new TextRun({
              text: topic,
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
            })]));
          });
        }
      });
    }

    return paragraphs;
  }

  /**
   * Step 5: Format Sources content (LEGACY)
   */
  private formatSourcesContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (content.sources?.length > 0) {
      paragraphs.push(
        this.createParagraph(`Total Sources: ${content.sources.length}`)
      );

      content.sources.forEach((source: any, index: number) => {
        paragraphs.push(
          this.createBoldParagraph(`Source ${index + 1}`),
          this.createParagraph(source.apaCitation || `${source.authors} (${source.year}). ${source.title}. ${source.publisher}.`),
          this.createItalicParagraph(`Type: ${source.sourceType || 'N/A'} | Recent: ${source.isRecent ? 'Yes' : 'No'}`)
        );
        if (source.doi) {
          paragraphs.push(this.createParagraph(`DOI: ${source.doi}`));
        }
      });
    }

    return paragraphs;
  }

  /**
   * Step 6: Format Reading List content (LEGACY)
   */
  private formatReadingListContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (content.coreReadings?.length > 0) {
      paragraphs.push(this.createH2('Core Readings'));
      content.coreReadings.forEach((reading: any) => {
        paragraphs.push(
          this.createBulletParagraph([new TextRun({
            text: reading.citation,
            size: FONT_SIZES.BODY,
            font: FONT_FAMILY,
          })]),
          this.createItalicParagraph(`Est. Time: ${reading.estimatedMinutes || 0} min | Complexity: ${reading.complexityLevel || 'N/A'}`)
        );
      });
    }

    if (content.supplementaryReadings?.length > 0) {
      paragraphs.push(this.createH2('Supplementary Readings'));
      content.supplementaryReadings.forEach((reading: any) => {
        paragraphs.push(
          this.createBulletParagraph([new TextRun({
            text: reading.citation,
            size: FONT_SIZES.BODY,
            font: FONT_FAMILY,
          })]),
          this.createItalicParagraph(`Est. Time: ${reading.estimatedMinutes || 0} min | Complexity: ${reading.complexityLevel || 'N/A'}`)
        );
      });
    }

    return paragraphs;
  }

  /**
   * Step 7: Format Assessment content (LEGACY)
   */
  private formatAssessmentContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (content.formativeAssessments?.length > 0) {
      paragraphs.push(this.createH2('Formative Assessments'));
      content.formativeAssessments.forEach((assessment: any) => {
        paragraphs.push(
          this.createBoldParagraph(`${assessment.title} (${assessment.type})`),
          this.createParagraph(assessment.description || '')
        );
      });
    }

    if (content.summativeAssessments?.length > 0) {
      paragraphs.push(this.createH2('Summative Assessments'));
      content.summativeAssessments.forEach((assessment: any) => {
        paragraphs.push(
          this.createBoldParagraph(`${assessment.title} (${assessment.type})`),
          this.createParagraph(assessment.description || '')
        );
      });
    }

    if (content.questionBank?.length > 0) {
      paragraphs.push(this.createH2('Question Bank'));
      content.questionBank.forEach((question: any, index: number) => {
        paragraphs.push(
          this.createBoldParagraph(`Question ${index + 1}: ${question.stem}`),
          this.createItalicParagraph(`Bloom Level: ${question.bloomLevel || 'N/A'} | Difficulty: ${question.difficulty || 'N/A'}`)
        );
        
        if (question.options?.length > 0) {
          question.options.forEach((option: any) => {
            const marker = option.isCorrect ? '✓' : '○';
            paragraphs.push(
              this.createParagraph(`  ${marker} ${option.label}. ${option.text}`)
            );
          });
        }
        
        if (question.rationale) {
          paragraphs.push(
            this.createItalicParagraph(`Rationale: ${question.rationale}`)
          );
        }
      });
    }

    return paragraphs;
  }

  /**
   * Step 8: Format Case Study content (LEGACY)
   */
  private formatCaseStudyContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (content.caseStudies?.length > 0) {
      content.caseStudies.forEach((caseStudy: any, index: number) => {
        paragraphs.push(
          this.createH2(`Case Study ${index + 1}: ${caseStudy.title}`),
          this.createItalicParagraph(
            `Industry: ${caseStudy.industryContext || 'N/A'} | Organization: ${caseStudy.organizationName || 'N/A'} | Difficulty: ${caseStudy.difficultyLevel || 'N/A'}`
          ),
          this.createH3('Scenario'),
          this.createParagraph(caseStudy.scenario || '')
        );
      });
    }

    return paragraphs;
  }

  /**
   * Step 9: Format Glossary content (LEGACY)
   */
  private formatGlossaryContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    paragraphs.push(
      this.createParagraph(`Total Terms: ${content.totalTerms || content.terms?.length || 0}`)
    );

    if (content.terms?.length > 0) {
      content.terms.forEach((term: any) => {
        paragraphs.push(
          this.createBoldParagraph(term.term),
          this.createParagraph(term.definition || '')
        );
        if (term.exampleSentence) {
          paragraphs.push(
            this.createItalicParagraph(`Example: ${term.exampleSentence}`)
          );
        }
        if (term.relatedTerms?.length > 0) {
          paragraphs.push(
            this.createItalicParagraph(`Related: ${term.relatedTerms.join(', ')}`)
          );
        }
      });
    }

    return paragraphs;
  }

  /**
   * Step 10: Format Lesson Plan content (LEGACY)
   */
  private formatLessonPlanContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    if (content.lessonPlans?.length > 0) {
      content.lessonPlans.forEach((lesson: any, index: number) => {
        paragraphs.push(
          this.createH2(`Lesson ${index + 1}: ${lesson.title}`),
          this.createItalicParagraph(`Duration: ${lesson.duration || 0} minutes`)
        );

        if (lesson.objectives?.length > 0) {
          paragraphs.push(this.createH3('Learning Objectives'));
          lesson.objectives.forEach((obj: string) => {
            paragraphs.push(this.createBulletParagraph([new TextRun({
              text: obj,
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
            })]));
          });
        }

        if (lesson.activities?.length > 0) {
          paragraphs.push(this.createH3('Activities'));
          lesson.activities.forEach((activity: string) => {
            paragraphs.push(this.createBulletParagraph([new TextRun({
              text: activity,
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
            })]));
          });
        }

        if (lesson.materials?.length > 0) {
          paragraphs.push(this.createH3('Materials'));
          lesson.materials.forEach((material: string) => {
            paragraphs.push(this.createBulletParagraph([new TextRun({
              text: material,
              size: FONT_SIZES.BODY,
              font: FONT_FAMILY,
            })]));
          });
        }

        if (lesson.assessment) {
          paragraphs.push(
            this.createH3('Assessment'),
            this.createParagraph(lesson.assessment)
          );
        }
      });
    }

    return paragraphs;
  }

  /**
   * Format generic content (fallback)
   */
  private formatGenericContent(content: any): Paragraph[] {
    const paragraphs: Paragraph[] = [];
    
    if (typeof content === 'string') {
      // If it's a string, try to parse it as markdown
      return this.parseMarkdownContent(content);
    } else {
      paragraphs.push(
        this.createParagraph(JSON.stringify(content, null, 2))
      );
    }

    return paragraphs;
  }


  // ============================================================================
  // HELPER METHODS FOR CREATING DOCUMENT ELEMENTS
  // ============================================================================

  /**
   * Create title paragraph
   */
  private createTitle(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: FONT_SIZES.TITLE,
          font: FONT_FAMILY,
          color: '1a365d',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 },
    });
  }

  /**
   * Create subtitle paragraph
   */
  private createSubtitle(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          size: FONT_SIZES.H1,
          font: FONT_FAMILY,
          color: '4a5568',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    });
  }

  /**
   * Create generated date paragraph
   */
  private createGeneratedDate(): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: `Generated: ${new Date().toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}`,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
          color: '718096',
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    });
  }

  /**
   * Create H1 heading
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
   * Create H2 heading
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
        before: 300,
        after: 150,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Create H3 heading
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
        before: 200,
        after: 100,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Create regular paragraph
   */
  private createParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }),
      ],
      spacing: {
        ...PARA_SPACING,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Create bold paragraph
   */
  private createBoldParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          bold: true,
          size: FONT_SIZES.BODY,
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
   * Create italic paragraph
   */
  private createItalicParagraph(text: string): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text,
          italics: true,
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
          color: '4a5568',
        }),
      ],
      spacing: {
        after: 100,
        line: LINE_SPACING,
      },
    });
  }

  /**
   * Create bullet point paragraph (accepts TextRun array for formatted content)
   */
  private createBulletParagraph(textRuns: TextRun[]): Paragraph {
    return new Paragraph({
      children: [
        new TextRun({
          text: '• ',
          size: FONT_SIZES.BODY,
          font: FONT_FAMILY,
        }),
        ...textRuns,
      ],
      spacing: {
        after: 80,
        line: LINE_SPACING,
      },
      indent: {
        left: convertInchesToTwip(0.25),
      },
    });
  }
}

// Singleton instance
export const standaloneWordExportService = new StandaloneWordExportService();
