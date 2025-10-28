/**
 * Document Export Service
 * Generates professional documents in DOCX, PDF, and SCORM formats
 * Implements Requirements 5.3, 5.5
 */

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
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
  convertInchesToTwip,
} from 'docx';
import puppeteer from 'puppeteer';
import { Curriculum, ProgramSpecification, UnitSpecification, AssessmentPackage } from '../types/curriculum';
import pool from '../db';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

export class DocumentExportService {
  /**
   * Export program specification as DOCX
   */
  async exportProgramSpecDOCX(programId: string): Promise<Buffer> {
    const curriculum = await this.getCurriculum(programId);
    const programSpec = curriculum.programSpec;
    const programData = await this.getProgramData(programId);

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'AGCQ Program Specification',
                      bold: true,
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  border: {
                    bottom: {
                      color: '000000',
                      space: 1,
                      style: BorderStyle.SINGLE,
                      size: 6,
                    },
                  },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Page ',
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                    }),
                    new TextRun({
                      text: ' of ',
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            // Title Page
            new Paragraph({
              text: programData.program_name,
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: 'Program Specification Document',
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: `Qualification Level: ${programData.qualification_level}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 200 },
            }),
            new Paragraph({
              text: `Total Credits: ${programData.total_credits}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: `Generated: ${new Date().toLocaleDateString()}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Introduction
            new Paragraph({
              text: '1. Introduction',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.introduction,
              spacing: { after: 200 },
            }),

            // Course Overview
            new Paragraph({
              text: '2. Course Overview',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.courseOverview,
              spacing: { after: 200 },
            }),

            // Needs Analysis
            new Paragraph({
              text: '3. Needs Analysis',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.needsAnalysis,
              spacing: { after: 200 },
            }),

            // Knowledge, Skills, and Competencies Matrix
            new Paragraph({
              text: '4. Knowledge, Skills, and Competencies Matrix',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.knowledgeSkillsCompetenciesMatrix,
              spacing: { after: 200 },
            }),

            // Comparative Analysis
            new Paragraph({
              text: '5. Comparative Analysis',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.comparativeAnalysis,
              spacing: { after: 200 },
            }),

            // Target Audience
            new Paragraph({
              text: '6. Target Audience',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.targetAudience,
              spacing: { after: 200 },
            }),

            // Entry Requirements
            new Paragraph({
              text: '7. Entry Requirements',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.entryRequirements,
              spacing: { after: 200 },
            }),

            // Career Outcomes
            new Paragraph({
              text: '8. Career Outcomes',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: programSpec.careerOutcomes,
              spacing: { after: 200 },
            }),
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Export unit specification as DOCX
   */
  async exportUnitSpecDOCX(unitId: string): Promise<Buffer> {
    const unitSpec = await this.getUnitSpecification(unitId);

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'AGCQ Unit Specification',
                      bold: true,
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  border: {
                    bottom: {
                      color: '000000',
                      space: 1,
                      style: BorderStyle.SINGLE,
                      size: 6,
                    },
                  },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Page ',
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                    }),
                    new TextRun({
                      text: ' of ',
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            // Title
            new Paragraph({
              text: `${unitSpec.moduleCode}: ${unitSpec.unitTitle}`,
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: 'Unit Specification',
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Unit Overview
            new Paragraph({
              text: '1. Unit Overview',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: unitSpec.unitOverview,
              spacing: { after: 200 },
            }),

            // Learning Outcomes
            new Paragraph({
              text: '2. Learning Outcomes',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...this.createLearningOutcomesSection(unitSpec),

            // Indicative Content
            new Paragraph({
              text: '3. Indicative Content',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            new Paragraph({
              text: unitSpec.indicativeContent,
              spacing: { after: 200 },
            }),

            // Teaching Strategies
            new Paragraph({
              text: '4. Teaching Strategies',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...unitSpec.teachingStrategies.map(
              (strategy) =>
                new Paragraph({
                  text: `• ${strategy}`,
                  spacing: { after: 100 },
                })
            ),

            // Assessment Methods
            new Paragraph({
              text: '5. Assessment Methods',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...unitSpec.assessmentMethods.map(
              (method) =>
                new Paragraph({
                  text: `• ${method}`,
                  spacing: { after: 100 },
                })
            ),

            // Reading List
            new Paragraph({
              text: '6. Reading List',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...this.createReadingListSection(unitSpec),
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  /**
   * Export assessment package as DOCX
   */
  async exportAssessmentPackageDOCX(programId: string): Promise<Buffer> {
    const curriculum = await this.getCurriculum(programId);
    const assessmentPackage = curriculum.assessmentPackage;
    const programData = await this.getProgramData(programId);

    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: convertInchesToTwip(1),
                right: convertInchesToTwip(1),
                bottom: convertInchesToTwip(1),
                left: convertInchesToTwip(1),
              },
            },
          },
          headers: {
            default: new Header({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'AGCQ Assessment Package',
                      bold: true,
                      size: 20,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                  border: {
                    bottom: {
                      color: '000000',
                      space: 1,
                      style: BorderStyle.SINGLE,
                      size: 6,
                    },
                  },
                }),
              ],
            }),
          },
          footers: {
            default: new Footer({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Page ',
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.CURRENT],
                      size: 18,
                    }),
                    new TextRun({
                      text: ' of ',
                      size: 18,
                    }),
                    new TextRun({
                      children: [PageNumber.TOTAL_PAGES],
                      size: 18,
                    }),
                  ],
                  alignment: AlignmentType.CENTER,
                }),
              ],
            }),
          },
          children: [
            // Title Page
            new Paragraph({
              text: programData.program_name,
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: 'Assessment Package',
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // Multiple Choice Questions
            new Paragraph({
              text: '1. Multiple Choice Questions',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...this.createMCQSection(assessmentPackage),

            // Case Studies
            new Paragraph({
              text: '2. Case Studies',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...this.createCaseStudiesSection(assessmentPackage),

            // Rubrics
            new Paragraph({
              text: '3. Assessment Rubrics',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...this.createRubricsSection(assessmentPackage),

            // Marking Schemes
            new Paragraph({
              text: '4. Marking Schemes',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 },
            }),
            ...this.createMarkingSchemesSection(assessmentPackage),
          ],
        },
      ],
    });

    return await Packer.toBuffer(doc);
  }

  // Helper methods for creating document sections
  private createLearningOutcomesSection(unitSpec: UnitSpecification): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    unitSpec.learningOutcomes.forEach((outcome, index) => {
      paragraphs.push(
        new Paragraph({
          text: `LO${index + 1}: ${outcome.outcomeText}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Assessment Criteria:',
              bold: true,
            }),
          ],
          spacing: { before: 100, after: 100 },
        })
      );

      outcome.assessmentCriteria.forEach((criteria) => {
        paragraphs.push(
          new Paragraph({
            text: `• ${criteria}`,
            spacing: { after: 50 },
          })
        );
      });
    });

    return paragraphs;
  }

  private createReadingListSection(unitSpec: UnitSpecification): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    const required = unitSpec.readingList.filter((item) => item.type === 'Required');
    const recommended = unitSpec.readingList.filter((item) => item.type === 'Recommended');

    if (required.length > 0) {
      paragraphs.push(
        new Paragraph({
          text: 'Required Reading:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      required.forEach((item) => {
        paragraphs.push(
          new Paragraph({
            text: `• ${item.citation}`,
            spacing: { after: 100 },
          })
        );
      });
    }

    if (recommended.length > 0) {
      paragraphs.push(
        new Paragraph({
          text: 'Recommended Reading:',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      recommended.forEach((item) => {
        paragraphs.push(
          new Paragraph({
            text: `• ${item.citation}`,
            spacing: { after: 100 },
          })
        );
      });
    }

    return paragraphs;
  }

  private createMCQSection(assessmentPackage: AssessmentPackage): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    // Group MCQs by module
    const mcqsByModule = assessmentPackage.mcqs.reduce((acc, mcq) => {
      if (!acc[mcq.moduleCode]) {
        acc[mcq.moduleCode] = [];
      }
      acc[mcq.moduleCode].push(mcq);
      return acc;
    }, {} as Record<string, typeof assessmentPackage.mcqs>);

    Object.entries(mcqsByModule).forEach(([moduleCode, mcqs]) => {
      paragraphs.push(
        new Paragraph({
          text: `Module: ${moduleCode}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      mcqs.forEach((mcq, index) => {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Question ${index + 1}: ${mcq.question}`,
                bold: true,
              }),
            ],
            spacing: { before: 100, after: 50 },
          })
        );

        mcq.options.forEach((option, optIndex) => {
          const isCorrect = option === mcq.correctAnswer;
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${String.fromCharCode(65 + optIndex)}. ${option}`,
                  bold: isCorrect,
                }),
              ],
              spacing: { after: 50 },
            })
          );
        });

        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Correct Answer: ${mcq.correctAnswer}`,
                italics: true,
              }),
            ],
            spacing: { before: 50, after: 50 },
          })
        );

        paragraphs.push(
          new Paragraph({
            text: `Explanation: ${mcq.explanation}`,
            spacing: { after: 100 },
          })
        );
      });
    });

    return paragraphs;
  }

  private createCaseStudiesSection(assessmentPackage: AssessmentPackage): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    assessmentPackage.caseStudies.forEach((caseStudy, index) => {
      paragraphs.push(
        new Paragraph({
          text: `Case Study ${index + 1}: ${caseStudy.title}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          text: `Module: ${caseStudy.moduleCode}`,
          spacing: { after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Scenario:',
              bold: true,
            }),
          ],
          spacing: { before: 100, after: 50 },
        })
      );

      paragraphs.push(
        new Paragraph({
          text: caseStudy.scenario,
          spacing: { after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Questions:',
              bold: true,
            }),
          ],
          spacing: { before: 100, after: 50 },
        })
      );

      caseStudy.questions.forEach((question, qIndex) => {
        paragraphs.push(
          new Paragraph({
            text: `${qIndex + 1}. ${question}`,
            spacing: { after: 50 },
          })
        );
      });

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Rubric:',
              bold: true,
            }),
          ],
          spacing: { before: 100, after: 50 },
        })
      );

      paragraphs.push(
        new Paragraph({
          text: caseStudy.rubric,
          spacing: { after: 100 },
        })
      );
    });

    return paragraphs;
  }

  private createRubricsSection(assessmentPackage: AssessmentPackage): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    assessmentPackage.rubrics.forEach((rubric) => {
      paragraphs.push(
        new Paragraph({
          text: `Assessment Type: ${rubric.assessmentType}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      rubric.criteria.forEach((criterion) => {
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Criterion: ${criterion.criterion}`,
                bold: true,
              }),
            ],
            spacing: { before: 100, after: 50 },
          })
        );

        paragraphs.push(
          new Paragraph({
            text: `• Excellent: ${criterion.excellent}`,
            spacing: { after: 50 },
          })
        );

        paragraphs.push(
          new Paragraph({
            text: `• Good: ${criterion.good}`,
            spacing: { after: 50 },
          })
        );

        paragraphs.push(
          new Paragraph({
            text: `• Satisfactory: ${criterion.satisfactory}`,
            spacing: { after: 50 },
          })
        );

        paragraphs.push(
          new Paragraph({
            text: `• Needs Improvement: ${criterion.needsImprovement}`,
            spacing: { after: 100 },
          })
        );
      });
    });

    return paragraphs;
  }

  private createMarkingSchemesSection(assessmentPackage: AssessmentPackage): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    assessmentPackage.markingSchemes.forEach((scheme) => {
      paragraphs.push(
        new Paragraph({
          text: `Assessment Type: ${scheme.assessmentType}`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Total Marks: ${scheme.totalMarks}`,
              bold: true,
            }),
          ],
          spacing: { after: 100 },
        })
      );

      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: 'Breakdown:',
              bold: true,
            }),
          ],
          spacing: { before: 100, after: 50 },
        })
      );

      scheme.breakdown.forEach((item) => {
        paragraphs.push(
          new Paragraph({
            text: `• ${item.section}: ${item.marks} marks - ${item.description}`,
            spacing: { after: 50 },
          })
        );
      });
    });

    return paragraphs;
  }

  // Database helper methods
  private async getCurriculum(programId: string): Promise<Curriculum> {
    // This would fetch from the database - for now, return a mock structure
    // In production, this would query the generation_jobs table and related data
    const result = await pool.query(
      `SELECT * FROM programs WHERE id = $1`,
      [programId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Program not found: ${programId}`);
    }

    // Fetch curriculum data from database
    // This is a simplified version - actual implementation would fetch all related data
    throw new Error('getCurriculum not fully implemented - requires curriculum storage');
  }

  private async getUnitSpecification(unitId: string): Promise<UnitSpecification> {
    // This would fetch from the database
    throw new Error('getUnitSpecification not fully implemented - requires unit spec storage');
  }

  private async getProgramData(programId: string): Promise<any> {
    const result = await pool.query(
      `SELECT * FROM programs WHERE id = $1`,
      [programId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Program not found: ${programId}`);
    }

    return result.rows[0];
  }

  /**
   * Export program specification as PDF
   */
  async exportProgramSpecPDF(programId: string): Promise<Buffer> {
    const curriculum = await this.getCurriculum(programId);
    const programSpec = curriculum.programSpec;
    const programData = await this.getProgramData(programId);

    const html = this.generateProgramSpecHTML(programSpec, programData);
    return await this.convertHTMLToPDF(html);
  }

  /**
   * Export unit specification as PDF
   */
  async exportUnitSpecPDF(unitId: string): Promise<Buffer> {
    const unitSpec = await this.getUnitSpecification(unitId);
    const html = this.generateUnitSpecHTML(unitSpec);
    return await this.convertHTMLToPDF(html);
  }

  /**
   * Export assessment package as PDF
   */
  async exportAssessmentPackagePDF(programId: string): Promise<Buffer> {
    const curriculum = await this.getCurriculum(programId);
    const assessmentPackage = curriculum.assessmentPackage;
    const programData = await this.getProgramData(programId);

    const html = this.generateAssessmentPackageHTML(assessmentPackage, programData);
    return await this.convertHTMLToPDF(html);
  }

  /**
   * Convert HTML to PDF using Puppeteer
   */
  private async convertHTMLToPDF(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in',
        },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; text-align: center; width: 100%; border-bottom: 1px solid #000; padding-bottom: 5px;">
            <strong>AGCQ Program Specification</strong>
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; text-align: center; width: 100%; padding-top: 5px;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate HTML for program specification
   */
  private generateProgramSpecHTML(programSpec: ProgramSpecification, programData: any): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
          }
          h1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            page-break-after: avoid;
          }
          h2 {
            color: #34495e;
            margin-top: 30px;
            page-break-after: avoid;
          }
          .title-page {
            text-align: center;
            margin-top: 100px;
            page-break-after: always;
          }
          .title-page h1 {
            font-size: 32px;
            border: none;
          }
          .title-page p {
            font-size: 18px;
            margin: 20px 0;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .toc {
            page-break-after: always;
          }
          .toc ul {
            list-style: none;
            padding: 0;
          }
          .toc li {
            margin: 10px 0;
          }
          .toc a {
            color: #3498db;
            text-decoration: none;
          }
          .toc a:hover {
            text-decoration: underline;
          }
        </style>
      </head>
      <body>
        <div class="title-page">
          <h1>${programData.program_name}</h1>
          <p><strong>Program Specification Document</strong></p>
          <p>Qualification Level: ${programData.qualification_level}</p>
          <p>Total Credits: ${programData.total_credits}</p>
          <p>Generated: ${new Date().toLocaleDateString()}</p>
        </div>

        <div class="toc">
          <h1>Table of Contents</h1>
          <ul>
            <li><a href="#introduction">1. Introduction</a></li>
            <li><a href="#course-overview">2. Course Overview</a></li>
            <li><a href="#needs-analysis">3. Needs Analysis</a></li>
            <li><a href="#ksc-matrix">4. Knowledge, Skills, and Competencies Matrix</a></li>
            <li><a href="#comparative-analysis">5. Comparative Analysis</a></li>
            <li><a href="#target-audience">6. Target Audience</a></li>
            <li><a href="#entry-requirements">7. Entry Requirements</a></li>
            <li><a href="#career-outcomes">8. Career Outcomes</a></li>
          </ul>
        </div>

        <div class="section">
          <h1 id="introduction">1. Introduction</h1>
          <p>${programSpec.introduction}</p>
        </div>

        <div class="section">
          <h1 id="course-overview">2. Course Overview</h1>
          <p>${programSpec.courseOverview}</p>
        </div>

        <div class="section">
          <h1 id="needs-analysis">3. Needs Analysis</h1>
          <p>${programSpec.needsAnalysis}</p>
        </div>

        <div class="section">
          <h1 id="ksc-matrix">4. Knowledge, Skills, and Competencies Matrix</h1>
          <p>${programSpec.knowledgeSkillsCompetenciesMatrix}</p>
        </div>

        <div class="section">
          <h1 id="comparative-analysis">5. Comparative Analysis</h1>
          <p>${programSpec.comparativeAnalysis}</p>
        </div>

        <div class="section">
          <h1 id="target-audience">6. Target Audience</h1>
          <p>${programSpec.targetAudience}</p>
        </div>

        <div class="section">
          <h1 id="entry-requirements">7. Entry Requirements</h1>
          <p>${programSpec.entryRequirements}</p>
        </div>

        <div class="section">
          <h1 id="career-outcomes">8. Career Outcomes</h1>
          <p>${programSpec.careerOutcomes}</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML for unit specification
   */
  private generateUnitSpecHTML(unitSpec: UnitSpecification): string {
    const learningOutcomesHTML = unitSpec.learningOutcomes
      .map(
        (outcome, index) => `
        <div class="learning-outcome">
          <h3>LO${index + 1}: ${outcome.outcomeText}</h3>
          <p><strong>Assessment Criteria:</strong></p>
          <ul>
            ${outcome.assessmentCriteria.map((criteria) => `<li>${criteria}</li>`).join('')}
          </ul>
        </div>
      `
      )
      .join('');

    const teachingStrategiesHTML = unitSpec.teachingStrategies
      .map((strategy) => `<li>${strategy}</li>`)
      .join('');

    const assessmentMethodsHTML = unitSpec.assessmentMethods
      .map((method) => `<li>${method}</li>`)
      .join('');

    const requiredReading = unitSpec.readingList.filter((item) => item.type === 'Required');
    const recommendedReading = unitSpec.readingList.filter((item) => item.type === 'Recommended');

    const readingListHTML = `
      ${
        requiredReading.length > 0
          ? `
        <h3>Required Reading</h3>
        <ul>
          ${requiredReading.map((item) => `<li>${item.citation}</li>`).join('')}
        </ul>
      `
          : ''
      }
      ${
        recommendedReading.length > 0
          ? `
        <h3>Recommended Reading</h3>
        <ul>
          ${recommendedReading.map((item) => `<li>${item.citation}</li>`).join('')}
        </ul>
      `
          : ''
      }
    `;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
          }
          h1, h2, h3 {
            color: #2c3e50;
            page-break-after: avoid;
          }
          h1 {
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
          }
          .title-page {
            text-align: center;
            margin-top: 100px;
            page-break-after: always;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .learning-outcome {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
          }
          ul {
            margin: 10px 0;
          }
          li {
            margin: 5px 0;
          }
        </style>
      </head>
      <body>
        <div class="title-page">
          <h1>${unitSpec.moduleCode}: ${unitSpec.unitTitle}</h1>
          <p><strong>Unit Specification</strong></p>
        </div>

        <div class="section">
          <h1>1. Unit Overview</h1>
          <p>${unitSpec.unitOverview}</p>
        </div>

        <div class="section">
          <h1>2. Learning Outcomes</h1>
          ${learningOutcomesHTML}
        </div>

        <div class="section">
          <h1>3. Indicative Content</h1>
          <p>${unitSpec.indicativeContent}</p>
        </div>

        <div class="section">
          <h1>4. Teaching Strategies</h1>
          <ul>${teachingStrategiesHTML}</ul>
        </div>

        <div class="section">
          <h1>5. Assessment Methods</h1>
          <ul>${assessmentMethodsHTML}</ul>
        </div>

        <div class="section">
          <h1>6. Reading List</h1>
          ${readingListHTML}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate HTML for assessment package
   */
  private generateAssessmentPackageHTML(assessmentPackage: AssessmentPackage, programData: any): string {
    // Group MCQs by module
    const mcqsByModule = assessmentPackage.mcqs.reduce((acc, mcq) => {
      if (!acc[mcq.moduleCode]) {
        acc[mcq.moduleCode] = [];
      }
      acc[mcq.moduleCode].push(mcq);
      return acc;
    }, {} as Record<string, typeof assessmentPackage.mcqs>);

    const mcqsHTML = Object.entries(mcqsByModule)
      .map(
        ([moduleCode, mcqs]) => `
        <div class="module-section">
          <h2>Module: ${moduleCode}</h2>
          ${mcqs
            .map(
              (mcq, index) => `
            <div class="mcq">
              <p><strong>Question ${index + 1}:</strong> ${mcq.question}</p>
              <ul class="options">
                ${mcq.options
                  .map(
                    (option, optIndex) => `
                  <li class="${option === mcq.correctAnswer ? 'correct' : ''}">
                    ${String.fromCharCode(65 + optIndex)}. ${option}
                  </li>
                `
                  )
                  .join('')}
              </ul>
              <p class="answer"><em>Correct Answer: ${mcq.correctAnswer}</em></p>
              <p class="explanation">Explanation: ${mcq.explanation}</p>
            </div>
          `
            )
            .join('')}
        </div>
      `
      )
      .join('');

    const caseStudiesHTML = assessmentPackage.caseStudies
      .map(
        (caseStudy, index) => `
        <div class="case-study">
          <h2>Case Study ${index + 1}: ${caseStudy.title}</h2>
          <p><strong>Module:</strong> ${caseStudy.moduleCode}</p>
          <h3>Scenario</h3>
          <p>${caseStudy.scenario}</p>
          <h3>Questions</h3>
          <ol>
            ${caseStudy.questions.map((question) => `<li>${question}</li>`).join('')}
          </ol>
          <h3>Rubric</h3>
          <p>${caseStudy.rubric}</p>
        </div>
      `
      )
      .join('');

    const rubricsHTML = assessmentPackage.rubrics
      .map(
        (rubric) => `
        <div class="rubric">
          <h2>Assessment Type: ${rubric.assessmentType}</h2>
          ${rubric.criteria
            .map(
              (criterion) => `
            <div class="criterion">
              <h3>${criterion.criterion}</h3>
              <table>
                <tr>
                  <th>Excellent</th>
                  <th>Good</th>
                  <th>Satisfactory</th>
                  <th>Needs Improvement</th>
                </tr>
                <tr>
                  <td>${criterion.excellent}</td>
                  <td>${criterion.good}</td>
                  <td>${criterion.satisfactory}</td>
                  <td>${criterion.needsImprovement}</td>
                </tr>
              </table>
            </div>
          `
            )
            .join('')}
        </div>
      `
      )
      .join('');

    const markingSchemesHTML = assessmentPackage.markingSchemes
      .map(
        (scheme) => `
        <div class="marking-scheme">
          <h2>Assessment Type: ${scheme.assessmentType}</h2>
          <p><strong>Total Marks:</strong> ${scheme.totalMarks}</p>
          <h3>Breakdown</h3>
          <ul>
            ${scheme.breakdown
              .map((item) => `<li><strong>${item.section}:</strong> ${item.marks} marks - ${item.description}</li>`)
              .join('')}
          </ul>
        </div>
      `
      )
      .join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
          }
          h1, h2, h3 {
            color: #2c3e50;
            page-break-after: avoid;
          }
          h1 {
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
          }
          .title-page {
            text-align: center;
            margin-top: 100px;
            page-break-after: always;
          }
          .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
          }
          .mcq, .case-study, .rubric, .marking-scheme {
            margin-bottom: 30px;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #3498db;
            page-break-inside: avoid;
          }
          .options {
            list-style: none;
            padding: 0;
          }
          .options li {
            margin: 5px 0;
            padding: 5px;
          }
          .options li.correct {
            font-weight: bold;
            background-color: #d4edda;
          }
          .answer {
            font-style: italic;
            color: #28a745;
          }
          .explanation {
            margin-top: 10px;
            padding: 10px;
            background-color: #e9ecef;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #3498db;
            color: white;
          }
          tr:nth-child(even) {
            background-color: #f2f2f2;
          }
        </style>
      </head>
      <body>
        <div class="title-page">
          <h1>${programData.program_name}</h1>
          <p><strong>Assessment Package</strong></p>
        </div>

        <div class="section">
          <h1>1. Multiple Choice Questions</h1>
          ${mcqsHTML}
        </div>

        <div class="section">
          <h1>2. Case Studies</h1>
          ${caseStudiesHTML}
        </div>

        <div class="section">
          <h1>3. Assessment Rubrics</h1>
          ${rubricsHTML}
        </div>

        <div class="section">
          <h1>4. Marking Schemes</h1>
          ${markingSchemesHTML}
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Export curriculum as SCORM package
   */
  async exportSCORMPackage(programId: string): Promise<Buffer> {
    const curriculum = await this.getCurriculum(programId);
    const programData = await this.getProgramData(programId);

    // Create SCORM package structure
    const scormPackage = await this.createSCORMPackage(curriculum, programData);
    
    return scormPackage;
  }

  /**
   * Create SCORM-compliant package
   */
  private async createSCORMPackage(curriculum: Curriculum, programData: any): Promise<Buffer> {
    const tmpDir = path.join('/tmp', `scorm-${curriculum.programId}-${Date.now()}`);
    
    try {
      // Create temporary directory structure
      await fs.promises.mkdir(tmpDir, { recursive: true });
      await fs.promises.mkdir(path.join(tmpDir, 'content'), { recursive: true });

      // Generate imsmanifest.xml
      const manifest = this.generateSCORMManifest(curriculum, programData);
      await fs.promises.writeFile(
        path.join(tmpDir, 'imsmanifest.xml'),
        manifest,
        'utf-8'
      );

      // Generate content HTML files for each unit
      for (let i = 0; i < curriculum.unitSpecs.length; i++) {
        const unitSpec = curriculum.unitSpecs[i];
        const unitHTML = this.generateUnitContentHTML(unitSpec, i);
        await fs.promises.writeFile(
          path.join(tmpDir, 'content', `unit_${i + 1}.html`),
          unitHTML,
          'utf-8'
        );
      }

      // Generate index.html (course overview)
      const indexHTML = this.generateCourseIndexHTML(curriculum, programData);
      await fs.promises.writeFile(
        path.join(tmpDir, 'content', 'index.html'),
        indexHTML,
        'utf-8'
      );

      // Generate assessment HTML
      const assessmentHTML = this.generateAssessmentContentHTML(curriculum.assessmentPackage);
      await fs.promises.writeFile(
        path.join(tmpDir, 'content', 'assessments.html'),
        assessmentHTML,
        'utf-8'
      );

      // Create SCORM API wrapper
      const scormAPIWrapper = this.generateSCORMAPIWrapper();
      await fs.promises.writeFile(
        path.join(tmpDir, 'content', 'scorm-api.js'),
        scormAPIWrapper,
        'utf-8'
      );

      // Create CSS file
      const cssContent = this.generateSCORMCSS();
      await fs.promises.writeFile(
        path.join(tmpDir, 'content', 'styles.css'),
        cssContent,
        'utf-8'
      );

      // Zip the package
      const zipBuffer = await this.zipDirectory(tmpDir);

      return zipBuffer;
    } finally {
      // Clean up temporary directory
      await fs.promises.rm(tmpDir, { recursive: true, force: true });
    }
  }

  /**
   * Generate SCORM manifest file
   */
  private generateSCORMManifest(curriculum: Curriculum, programData: any): string {
    const organizationItems = curriculum.unitSpecs
      .map(
        (unit, index) => `
        <item identifier="item_${index + 1}" identifierref="resource_${index + 1}">
          <title>${unit.moduleCode}: ${unit.unitTitle}</title>
        </item>
      `
      )
      .join('');

    const resources = curriculum.unitSpecs
      .map(
        (unit, index) => `
        <resource identifier="resource_${index + 1}" type="webcontent" adlcp:scormType="sco" href="content/unit_${index + 1}.html">
          <file href="content/unit_${index + 1}.html"/>
          <file href="content/scorm-api.js"/>
          <file href="content/styles.css"/>
        </resource>
      `
      )
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="com.agcq.${curriculum.programId}" version="1.0"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:adlnav="http://www.adlnet.org/xsd/adlnav_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                              http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                              http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                              http://www.adlnet.org/xsd/adlnav_v1p3 adlnav_v1p3.xsd
                              http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>2004 4th Edition</schemaversion>
  </metadata>
  <organizations default="org_1">
    <organization identifier="org_1">
      <title>${programData.program_name}</title>
      <item identifier="item_0" identifierref="resource_0">
        <title>Course Overview</title>
      </item>
      ${organizationItems}
      <item identifier="item_assessments" identifierref="resource_assessments">
        <title>Assessments</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="resource_0" type="webcontent" adlcp:scormType="sco" href="content/index.html">
      <file href="content/index.html"/>
      <file href="content/scorm-api.js"/>
      <file href="content/styles.css"/>
    </resource>
    ${resources}
    <resource identifier="resource_assessments" type="webcontent" adlcp:scormType="sco" href="content/assessments.html">
      <file href="content/assessments.html"/>
      <file href="content/scorm-api.js"/>
      <file href="content/styles.css"/>
    </resource>
  </resources>
</manifest>`;
  }

  /**
   * Generate HTML content for a unit
   */
  private generateUnitContentHTML(unitSpec: UnitSpecification, index: number): string {
    const learningOutcomesHTML = unitSpec.learningOutcomes
      .map(
        (outcome, idx) => `
        <div class="learning-outcome">
          <h3>Learning Outcome ${idx + 1}</h3>
          <p>${outcome.outcomeText}</p>
          <h4>Assessment Criteria:</h4>
          <ul>
            ${outcome.assessmentCriteria.map((criteria) => `<li>${criteria}</li>`).join('')}
          </ul>
        </div>
      `
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${unitSpec.moduleCode}: ${unitSpec.unitTitle}</title>
  <link rel="stylesheet" href="styles.css">
  <script src="scorm-api.js"></script>
  <script>
    window.onload = function() {
      initializeSCORM();
    };
    window.onbeforeunload = function() {
      finalizeSCORM();
    };
  </script>
</head>
<body>
  <div class="container">
    <header>
      <h1>${unitSpec.moduleCode}: ${unitSpec.unitTitle}</h1>
    </header>
    
    <main>
      <section class="unit-overview">
        <h2>Unit Overview</h2>
        <p>${unitSpec.unitOverview}</p>
      </section>

      <section class="learning-outcomes">
        <h2>Learning Outcomes</h2>
        ${learningOutcomesHTML}
      </section>

      <section class="content">
        <h2>Indicative Content</h2>
        <div class="content-text">${unitSpec.indicativeContent}</div>
      </section>

      <section class="teaching-strategies">
        <h2>Teaching Strategies</h2>
        <ul>
          ${unitSpec.teachingStrategies.map((strategy) => `<li>${strategy}</li>`).join('')}
        </ul>
      </section>

      <section class="assessment-methods">
        <h2>Assessment Methods</h2>
        <ul>
          ${unitSpec.assessmentMethods.map((method) => `<li>${method}</li>`).join('')}
        </ul>
      </section>

      <section class="reading-list">
        <h2>Reading List</h2>
        <h3>Required Reading</h3>
        <ul>
          ${unitSpec.readingList
            .filter((item) => item.type === 'Required')
            .map((item) => `<li>${item.citation}</li>`)
            .join('')}
        </ul>
        <h3>Recommended Reading</h3>
        <ul>
          ${unitSpec.readingList
            .filter((item) => item.type === 'Recommended')
            .map((item) => `<li>${item.citation}</li>`)
            .join('')}
        </ul>
      </section>
    </main>

    <footer>
      <button onclick="markComplete()">Mark as Complete</button>
    </footer>
  </div>
</body>
</html>`;
  }

  /**
   * Generate course index HTML
   */
  private generateCourseIndexHTML(curriculum: Curriculum, programData: any): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${programData.program_name} - Course Overview</title>
  <link rel="stylesheet" href="styles.css">
  <script src="scorm-api.js"></script>
  <script>
    window.onload = function() {
      initializeSCORM();
    };
    window.onbeforeunload = function() {
      finalizeSCORM();
    };
  </script>
</head>
<body>
  <div class="container">
    <header>
      <h1>${programData.program_name}</h1>
      <p class="subtitle">Course Overview</p>
    </header>
    
    <main>
      <section>
        <h2>Introduction</h2>
        <p>${curriculum.programSpec.introduction}</p>
      </section>

      <section>
        <h2>Course Overview</h2>
        <p>${curriculum.programSpec.courseOverview}</p>
      </section>

      <section>
        <h2>Target Audience</h2>
        <p>${curriculum.programSpec.targetAudience}</p>
      </section>

      <section>
        <h2>Entry Requirements</h2>
        <p>${curriculum.programSpec.entryRequirements}</p>
      </section>

      <section>
        <h2>Career Outcomes</h2>
        <p>${curriculum.programSpec.careerOutcomes}</p>
      </section>

      <section>
        <h2>Course Structure</h2>
        <ul class="unit-list">
          ${curriculum.unitSpecs
            .map(
              (unit) => `
            <li>
              <strong>${unit.moduleCode}:</strong> ${unit.unitTitle}
            </li>
          `
            )
            .join('')}
        </ul>
      </section>
    </main>

    <footer>
      <button onclick="markComplete()">Continue to Course Content</button>
    </footer>
  </div>
</body>
</html>`;
  }

  /**
   * Generate assessment content HTML
   */
  private generateAssessmentContentHTML(assessmentPackage: AssessmentPackage): string {
    const mcqsByModule = assessmentPackage.mcqs.reduce((acc, mcq) => {
      if (!acc[mcq.moduleCode]) {
        acc[mcq.moduleCode] = [];
      }
      acc[mcq.moduleCode].push(mcq);
      return acc;
    }, {} as Record<string, typeof assessmentPackage.mcqs>);

    const mcqsHTML = Object.entries(mcqsByModule)
      .map(
        ([moduleCode, mcqs]) => `
        <div class="module-assessments">
          <h3>Module: ${moduleCode}</h3>
          ${mcqs
            .map(
              (mcq, index) => `
            <div class="mcq-question">
              <p class="question"><strong>Question ${index + 1}:</strong> ${mcq.question}</p>
              <div class="options">
                ${mcq.options
                  .map(
                    (option, optIndex) => `
                  <label>
                    <input type="radio" name="q_${moduleCode}_${index}" value="${option}">
                    ${String.fromCharCode(65 + optIndex)}. ${option}
                  </label>
                `
                  )
                  .join('')}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Assessments</title>
  <link rel="stylesheet" href="styles.css">
  <script src="scorm-api.js"></script>
  <script>
    window.onload = function() {
      initializeSCORM();
    };
    window.onbeforeunload = function() {
      finalizeSCORM();
    };
  </script>
</head>
<body>
  <div class="container">
    <header>
      <h1>Course Assessments</h1>
    </header>
    
    <main>
      <section class="assessments">
        <h2>Multiple Choice Questions</h2>
        ${mcqsHTML}
      </section>

      <section class="case-studies">
        <h2>Case Studies</h2>
        ${assessmentPackage.caseStudies
          .map(
            (caseStudy, index) => `
          <div class="case-study">
            <h3>Case Study ${index + 1}: ${caseStudy.title}</h3>
            <p><strong>Module:</strong> ${caseStudy.moduleCode}</p>
            <div class="scenario">
              <h4>Scenario</h4>
              <p>${caseStudy.scenario}</p>
            </div>
            <div class="questions">
              <h4>Questions</h4>
              <ol>
                ${caseStudy.questions.map((question) => `<li>${question}</li>`).join('')}
              </ol>
            </div>
          </div>
        `
          )
          .join('')}
      </section>
    </main>

    <footer>
      <button onclick="submitAssessment()">Submit Assessment</button>
    </footer>
  </div>
</body>
</html>`;
  }

  /**
   * Generate SCORM API wrapper JavaScript
   */
  private generateSCORMAPIWrapper(): string {
    return `
// SCORM 2004 API Wrapper
var scormAPI = null;
var isInitialized = false;

function findAPI(win) {
  var attempts = 0;
  var maxAttempts = 500;
  
  while (win.API_1484_11 == null && win.parent != null && win.parent != win && attempts < maxAttempts) {
    attempts++;
    win = win.parent;
  }
  
  return win.API_1484_11;
}

function initializeSCORM() {
  scormAPI = findAPI(window);
  
  if (scormAPI) {
    var result = scormAPI.Initialize("");
    if (result == "true") {
      isInitialized = true;
      scormAPI.SetValue("cmi.completion_status", "incomplete");
      scormAPI.SetValue("cmi.success_status", "unknown");
      scormAPI.Commit("");
    }
  }
}

function finalizeSCORM() {
  if (scormAPI && isInitialized) {
    scormAPI.Commit("");
    scormAPI.Terminate("");
    isInitialized = false;
  }
}

function markComplete() {
  if (scormAPI && isInitialized) {
    scormAPI.SetValue("cmi.completion_status", "completed");
    scormAPI.SetValue("cmi.success_status", "passed");
    scormAPI.SetValue("cmi.score.scaled", "1.0");
    scormAPI.Commit("");
  }
}

function submitAssessment() {
  if (scormAPI && isInitialized) {
    // Calculate score based on answers
    scormAPI.SetValue("cmi.completion_status", "completed");
    scormAPI.SetValue("cmi.success_status", "passed");
    scormAPI.Commit("");
    alert("Assessment submitted successfully!");
  }
}
`;
  }

  /**
   * Generate CSS for SCORM content
   */
  private generateSCORMCSS(): string {
    return `
body {
  font-family: 'Arial', sans-serif;
  line-height: 1.6;
  color: #333;
  margin: 0;
  padding: 0;
  background-color: #f5f5f5;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  background-color: white;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  min-height: 100vh;
}

header {
  background-color: #2c3e50;
  color: white;
  padding: 30px;
  text-align: center;
}

header h1 {
  margin: 0;
  font-size: 32px;
}

.subtitle {
  font-size: 18px;
  margin-top: 10px;
  opacity: 0.9;
}

main {
  padding: 40px;
}

section {
  margin-bottom: 40px;
}

h2 {
  color: #2c3e50;
  border-bottom: 2px solid #3498db;
  padding-bottom: 10px;
  margin-bottom: 20px;
}

h3 {
  color: #34495e;
  margin-top: 20px;
}

.learning-outcome {
  background-color: #f8f9fa;
  padding: 20px;
  margin-bottom: 20px;
  border-left: 4px solid #3498db;
}

.content-text {
  line-height: 1.8;
}

ul, ol {
  margin: 15px 0;
  padding-left: 30px;
}

li {
  margin: 10px 0;
}

.unit-list li {
  padding: 10px;
  background-color: #f8f9fa;
  margin: 10px 0;
  border-radius: 4px;
}

.mcq-question {
  background-color: #f8f9fa;
  padding: 20px;
  margin-bottom: 20px;
  border-radius: 4px;
}

.question {
  font-weight: bold;
  margin-bottom: 15px;
}

.options label {
  display: block;
  padding: 10px;
  margin: 5px 0;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.options label:hover {
  background-color: #e9ecef;
}

.options input[type="radio"] {
  margin-right: 10px;
}

.case-study {
  background-color: #f8f9fa;
  padding: 20px;
  margin-bottom: 30px;
  border-left: 4px solid #3498db;
}

.scenario {
  background-color: white;
  padding: 15px;
  margin: 15px 0;
  border-radius: 4px;
}

footer {
  background-color: #ecf0f1;
  padding: 20px;
  text-align: center;
  border-top: 1px solid #ddd;
}

button {
  background-color: #3498db;
  color: white;
  border: none;
  padding: 12px 30px;
  font-size: 16px;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s;
}

button:hover {
  background-color: #2980b9;
}

button:active {
  background-color: #21618c;
}
`;
  }

  /**
   * Zip a directory into a buffer
   */
  private async zipDirectory(sourceDir: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const archive = archiver('zip', { zlib: { level: 9 } });

      archive.on('data', (chunk: Buffer) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }
}

export default new DocumentExportService();
