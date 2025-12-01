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
    // Section 2: Competency Framework (KSA)
    // =========================================================================
    if (workflow.step2) {
      const step2 = workflow.step2;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '2. Competency Framework (KSA)',
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

      // Attitude Items
      if (step2.attitudeItems?.length) {
        contentChildren.push(
          new Paragraph({
            text: 'Attitudes',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );
        step2.attitudeItems.forEach((item: any) => {
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
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Contact Activities: ', bold: true, size: 20 }),
                new TextRun({ text: module.contactActivities.join(', '), size: 20 }),
              ],
              spacing: { after: 50 },
            })
          );
        }

        if (module.independentActivities?.length) {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: 'Independent Activities: ', bold: true, size: 20 }),
                new TextRun({ text: module.independentActivities.join(', '), size: 20 }),
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
    if (workflow.step5?.topicSources?.length) {
      const step5 = workflow.step5;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '5. Academic Sources (AGI Standards)',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      if (step5.validationSummary) {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Total Sources: ${step5.validationSummary.total_sources || '-'} | Peer-Reviewed: ${step5.validationSummary.peer_reviewed_count || '-'} | Applied: ${step5.validationSummary.applied_count || '-'}`,
                size: 20,
                color: '4a5568',
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }

      step5.topicSources.forEach((topicSource: any) => {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Topic: ${topicSource.topic}`,
                bold: true,
                size: 22,
                color: '1a365d',
              }),
            ],
            spacing: { before: 150, after: 100 },
          })
        );
        topicSource.sources?.forEach((source: any, idx: number) => {
          contentChildren.push(
            new Paragraph({
              children: [
                new TextRun({ text: `[${idx + 1}] `, bold: true, size: 20 }),
                new TextRun({ text: source.citation || '', size: 20 }),
              ],
              spacing: { after: 30 },
            }),
            new Paragraph({
              children: [
                new TextRun({
                  text: `Type: ${source.source_type || '-'} | Classification: ${source.classification || '-'}`,
                  size: 18,
                  color: '718096',
                }),
              ],
              spacing: { after: 80 },
            })
          );
        });
      });
    }

    // =========================================================================
    // Section 6: Reading Lists
    // =========================================================================
    if (workflow.step6?.moduleReadingLists?.length) {
      const step6 = workflow.step6;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '6. Reading Lists',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      step6.moduleReadingLists.forEach((list: any) => {
        contentChildren.push(
          new Paragraph({
            text: list.module || 'Module',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 100 },
          })
        );

        if (list.coreReadings?.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Core Readings:', bold: true, size: 22 })],
              spacing: { after: 50 },
            })
          );
          list.coreReadings.forEach((item: any) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `• ${item.title || 'Untitled'}`, size: 20 }),
                  new TextRun({
                    text: ` - ${item.author || 'Unknown'}`,
                    size: 20,
                    color: '718096',
                  }),
                  new TextRun({
                    text: item.effortMinutes ? ` (${item.effortMinutes} min)` : '',
                    size: 18,
                    color: '4a5568',
                  }),
                ],
                spacing: { after: 30 },
              })
            );
          });
        }

        if (list.supplementaryReadings?.length) {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: 'Supplementary Readings:', bold: true, size: 22 })],
              spacing: { before: 100, after: 50 },
            })
          );
          list.supplementaryReadings.forEach((item: any) => {
            contentChildren.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `• ${item.title || 'Untitled'}`, size: 20 }),
                  new TextRun({
                    text: ` - ${item.author || 'Unknown'}`,
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
    }

    // =========================================================================
    // Section 7: Assessment Blueprint
    // =========================================================================
    if (workflow.step7?.blueprint) {
      const step7 = workflow.step7;
      contentChildren.push(
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          text: '7. Assessment Blueprint',
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      const blueprint = step7.blueprint;
      contentChildren.push(
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
                this.createTableCell('Final Exam Weight'),
                this.createTableCell(`${blueprint.finalExamWeight || '-'}%`),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Pass Mark'),
                this.createTableCell(`${blueprint.passMark || '-'}%`),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Questions Per Quiz'),
                this.createTableCell(String(blueprint.questionsPerQuiz || '-')),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Questions for Final'),
                this.createTableCell(String(blueprint.questionsForFinal || '-')),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Bank Multiplier'),
                this.createTableCell(`${blueprint.bankMultiplier || '-'}x`),
              ],
            }),
            new TableRow({
              children: [
                this.createTableCell('Randomize Questions'),
                this.createTableCell(blueprint.randomize ? 'Yes' : 'No'),
              ],
            }),
          ],
        }),
        new Paragraph({ children: [], spacing: { after: 200 } })
      );

      if (blueprint.moduleQuizWeights?.length) {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: 'Module Quiz Weights:', bold: true, size: 22 })],
            spacing: { before: 100, after: 100 },
          })
        );
        blueprint.moduleQuizWeights.forEach((mw: any) => {
          contentChildren.push(
            new Paragraph({
              children: [new TextRun({ text: `• ${mw.moduleId}: ${mw.weight}%`, size: 20 })],
              spacing: { after: 30 },
            })
          );
        });
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
    if (workflow.step9?.entries?.length) {
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
      if (step9.statistics) {
        contentChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `Total Entries: ${step9.statistics.totalEntries || step9.totalTerms || '-'}`,
                size: 20,
                color: '4a5568',
              }),
            ],
            spacing: { after: 200 },
          })
        );
      }

      // Sort alphabetically
      const sortedTerms = [...step9.entries].sort((a: any, b: any) =>
        (a.term || '').localeCompare(b.term || '')
      );

      sortedTerms.forEach((entry: any) => {
        contentChildren.push(
          new Paragraph({
            children: [new TextRun({ text: entry.term || '', bold: true, size: 22 })],
            spacing: { before: 100, after: 30 },
          }),
          new Paragraph({
            children: [new TextRun({ text: entry.definition || '', size: 20 })],
            spacing: { after: 30 },
          })
        );

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
