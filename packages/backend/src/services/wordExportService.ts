import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from 'docx';

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

export class WordExportService {
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
              size: 20,
            }),
          ],
        }),
      ],
      shading: options.shading ? { fill: options.shading } : undefined,
      width: options.width ? { size: options.width, type: WidthType.PERCENTAGE } : undefined,
    });
  }

  async generateDocument(workflow: WorkflowData): Promise<Buffer> {
    const sections: any[] = [];
    const step1 = workflow.step1 || {};

    // Title Page
    sections.push({
      properties: {},
      children: [
        new Paragraph({
          children: [
            new TextRun({
              text: step1.programTitle || workflow.projectName || 'Curriculum Package',
              bold: true,
              size: 56,
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
    // Section 1: Program Foundation
    // =========================================================================
    if (workflow.step1) {
      contentChildren.push(
        new Paragraph({
          text: '1. Program Foundation',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Program Description
      if (step1.programDescription) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Program Description', bold: true, size: 26 })],
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: step1.programDescription, size: 22 })],
            spacing: { after: 300 },
          })
        );
      }

      // Executive Summary
      if (step1.executiveSummary) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Executive Summary', bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: step1.executiveSummary, size: 22 })],
            spacing: { after: 300 },
          })
        );
      }

      // Credit Framework Table
      if (step1.creditFramework) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Credit Framework', bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          }),
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

      // Program Aims
      if (step1.programAims?.length) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Program Aims', bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          })
        );
        step1.programAims.forEach((aim: string, index: number) => {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: `${index + 1}. ${aim}`, size: 22 })],
              spacing: { after: 80 },
            })
          );
        });
      }

      // Entry Requirements
      if (step1.entryRequirements) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Entry Requirements', bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          }),
          new Paragraph({
            children: [new TextRun({ text: step1.entryRequirements, size: 22 })],
            spacing: { after: 300 },
          })
        );
      }

      // Career Pathways
      if (step1.careerPathways?.length) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Career Pathways', bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          })
        );
        step1.careerPathways.forEach((path: string) => {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: `• ${path}`, size: 22 })],
              spacing: { after: 50 },
            })
          );
        });
      }

      // Job Roles
      if (step1.jobRoles?.length) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Target Job Roles', bold: true, size: 26 })],
            spacing: { before: 200, after: 100 },
          })
        );
        step1.jobRoles.forEach((role: string | { title: string }) => {
          const roleText = typeof role === 'string' ? role : role.title;
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: `• ${roleText}`, size: 22 })],
              spacing: { after: 50 },
            })
          );
        });
      }
    }

    // =========================================================================
    // Section 2: Competency Framework (KSC)
    // =========================================================================
    if (workflow.step2) {
      const step2 = workflow.step2;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '2. Competency Framework (KSC)',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Knowledge Items
      if (step2.knowledgeItems?.length) {
        contentChildren.push(
          new Paragraph({
            text: 'Knowledge',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        step2.knowledgeItems.forEach((item: any) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${item.id || '•'}: `, bold: true, size: 22 }),
                new TextRun({ text: item.statement || '', size: 22 }),
              ],
              spacing: { after: 50 },
            })
          );
          if (item.description) {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: item.description, size: 20, color: '4a5568' })],
                spacing: { after: 100 },
              })
            );
          }
        });
      }

      // Skill Items
      if (step2.skillItems?.length) {
        contentChildren.push(
          new Paragraph({
            text: 'Skills',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        step2.skillItems.forEach((item: any) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${item.id || '•'}: `, bold: true, size: 22 }),
                new TextRun({ text: item.statement || '', size: 22 }),
              ],
              spacing: { after: 50 },
            })
          );
          if (item.description) {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: item.description, size: 20, color: '4a5568' })],
                spacing: { after: 100 },
              })
            );
          }
        });
      }

      // Competency Items (was Attitude Items - now KSC)
      const competencyItems = step2.competencyItems || step2.attitudeItems;
      if (competencyItems?.length) {
        contentChildren.push(
          new Paragraph({
            text: 'Competencies',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        competencyItems.forEach((item: any) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${item.id || '•'}: `, bold: true, size: 22 }),
                new TextRun({ text: item.statement || '', size: 22 }),
              ],
              spacing: { after: 50 },
            })
          );
          if (item.description) {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: item.description, size: 20, color: '4a5568' })],
                spacing: { after: 100 },
              })
            );
          }
        });
      }

      // Benchmarking Report
      if (step2.benchmarkingReport) {
        contentChildren.push(
          new Paragraph({
            text: 'Benchmarking Report',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        if (step2.benchmarkingReport.keyFindings?.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Key Findings:', bold: true, size: 22 })],
              spacing: { after: 50 },
            })
          );
          step2.benchmarkingReport.keyFindings.forEach((finding: string) => {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: `• ${finding}`, size: 20 })],
                spacing: { after: 50 },
              })
            );
          });
        }
      }
    }

    // =========================================================================
    // Section 3: Program Learning Outcomes
    // =========================================================================
    if (workflow.step3?.outcomes?.length) {
      const step3 = workflow.step3;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '3. Program Learning Outcomes (PLOs)',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      step3.outcomes.forEach((plo: any, index: number) => {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${plo.id || `PLO${index + 1}`}: `,
                bold: true,
                size: 24,
                color: '1a365d',
              }),
            ],
            spacing: { before: 150, after: 50 },
          }),
          new Paragraph({
            children: [new TextRun({ text: plo.statement || '', size: 22 })],
            spacing: { after: 50 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Bloom Level: ${plo.bloomLevel || 'N/A'}`,
                size: 20,
                color: '718096',
                italics: true,
              }),
            ],
            spacing: { after: 50 },
          })
        );
        if (plo.competencyLinks?.length) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Linked Competencies: ${plo.competencyLinks.join(', ')}`,
                  size: 18,
                  color: '4a5568',
                }),
              ],
              spacing: { after: 50 },
            })
          );
        }
        if (plo.assessmentAlignment) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Assessment: ${plo.assessmentAlignment}`,
                  size: 18,
                  color: '4a5568',
                }),
              ],
              spacing: { after: 150 },
            })
          );
        }
      });
    }

    // =========================================================================
    // Section 4: Course Structure & MLOs
    // =========================================================================
    if (workflow.step4?.modules?.length) {
      const step4 = workflow.step4;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '4. Course Structure & Module Learning Outcomes',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Summary
      contentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Total Program Hours: ${step4.totalProgramHours || '-'} | Contact: ${step4.totalContactHours || '-'} | Independent: ${step4.totalIndependentHours || '-'}`,
              size: 20,
              color: '4a5568',
            }),
          ],
          spacing: { after: 200 },
        })
      );

      step4.modules.forEach((module: any) => {
        contentChildren.push(
          new Paragraph({
            text: `${module.moduleCode || 'Module'}: ${module.title || 'Untitled'}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Hours: ${module.totalHours || '-'} (Contact: ${module.contactHours || '-'}, Independent: ${module.independentHours || '-'})`,
                size: 20,
                color: '4a5568',
              }),
            ],
            spacing: { after: 100 },
          })
        );

        if (module.mlos?.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Module Learning Outcomes:', bold: true, size: 22 })],
              spacing: { after: 50 },
            })
          );
          module.mlos.forEach((mlo: any) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${mlo.id || '•'}: `, bold: true, size: 20 }),
                  new TextRun({ text: mlo.statement || '', size: 20 }),
                  new TextRun({
                    text: mlo.bloomLevel ? ` [${mlo.bloomLevel}]` : '',
                    size: 18,
                    color: '718096',
                  }),
                ],
                spacing: { after: 50 },
              })
            );
          });
        }

        if (module.contactActivities?.length) {
          // Format activities properly - handle both string arrays and object arrays
          const formattedContactActivities = module.contactActivities
            .map((activity: any) => {
              if (typeof activity === 'string') return activity;
              // Format object: "Type: Title (Xh)" or just "Title (Xh)"
              const type = activity.type
                ? `${activity.type.charAt(0).toUpperCase()}${activity.type.slice(1)}`
                : '';
              const title = activity.title || activity.description || '';
              const hours = activity.hours ? `(${activity.hours}h)` : '';
              return type ? `${type}: ${title} ${hours}`.trim() : `${title} ${hours}`.trim();
            })
            .filter(Boolean);

          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Contact Activities: ', bold: true, size: 20 }),
                new TextRun({ text: formattedContactActivities.join(', '), size: 20 }),
              ],
              spacing: { after: 50 },
            })
          );
        }

        if (module.independentActivities?.length) {
          // Format activities properly - handle both string arrays and object arrays
          const formattedIndependentActivities = module.independentActivities
            .map((activity: any) => {
              if (typeof activity === 'string') return activity;
              // Format object: "Type: Title (Xh)" or just "Title (Xh)"
              const type = activity.type
                ? `${activity.type.charAt(0).toUpperCase()}${activity.type.slice(1)}`
                : '';
              const title = activity.title || activity.description || '';
              const hours = activity.hours ? `(${activity.hours}h)` : '';
              return type ? `${type}: ${title} ${hours}`.trim() : `${title} ${hours}`.trim();
            })
            .filter(Boolean);

          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Independent Activities: ', bold: true, size: 20 }),
                new TextRun({ text: formattedIndependentActivities.join(', '), size: 20 }),
              ],
              spacing: { after: 150 },
            })
          );
        }
      });
    }

    // =========================================================================
    // Section 5: Academic Sources
    // =========================================================================
    const step5Sources = workflow.step5?.sources || workflow.step5?.topicSources;
    if (step5Sources?.length) {
      const step5 = workflow.step5;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '5. Academic Sources (AGI Standards)',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Summary stats
      contentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Total Sources: ${step5.totalSources || step5Sources.length || '-'} | Peer-Reviewed: ${step5.totalPeerReviewed || '-'}% | Recent (<5yr): ${step5.recentSourcesPercent || '-'}%`,
              size: 20,
              color: '4a5568',
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // Group sources by module if available
      if (step5.sourcesByModule && Object.keys(step5.sourcesByModule).length > 0) {
        Object.entries(step5.sourcesByModule).forEach(([moduleId, sources]: [string, any]) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Module: ${moduleId}`,
                  bold: true,
                  size: 22,
                  color: '1a365d',
                }),
              ],
              spacing: { before: 150, after: 100 },
            })
          );
          sources?.forEach((source: any, idx: number) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `[${idx + 1}] `, bold: true, size: 20 }),
                  new TextRun({ text: source.citation || source.title || '', size: 20 }),
                ],
                spacing: { after: 30 },
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Type: ${source.sourceType || source.source_type || '-'} | Category: ${source.category || '-'}`,
                    size: 18,
                    color: '718096',
                  }),
                ],
                spacing: { after: 80 },
              })
            );
          });
        });
      } else {
        // Flat list of sources
        step5Sources.forEach((source: any, idx: number) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `[${idx + 1}] `, bold: true, size: 20 }),
                new TextRun({ text: source.citation || source.title || '', size: 20 }),
              ],
              spacing: { after: 30 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Type: ${source.sourceType || source.source_type || '-'} | Category: ${source.category || '-'}`,
                  size: 18,
                  color: '718096',
                }),
              ],
              spacing: { after: 80 },
            })
          );
        });
      }
    }

    // =========================================================================
    // Section 6: Reading Lists
    // =========================================================================
    const step6Readings = workflow.step6?.readings || workflow.step6?.moduleReadingLists;
    if (
      step6Readings?.length ||
      (workflow.step6?.moduleReadings && Object.keys(workflow.step6.moduleReadings).length > 0)
    ) {
      const step6 = workflow.step6;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '6. Reading Lists',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Summary stats
      contentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Total Readings: ${step6.totalReadings || step6Readings?.length || '-'} | Core: ${step6.coreCount || '-'} | Supplementary: ${step6.supplementaryCount || '-'}`,
              size: 20,
              color: '4a5568',
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // If we have moduleReadings (grouped by module)
      if (step6.moduleReadings && Object.keys(step6.moduleReadings).length > 0) {
        Object.entries(step6.moduleReadings).forEach(([moduleId, readings]: [string, any]) => {
          contentChildren.push(
            new Paragraph({
              text: moduleId,
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 100 },
            })
          );

          const coreReadings = readings?.filter((r: any) => r.category === 'core') || [];
          const suppReadings = readings?.filter((r: any) => r.category === 'supplementary') || [];

          if (coreReadings.length) {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: 'Core Readings:', bold: true, size: 22 })],
                spacing: { after: 50 },
              })
            );
            coreReadings.forEach((item: any) => {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `• ${item.title || 'Untitled'}`, size: 20 }),
                    new TextRun({
                      text: item.authors?.length ? ` - ${item.authors.join(', ')}` : '',
                      size: 20,
                      color: '718096',
                    }),
                    new TextRun({
                      text: item.estimatedReadingMinutes
                        ? ` (${item.estimatedReadingMinutes} min)`
                        : '',
                      size: 18,
                      color: '4a5568',
                    }),
                  ],
                  spacing: { after: 30 },
                })
              );
            });
          }

          if (suppReadings.length) {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: 'Supplementary Readings:', bold: true, size: 22 })],
                spacing: { before: 100, after: 50 },
              })
            );
            suppReadings.forEach((item: any) => {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `• ${item.title || 'Untitled'}`, size: 20 }),
                    new TextRun({
                      text: item.authors?.length ? ` - ${item.authors.join(', ')}` : '',
                      size: 20,
                      color: '718096',
                    }),
                  ],
                  spacing: { after: 30 },
                })
              );
            });
          }
        });
      } else if (step6Readings?.length) {
        // Flat list - separate core and supplementary
        const coreReadings = step6Readings.filter((r: any) => r.category === 'core');
        const suppReadings = step6Readings.filter((r: any) => r.category === 'supplementary');

        if (coreReadings.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Core Readings:', bold: true, size: 22 })],
              spacing: { after: 50 },
            })
          );
          coreReadings.forEach((item: any) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `• ${item.title || 'Untitled'}`, size: 20 }),
                  new TextRun({
                    text: item.authors?.length ? ` - ${item.authors.join(', ')}` : '',
                    size: 20,
                    color: '718096',
                  }),
                ],
                spacing: { after: 30 },
              })
            );
          });
        }

        if (suppReadings.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Supplementary Readings:', bold: true, size: 22 })],
              spacing: { before: 100, after: 50 },
            })
          );
          suppReadings.forEach((item: any) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `• ${item.title || 'Untitled'}`, size: 20 }),
                  new TextRun({
                    text: item.authors?.length ? ` - ${item.authors.join(', ')}` : '',
                    size: 20,
                    color: '718096',
                  }),
                ],
                spacing: { after: 30 },
              })
            );
          });
        }
      }
    }

    // =========================================================================
    // Section 7: Comprehensive Assessment Package
    // =========================================================================
    if (
      workflow.step7?.formativeAssessments?.length ||
      workflow.step7?.summativeAssessments?.length ||
      workflow.step7?.sampleQuestions
    ) {
      const step7 = workflow.step7;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '7. Comprehensive Assessment Package',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // User Preferences Summary
      const userPrefs = step7.userPreferences || {};
      contentChildren.push(
        new Paragraph({
          text: '7.1 Assessment Strategy',
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
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
                this.createTableCell('Formative Per Module'),
                this.createTableCell(String(userPrefs.formativePerModule || '-')),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Summative Format'),
                this.createTableCell(String(userPrefs.summativeFormat || 'Mixed format')),
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

      // Formative Assessments
      if (step7.formativeAssessments?.length) {
        contentChildren.push(
          new Paragraph({
            text: '7.2 Formative Assessments',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          })
        );
        step7.formativeAssessments.forEach((assessment: any, idx: number) => {
          contentChildren.push(
            new Paragraph({ children: [new PageBreak()] }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Assessment ${idx + 1}: ${assessment.title}`,
                  bold: true,
                  size: 22,
                }),
              ],
              spacing: { before: 150, after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Module: ', bold: true, size: 18 }),
                new TextRun({ text: assessment.moduleId || '-', size: 18, italics: true }),
              ],
              spacing: { after: 20 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Type: ', bold: true, size: 18 }),
                new TextRun({ text: assessment.assessmentType || '-', size: 18 }),
              ],
              spacing: { after: 20 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Max Marks: ', bold: true, size: 18 }),
                new TextRun({ text: String(assessment.maxMarks || '-'), size: 18 }),
              ],
              spacing: { after: 30 },
            }),
            new Paragraph({
              children: [new TextRun({ text: 'Description:', bold: true, size: 18 })],
              spacing: { before: 20, after: 10 },
            }),
            new Paragraph({
              children: [new TextRun({ text: assessment.description || '', size: 18 })],
              spacing: { after: 30 },
            }),
            new Paragraph({
              children: [new TextRun({ text: 'Instructions:', bold: true, size: 18 })],
              spacing: { before: 20, after: 10 },
            }),
            new Paragraph({
              children: [new TextRun({ text: assessment.instructions || '', size: 18 })],
              spacing: { after: 50 },
            })
          );

          // Display ALL QUESTIONS in detail
          if (assessment.questions?.length) {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: 'Questions:', bold: true, size: 20, underline: {} }),
                ],
                spacing: { before: 100, after: 50 },
              })
            );

            assessment.questions.forEach((q: any) => {
              // Question header
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `Q${q.questionNumber}. `,
                      bold: true,
                      size: 19,
                    }),
                    new TextRun({
                      text: `${q.questionText}`,
                      size: 19,
                    }),
                    new TextRun({
                      text: ` [${q.bloomLevel || 'N/A'} | ${q.difficulty || 'Medium'} | ${q.points || 1} pt${q.points > 1 ? 's' : ''}]`,
                      size: 14,
                      color: '6b7280',
                      italics: true,
                    }),
                  ],
                  spacing: { before: 100, after: 40 },
                })
              );

              // MCQ Options
              if (q.questionType === 'mcq' && q.options?.length) {
                q.options.forEach((option: string, optIdx: number) => {
                  const letter = String.fromCharCode(65 + optIdx);
                  const isCorrect = optIdx === q.correctAnswer;
                  contentChildren.push(
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: `   ${letter}. ${option}`,
                          size: 18,
                          bold: isCorrect,
                          color: isCorrect ? '16a34a' : '374151',
                        }),
                        isCorrect
                          ? new TextRun({
                              text: ' ✓ (Correct Answer)',
                              size: 16,
                              color: '16a34a',
                              bold: true,
                            })
                          : new TextRun({ text: '' }),
                      ],
                      spacing: { after: 20 },
                    })
                  );
                });
              }

              // For non-MCQ, show expected answer
              if (q.questionType !== 'mcq' && q.correctAnswer) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '   Expected Answer: ',
                        bold: true,
                        size: 17,
                        color: '1e40af',
                      }),
                      new TextRun({
                        text: String(q.correctAnswer),
                        size: 17,
                        italics: true,
                        color: '1e40af',
                      }),
                    ],
                    spacing: { before: 20, after: 20 },
                  })
                );
              }

              // Rationale
              if (q.rationale) {
                contentChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: '   Rationale: ',
                        bold: true,
                        size: 16,
                        color: '7c3aed',
                      }),
                      new TextRun({ text: q.rationale, size: 16, italics: true, color: '7c3aed' }),
                    ],
                    spacing: { before: 20, after: 50 },
                  })
                );
              }
            });
          } else {
            // No questions generated - show note
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Note: Detailed questions not generated for this assessment.',
                    size: 16,
                    italics: true,
                    color: 'dc2626',
                  }),
                ],
                spacing: { before: 50, after: 100 },
              })
            );
          }
        });
      }

      // Summative Assessments
      if (step7.summativeAssessments?.length) {
        contentChildren.push(
          new Paragraph({
            text: '7.3 Summative Assessments',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          })
        );
        step7.summativeAssessments.forEach((assessment: any, idx: number) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `${idx + 1}. ${assessment.title}`, bold: true, size: 20 }),
              ],
              spacing: { before: 150, after: 50 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Format: ', size: 18 }),
                new TextRun({ text: assessment.format || '-', size: 18 }),
              ],
              spacing: { after: 30 },
            }),
            new Paragraph({
              children: [new TextRun({ text: assessment.overview || '', size: 18 })],
              spacing: { after: 50 },
            })
          );
          if (assessment.components?.length) {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: 'Components:', bold: true, size: 18 })],
                spacing: { before: 50, after: 30 },
              })
            );
            assessment.components.forEach((comp: any) => {
              contentChildren.push(
                new Paragraph({
                  children: [
                    new TextRun({ text: `• ${comp.name}: `, size: 18 }),
                    new TextRun({
                      text: `${comp.weight}% - ${comp.description}`,
                      size: 18,
                      italics: true,
                    }),
                  ],
                  spacing: { after: 20 },
                })
              );
            });
          }
        });
      }

      // Sample Questions Summary
      const sampleQuestions = step7.sampleQuestions || {};
      const totalSamples =
        (sampleQuestions.mcq?.length || 0) +
        (sampleQuestions.sjt?.length || 0) +
        (sampleQuestions.caseQuestions?.length || 0) +
        (sampleQuestions.essayPrompts?.length || 0) +
        (sampleQuestions.practicalTasks?.length || 0);

      if (totalSamples > 0) {
        contentChildren.push(
          new Paragraph({
            text: '7.4 Sample Questions',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  this.createTableCell('Question Type', { bold: true, shading: 'e2e8f0' }),
                  this.createTableCell('Count', { bold: true, shading: 'e2e8f0' }),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('MCQ (Multiple Choice)'),
                  this.createTableCell(String(sampleQuestions.mcq?.length || 0)),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('SJT (Situational Judgment)'),
                  this.createTableCell(String(sampleQuestions.sjt?.length || 0)),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Case Studies'),
                  this.createTableCell(String(sampleQuestions.caseQuestions?.length || 0)),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Essay Prompts'),
                  this.createTableCell(String(sampleQuestions.essayPrompts?.length || 0)),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Practical Tasks'),
                  this.createTableCell(String(sampleQuestions.practicalTasks?.length || 0)),
                ],
              }),
              new TableRow({
                children: [
                  this.createTableCell('Total Sample Questions', { bold: true }),
                  this.createTableCell(String(totalSamples), { bold: true }),
                ],
              }),
            ],
          }),
          new Paragraph({ children: [], spacing: { after: 200 } })
        );

        // Note: Detailed sample questions available in database
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Note: ',
                bold: true,
                size: 18,
                italics: true,
              }),
              new TextRun({
                text: 'Detailed sample questions for each type are stored in the database and can be exported separately.',
                size: 18,
                italics: true,
                color: '6b7280',
              }),
            ],
            spacing: { before: 100, after: 200 },
          })
        );
      }

      // Validation Summary
      if (step7.validation) {
        const validation = step7.validation;
        contentChildren.push(
          new Paragraph({
            text: '7.5 Validation Summary',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 300, after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '✓ ',
                color: validation.allFormativesMapped ? '16a34a' : 'dc2626',
              }),
              new TextRun({ text: 'All formatives mapped to MLOs', size: 18 }),
            ],
            spacing: { after: 30 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '✓ ',
                color: validation.allSummativesMapped ? '16a34a' : 'dc2626',
              }),
              new TextRun({ text: 'All summatives mapped to PLOs', size: 18 }),
            ],
            spacing: { after: 30 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '✓ ', color: validation.weightsSum100 ? '16a34a' : 'dc2626' }),
              new TextRun({ text: 'Component weights sum to 100%', size: 18 }),
            ],
            spacing: { after: 30 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '✓ ',
                color: validation.sufficientSampleQuestions ? '16a34a' : 'dc2626',
              }),
              new TextRun({ text: 'Sufficient sample questions generated', size: 18 }),
            ],
            spacing: { after: 30 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: '✓ ', color: validation.plosCovered ? '16a34a' : 'dc2626' }),
              new TextRun({ text: 'All PLOs covered in assessments', size: 18 }),
            ],
            spacing: { after: 200 },
          })
        );
      }
    }

    // =========================================================================
    // Section 8: Case Studies
    // =========================================================================
    if (workflow.step8?.caseStudies?.length) {
      const step8 = workflow.step8;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '8. Case Studies',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      step8.caseStudies.forEach((cs: any, index: number) => {
        contentChildren.push(
          new Paragraph({
            text: `Case Study ${index + 1}: ${cs.title || 'Untitled'}`,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );

        if (cs.module) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: `Module: ${cs.module}`, size: 20, color: '4a5568' })],
              spacing: { after: 100 },
            })
          );
        }

        if (cs.scenario) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Scenario:', bold: true, size: 22 })],
              spacing: { after: 50 },
            }),
            new Paragraph({
              children: [new TextRun({ text: cs.scenario, size: 20 })],
              spacing: { after: 150 },
            })
          );
        }

        if (cs.keyFacts?.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Key Facts:', bold: true, size: 22 })],
              spacing: { after: 50 },
            })
          );
          cs.keyFacts.forEach((fact: string) => {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: `• ${fact}`, size: 20 })],
                spacing: { after: 30 },
              })
            );
          });
        }

        if (cs.decisionPoints?.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Decision Points:', bold: true, size: 22 })],
              spacing: { before: 100, after: 50 },
            })
          );
          cs.decisionPoints.forEach((point: string, idx: number) => {
            contentChildren.push(
              new Paragraph({
                children: [new TextRun({ text: `${idx + 1}. ${point}`, size: 20 })],
                spacing: { after: 30 },
              })
            );
          });
        }

        if (cs.terminology && Object.keys(cs.terminology).length > 0) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Key Terminology:', bold: true, size: 22 })],
              spacing: { before: 100, after: 50 },
            })
          );
          Object.entries(cs.terminology).forEach(([term, def]) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${term}: `, bold: true, size: 20 }),
                  new TextRun({ text: String(def), size: 20 }),
                ],
                spacing: { after: 30 },
              })
            );
          });
        }
      });
    }

    // =========================================================================
    // Section 9: Glossary
    // =========================================================================
    const step9Terms = workflow.step9?.terms || workflow.step9?.entries;
    if (step9Terms?.length) {
      const step9 = workflow.step9;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '9. Glossary',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Statistics
      contentChildren.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Total Terms: ${step9.totalTerms || step9Terms.length || '-'} | Categories: ${step9.categories?.length || '-'} | Acronyms: ${step9.acronymCount || '-'}`,
              size: 20,
              color: '4a5568',
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // Sort alphabetically
      const sortedTerms = [...step9Terms].sort((a: any, b: any) =>
        (a.term || '').localeCompare(b.term || '')
      );

      sortedTerms.forEach((entry: any) => {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({ text: entry.term || '', bold: true, size: 22 }),
              entry.isAcronym
                ? new TextRun({ text: ' (Acronym)', size: 18, color: '718096', italics: true })
                : new TextRun({ text: '' }),
            ],
            spacing: { before: 100, after: 30 },
          }),
          new Paragraph({
            children: [new TextRun({ text: entry.definition || '', size: 20 })],
            spacing: { after: 30 },
          })
        );

        if (entry.acronymExpansion) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Stands for: ', italics: true, size: 18, color: '4a5568' }),
                new TextRun({ text: entry.acronymExpansion, size: 18, color: '4a5568' }),
              ],
              spacing: { after: 30 },
            })
          );
        }

        if (entry.exampleSentence) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Example: ', italics: true, size: 18, color: '4a5568' }),
                new TextRun({
                  text: entry.exampleSentence,
                  italics: true,
                  size: 18,
                  color: '4a5568',
                }),
              ],
              spacing: { after: 100 },
            })
          );
        }
      });
    }

    // Add main content section
    sections.push({
      properties: {},
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: step1.programTitle || workflow.projectName || 'Curriculum',
                  size: 18,
                  color: '718096',
                }),
              ],
              alignment: AlignmentType.RIGHT,
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
                  children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES],
                  size: 18,
                  color: '718096',
                }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: contentChildren,
    });

    const doc = new Document({
      creator: 'AI Curriculum Generator',
      title: step1.programTitle || workflow.projectName || 'Curriculum Package',
      description: 'Auto-generated curriculum design document',
      styles: {
        paragraphStyles: [
          {
            id: 'Heading1',
            name: 'Heading 1',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: {
              size: 36,
              bold: true,
              color: '1a365d',
            },
            paragraph: {
              spacing: { before: 400, after: 200 },
            },
          },
          {
            id: 'Heading2',
            name: 'Heading 2',
            basedOn: 'Normal',
            next: 'Normal',
            quickFormat: true,
            run: {
              size: 28,
              bold: true,
              color: '2d3748',
            },
            paragraph: {
              spacing: { before: 300, after: 150 },
            },
          },
        ],
      },
      sections,
    });

    return await Packer.toBuffer(doc);
  }
}

export const wordExportService = new WordExportService();
