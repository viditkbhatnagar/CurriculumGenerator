import db from './index';

async function seed() {
  console.log('Starting database seeding...');

  try {
    // Seed users
    console.log('Seeding users...');
    const userResult = await db.query(`
      INSERT INTO users (email, role, auth_provider_id)
      VALUES 
        ('admin@agcq.edu', 'Administrator', 'auth0|admin123'),
        ('sme1@agcq.edu', 'SME', 'auth0|sme123'),
        ('sme2@agcq.edu', 'SME', 'auth0|sme456'),
        ('student1@agcq.edu', 'Student', 'auth0|student123'),
        ('student2@agcq.edu', 'Student', 'auth0|student456')
      ON CONFLICT (email) DO NOTHING
      RETURNING id, email, role
    `);
    console.log(`Seeded ${userResult.rowCount} users`);

    // Get admin user ID for program creation
    const adminUser = await db.query(`
      SELECT id FROM users WHERE email = 'admin@agcq.edu'
    `);
    const adminId = adminUser.rows[0]?.id;

    if (!adminId) {
      throw new Error('Admin user not found');
    }

    // Seed programs
    console.log('Seeding programs...');
    const programResult = await db.query(`
      INSERT INTO programs (
        program_name, 
        qualification_level, 
        qualification_type, 
        total_credits, 
        industry_sector, 
        status, 
        created_by
      )
      VALUES 
        (
          'Business Intelligence and Data Analytics', 
          'Level 5', 
          'Professional Certificate', 
          120, 
          'Information Technology',
          'draft',
          $1
        ),
        (
          'Project Management Professional', 
          'Level 6', 
          'Professional Certificate', 
          120, 
          'Business Management',
          'submitted',
          $1
        ),
        (
          'Cybersecurity Fundamentals', 
          'Level 4', 
          'Professional Certificate', 
          120, 
          'Information Security',
          'approved',
          $1
        )
      RETURNING id, program_name
    `, [adminId]);
    console.log(`Seeded ${programResult.rowCount} programs`);

    const programs = programResult.rows;

    // Seed modules for the first program
    if (programs.length > 0) {
      console.log('Seeding modules...');
      const moduleResult = await db.query(`
        INSERT INTO modules (
          program_id, 
          module_code, 
          module_title, 
          hours, 
          module_aim, 
          core_elective, 
          sequence_order
        )
        VALUES 
          (
            $1, 
            'BI101', 
            'Introduction to Business Intelligence', 
            20, 
            'Provide foundational understanding of BI concepts and tools',
            'Core',
            1
          ),
          (
            $1, 
            'DA102', 
            'Data Analytics Fundamentals', 
            20, 
            'Develop skills in data analysis and visualization',
            'Core',
            2
          ),
          (
            $1, 
            'SQL103', 
            'SQL and Database Management', 
            20, 
            'Master SQL queries and database design principles',
            'Core',
            3
          ),
          (
            $1, 
            'VIZ104', 
            'Data Visualization Techniques', 
            20, 
            'Learn to create effective data visualizations',
            'Core',
            4
          ),
          (
            $1, 
            'ADV105', 
            'Advanced Analytics and Reporting', 
            20, 
            'Apply advanced analytical techniques to business problems',
            'Core',
            5
          ),
          (
            $1, 
            'CAP106', 
            'Capstone Project', 
            20, 
            'Integrate learning through a comprehensive BI project',
            'Core',
            6
          )
        RETURNING id, module_code, module_title
      `, [programs[0].id]);
      console.log(`Seeded ${moduleResult.rowCount} modules`);

      const modules = moduleResult.rows;

      // Seed learning outcomes for the first module
      if (modules.length > 0) {
        console.log('Seeding learning outcomes...');
        const outcomeResult = await db.query(`
          INSERT INTO learning_outcomes (
            module_id, 
            outcome_text, 
            assessment_criteria, 
            knowledge_skill_competency, 
            bloom_level
          )
          VALUES 
            (
              $1, 
              'Define key business intelligence concepts and terminology',
              '["Accurately define at least 10 BI terms", "Explain the purpose of BI in organizations"]'::jsonb,
              'Knowledge',
              'Remember'
            ),
            (
              $1, 
              'Explain the role of BI in organizational decision-making',
              '["Describe how BI supports strategic decisions", "Identify BI use cases in different industries"]'::jsonb,
              'Knowledge',
              'Understand'
            ),
            (
              $1, 
              'Identify common BI tools and their applications',
              '["List at least 5 BI tools", "Match tools to appropriate use cases"]'::jsonb,
              'Knowledge',
              'Apply'
            ),
            (
              $1, 
              'Analyze business requirements for BI solutions',
              '["Conduct stakeholder interviews", "Document business requirements"]'::jsonb,
              'Skill',
              'Analyze'
            ),
            (
              $1, 
              'Evaluate the effectiveness of BI implementations',
              '["Assess BI solution against requirements", "Recommend improvements"]'::jsonb,
              'Competency',
              'Evaluate'
            )
        `, [modules[0].id]);
        console.log(`Seeded ${outcomeResult.rowCount} learning outcomes`);

        // Seed assessments for the first module
        console.log('Seeding assessments...');
        const assessmentResult = await db.query(`
          INSERT INTO assessments (
            module_id, 
            question_type, 
            question_text, 
            options, 
            correct_answer, 
            explanation, 
            difficulty,
            learning_outcome_id
          )
          VALUES 
            (
              $1, 
              'multiple_choice', 
              'What is the primary purpose of Business Intelligence?',
              '["To replace human decision-making", "To support data-driven decision-making", "To automate all business processes", "To eliminate the need for databases"]'::jsonb,
              'To support data-driven decision-making',
              'BI tools help organizations make informed decisions by analyzing data and presenting actionable insights.',
              'easy',
              (SELECT id FROM learning_outcomes WHERE module_id = $1 LIMIT 1)
            ),
            (
              $1, 
              'multiple_choice', 
              'Which of the following is NOT a common BI tool?',
              '["Tableau", "Power BI", "Microsoft Word", "QlikView"]'::jsonb,
              'Microsoft Word',
              'Microsoft Word is a word processor, not a BI tool. Tableau, Power BI, and QlikView are all popular BI platforms.',
              'easy',
              (SELECT id FROM learning_outcomes WHERE module_id = $1 LIMIT 1)
            ),
            (
              $1, 
              'case_study', 
              'A retail company wants to analyze customer purchasing patterns. Describe how BI could help and what data sources would be relevant.',
              NULL,
              NULL,
              'Expected answer should include: transaction data, customer demographics, seasonal trends, product categories, and how BI tools can visualize and analyze these patterns.',
              'medium',
              (SELECT id FROM learning_outcomes WHERE module_id = $1 LIMIT 1)
            )
        `, [modules[0].id]);
        console.log(`Seeded ${assessmentResult.rowCount} assessments`);
      }

      // Seed skill mappings for the first program
      console.log('Seeding skill mappings...');
      const skillResult = await db.query(`
        INSERT INTO skill_mappings (
          program_id, 
          skill_name, 
          domain, 
          activities, 
          kpis,
          assessment_criteria
        )
        VALUES 
          (
            $1, 
            'Data Analysis', 
            'Technical Skills',
            '[
              {
                "name": "Sales Data Analysis Exercise",
                "description": "Analyze quarterly sales data to identify trends",
                "unitLink": "DA102",
                "durationHours": 4,
                "assessmentType": "Practical Assignment",
                "resources": ["Sample dataset", "Analysis template"]
              }
            ]'::jsonb,
            '[
              {
                "name": "Analysis Accuracy",
                "description": "Correctly identify at least 90% of key trends",
                "threshold": 90,
                "unit": "percentage"
              },
              {
                "name": "Completion Time",
                "description": "Complete analysis within allocated time",
                "threshold": 4,
                "unit": "hours"
              }
            ]'::jsonb,
            '["Accurate data interpretation", "Appropriate analytical techniques", "Clear documentation"]'::jsonb
          ),
          (
            $1, 
            'SQL Querying', 
            'Technical Skills',
            '[
              {
                "name": "Database Query Challenge",
                "description": "Write complex SQL queries to extract business insights",
                "unitLink": "SQL103",
                "durationHours": 3,
                "assessmentType": "Practical Test",
                "resources": ["Practice database", "Query requirements"]
              }
            ]'::jsonb,
            '[
              {
                "name": "Query Correctness",
                "description": "All queries return correct results",
                "threshold": 100,
                "unit": "percentage"
              },
              {
                "name": "Query Efficiency",
                "description": "Queries execute in under 2 seconds",
                "threshold": 2,
                "unit": "seconds"
              }
            ]'::jsonb,
            '["Correct syntax", "Optimal query structure", "Proper use of joins and aggregations"]'::jsonb
          )
      `, [programs[0].id]);
      console.log(`Seeded ${skillResult.rowCount} skill mappings`);

      // Seed generation jobs
      console.log('Seeding generation jobs...');
      const jobResult = await db.query(`
        INSERT INTO generation_jobs (
          program_id, 
          status, 
          progress, 
          started_at, 
          completed_at
        )
        VALUES 
          ($1, 'completed', 100, NOW() - INTERVAL '1 hour', NOW() - INTERVAL '30 minutes'),
          ($2, 'processing', 45, NOW() - INTERVAL '5 minutes', NULL),
          ($3, 'queued', 0, NULL, NULL)
      `, [programs[0].id, programs[1]?.id || programs[0].id, programs[2]?.id || programs[0].id]);
      console.log(`Seeded ${jobResult.rowCount} generation jobs`);
    }

    // Seed knowledge base
    console.log('Seeding knowledge base...');
    const kbResult = await db.query(`
      INSERT INTO knowledge_base (
        content, 
        source_url, 
        source_type, 
        publication_date, 
        domain, 
        credibility_score,
        metadata,
        embedding_id
      )
      VALUES 
        (
          'Business Intelligence (BI) comprises the strategies and technologies used by enterprises for data analysis of business information.',
          'https://example.com/bi-fundamentals',
          'peer-reviewed',
          '2023-01-15',
          'Business Intelligence',
          95,
          '{"author": "Dr. Jane Smith", "journal": "Journal of Business Analytics", "tags": ["BI", "fundamentals"]}'::jsonb,
          'emb_001'
        ),
        (
          'Data visualization is the graphical representation of information and data using visual elements like charts, graphs, and maps.',
          'https://example.com/data-viz-guide',
          'professional-association',
          '2023-06-20',
          'Data Visualization',
          90,
          '{"author": "Data Science Association", "tags": ["visualization", "charts"]}'::jsonb,
          'emb_002'
        ),
        (
          'SQL (Structured Query Language) is a standard language for storing, manipulating and retrieving data in databases.',
          'https://example.com/sql-reference',
          'textbook',
          '2022-03-10',
          'Database Management',
          88,
          '{"author": "Tech Publishers", "edition": "5th", "tags": ["SQL", "databases"]}'::jsonb,
          'emb_003'
        )
    `);
    console.log(`Seeded ${kbResult.rowCount} knowledge base entries`);

    // Seed competitor programs
    console.log('Seeding competitor programs...');
    const competitorResult = await db.query(`
      INSERT INTO competitor_programs (
        institution_name, 
        program_name, 
        level, 
        topics,
        structure
      )
      VALUES 
        (
          'Tech University',
          'Business Analytics Certificate',
          'Level 5',
          '["Data Analysis", "Business Intelligence Tools", "Statistical Methods", "Data Visualization", "Predictive Analytics"]'::jsonb,
          '{"modules": 6, "totalHours": 120, "assessmentTypes": ["exams", "projects", "case studies"]}'::jsonb
        ),
        (
          'Business School Online',
          'Data-Driven Decision Making',
          'Level 5',
          '["BI Fundamentals", "SQL", "Excel Analytics", "Dashboard Design", "Business Reporting"]'::jsonb,
          '{"modules": 5, "totalHours": 100, "assessmentTypes": ["assignments", "final project"]}'::jsonb
        )
    `);
    console.log(`Seeded ${competitorResult.rowCount} competitor programs`);

    // Seed audit logs
    console.log('Seeding audit logs...');
    const auditResult = await db.query(`
      INSERT INTO audit_logs (
        user_id, 
        action, 
        resource_type, 
        resource_id,
        details
      )
      VALUES 
        (
          $1,
          'program_created',
          'program',
          (SELECT id FROM programs LIMIT 1),
          '{"program_name": "Business Intelligence and Data Analytics"}'::jsonb
        ),
        (
          $1,
          'curriculum_generated',
          'program',
          (SELECT id FROM programs LIMIT 1),
          '{"status": "completed", "duration_seconds": 245}'::jsonb
        )
    `, [adminId]);
    console.log(`Seeded ${auditResult.rowCount} audit logs`);

    console.log('Database seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    await db.close();
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed script finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed script failed:', error);
      process.exit(1);
    });
}

export default seed;
