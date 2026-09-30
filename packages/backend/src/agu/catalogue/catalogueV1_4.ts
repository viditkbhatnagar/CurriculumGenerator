/**
 * American Global University Institutional Catalog v1.4 (published 29 Sep 2026), as the
 * locked record module drafts are built against.
 *
 * Transcribed from the catalogue and cross-checked against v1.3 (12 Aug 2026), which the
 * product owner's specifications were written from: the two editions are word-for-word
 * identical in every course, credential, credit, hour and policy fact once the AGI -> AGU
 * rename is normalised. The course shape (four weeks, one 3-hour live lecture a week, the
 * 40/20/40 assessment scheme) is not in the catalogue; it comes from AGU's Wave 1 faculty
 * templates and is sourced as such.
 *
 * approvalStatus stays 'pending_confirmation' until AGU confirms v1.4 is its approved edition.
 */
import { CatalogueCourse, CatalogueEdition } from './types';

const HOURS = { total: 135, contact: 45, independent: 90 };
const CORE = 'Catalog v1.4 §4.2';
const FINTECH = 'Catalog v1.4 §4.3.1';
const FINANCE = 'Catalog v1.4 §4.3.2';
const SCO = 'Catalog v1.4 §4.3.3';

const core = (
  sequence: number,
  code: string,
  title: string,
  role: CatalogueCourse['role'],
  roleLabel: string,
  description: string,
  deliveryWindow: string,
  catalogueFaculty: string,
  rplEligible: CatalogueCourse['rplEligible'] = 'designated_only'
): CatalogueCourse => ({
  code,
  title,
  track: 'core',
  sequence,
  role,
  roleLabel,
  semesterCredits: 3,
  hours: HOURS,
  description,
  descriptionMissing: false,
  deliveryWindow,
  catalogueFaculty,
  rplEligible,
  source: CORE,
});

const track = (
  trackId: CatalogueCourse['track'],
  source: string,
  gateway: string,
  window: string,
  sequence: number,
  code: string,
  title: string,
  role: CatalogueCourse['role'],
  roleLabel: string,
  description: string,
  catalogueFaculty: string
): CatalogueCourse => ({
  code,
  title,
  track: trackId,
  sequence,
  role,
  roleLabel,
  semesterCredits: 3,
  hours: HOURS,
  description,
  descriptionMissing: !description,
  mbaGateway: gateway,
  deliveryWindow: window,
  catalogueFaculty,
  rplEligible: role === 'capstone' ? 'not_eligible' : 'designated_only',
  source,
});

const FT_WINDOW = 'FinTech window M8–M11 (Apr–Jul 2027)';
const FN_WINDOW = 'Finance window M8–M11 (Apr–Jul 2027)';
const SC_WINDOW = 'Supply Chain & Operations window M2–M5 (Oct 2026–Jan 2027)';

export const AGU_CATALOGUE_V1_4: CatalogueEdition = {
  institution: {
    legalName: 'American Global University Inc.',
    shortName: 'AGU',
    registration: {
      value:
        'Registered under the Utah Postsecondary School and State Authorization Act; Registration (Amended), reference 14306557-9984, effective 28 Aug 2026, expires 28 Aug 2027. Registration is not an endorsement, recommendation or approval.',
      source: 'Utah DCP certificate; Catalog v1.4 §2',
    },
    accreditation: { value: 'Not accredited.', source: 'Catalog v1.4 §2' },
  },
  edition: {
    version: '1.4',
    published: '2026-09-29',
    effective: '2026-08-28',
    approvalStatus: 'pending_confirmation',
    approvalNote:
      'Confirm with AGU that v1.4 is the approved controlling edition before any draft is issued as final.',
  },
  credentials: [
    {
      id: 'course_certificate',
      name: 'Course Certificate',
      composition: "The specialization's entry course, taken standalone (FT01, FN01 or SC01)",
      courses: 1,
      semesterCredits: 3,
      learningHours: 135,
      source: 'Catalog v1.4 §4, §4.4',
    },
    {
      id: 'specialized_diploma',
      name: 'Specialized Diploma',
      composition: "CR01 plus the specialization's 4 courses",
      courses: 5,
      semesterCredits: 15,
      learningHours: 675,
      source: 'Catalog v1.4 §4, §4.5',
    },
    {
      id: 'mba',
      name: 'Master of Business Administration (MBA)',
      composition:
        'The 12-course core plus one specialization; the specialization is named on the award',
      courses: 16,
      semesterCredits: 48,
      learningHours: 2160,
      source: 'Catalog v1.4 §4, §4.6',
    },
  ],
  courses: [
    core(
      1,
      'CR01',
      'Financial Accounting & Integrated Reporting',
      'foundation',
      'Foundation — required in every Specialized Diploma',
      'Provides the knowledge and practical skills to prepare, analyze, and communicate financial and non-financial information in a rapidly evolving global business environment. Integrates traditional financial accounting principles with contemporary ESG reporting practices and integrated-reporting frameworks, including materiality assessment, stakeholder accountability, corporate governance, climate-related financial risks, ESG metrics, assurance considerations, and ethical decision-making.',
      'M4 Dec 2026',
      'Lead Bincy B. Kaluvilla; Backup Anjali Ramakrishna Pai'
    ),
    core(
      2,
      'CR02',
      'Corporate Finance & Intro to FinTech',
      'gateway',
      'Gateway → Finance; FinTech',
      'Builds a comprehensive understanding of corporate financial decision-making while introducing the transformative impact of financial technology on modern financial systems. Covers capital budgeting, capital structure, cost of capital, dividend policy, valuation techniques, and risk-return analysis, bridged with the digital innovations reshaping capital markets, payments, lending, and investment management.',
      'M7 Mar 2027',
      'Lead Anjali Pai'
    ),
    core(
      3,
      'CR03',
      'Digital-First Marketing Management',
      'foundation',
      'Foundation',
      'Provides a comprehensive understanding of how modern marketing strategies are designed, implemented, and optimized in digitally driven business environments. Covers segmentation, targeting, positioning, branding, and consumer behavior, applied across digital channels including search, social media, content, email, influencer, and mobile marketing.',
      'M2 Oct 2026',
      'Lead Anjali Pai'
    ),
    core(
      4,
      'CR04',
      'Managing People & the Future of Work',
      'foundation',
      'Foundation',
      'Examines the evolving nature of work, workforce dynamics, and people management in an increasingly digital, globalized, and flexible labor environment. Covers talent acquisition, performance management, employee engagement, leadership, organizational behavior, and workforce planning in the context of remote and hybrid work, automation and AI, gig economies, and workforce diversity and inclusion.',
      'M3 Nov 2026',
      'Lead Jyothi Iyer'
    ),
    core(
      5,
      'CR05',
      'Operations & Digital Supply Chains',
      'gateway',
      'Gateway → Supply Chain & Operations',
      'Provides a comprehensive understanding of how modern operations management and supply chain systems are designed, optimized, and transformed through digital technologies such as automation, AI, blockchain, IoT, and advanced analytics. Covers operations strategy, process design, capacity planning, inventory management, logistics, procurement, and supply chain coordination.',
      'M1 Sep 2026',
      'Lead Rejin Rajan'
    ),
    core(
      6,
      'CR06',
      'Strategy in the Age of Digital Transformation',
      'foundation',
      'Foundation',
      'Examines how organizations formulate, implement, and sustain competitive advantage in an era of rapid technological change and digital disruption. Integrates classical strategic management theory — competitive positioning, value creation, industry analysis, strategic planning — with digital business models, platform ecosystems, and technology-driven business-model innovation.',
      'M6 Feb 2027',
      'Lead Sherin Thomas'
    ),
    core(
      7,
      'CR07',
      'Managerial Economics & Sustainability',
      'foundation',
      'Foundation',
      'Integrates core economic principles with sustainability-focused decision-making. Covers demand and supply analysis, elasticity, production theory, cost structures, market structures, and pricing strategies, applied to evaluate how firms allocate resources, respond to market forces, and optimize performance efficiently, ethically, and sustainably.',
      'M5 Jan 2027',
      'Lead Anjali Pai; Support Bincy Kaluvilla'
    ),
    core(
      8,
      'CR08',
      'Business Analytics & AI for Decision-Making',
      'analytics_spine',
      'Analytics spine',
      'Equips learners with the analytical, quantitative, and technological skills required to transform data into actionable business insights. Covers data collection and preparation, descriptive and predictive analytics, data visualization, statistical analysis, and machine learning fundamentals in support of evidence-based decision-making.',
      'M8 Apr 2027',
      'Lead Sherin Thomas; Support Ishika Jain'
    ),
    core(
      9,
      'CR09',
      'Agile Project Management',
      'foundation',
      'Foundation',
      'Equips learners to manage projects in dynamic, fast-paced, and uncertain business environments using Agile methodologies and frameworks, including Scrum, Kanban, and Lean. Covers project planning, scope definition, scheduling, resource allocation, risk management, and stakeholder engagement with emphasis on iterative, value-driven delivery.',
      'M9 May 2027',
      'Lead Rejin Rajan'
    ),
    core(
      10,
      'CR10',
      'Leadership & Change in Digital Organizations',
      'foundation',
      'Foundation',
      'Develops the knowledge and skills required to lead teams and manage organizational change in digitally driven environments. Integrates foundational leadership theory — leadership styles, emotional intelligence, decision-making, motivation, team dynamics — with change-management frameworks such as Kotter’s 8-Step Model and ADKAR, applied to digital transformation initiatives.',
      'M10 Jun 2027',
      'Lead Jyothi Iyer; Support Meghna Singh'
    ),
    core(
      11,
      'CR11',
      'Data-Driven Research Methods',
      'foundation',
      'Foundation',
      'Equips learners to design, conduct, analyze, and communicate research using data-driven approaches. Covers research design, data collection methods, sampling, data management, statistical analysis, data visualization, and the ethical use of data, with hands-on experience in digital research tools.',
      'M11 Jul 2027',
      'Lead Sherin Thomas',
      'not_eligible'
    ),
    core(
      12,
      'CR12',
      'Governance, Ethics & ESG',
      'foundation',
      'Foundation',
      'Provides a comprehensive understanding of how organizations are governed and how ethical principles and sustainability frameworks shape responsible decision-making. Covers corporate governance structures, regulatory compliance, stakeholder accountability, business ethics, corporate responsibility, and ESG frameworks integrated into organizational strategy.',
      'M12 Aug 2027',
      'Lead Bincy Kaluvilla'
    ),

    track(
      'fintech',
      FINTECH,
      'CR02',
      FT_WINDOW,
      1,
      'FT01',
      'Foundations of FinTech & Digital Finance',
      'entry',
      'Entry → Course Certificate',
      '',
      'Lead Anjali Pai'
    ),
    track(
      'fintech',
      FINTECH,
      'CR02',
      FT_WINDOW,
      2,
      'FT02',
      'Digital Payments & Banking Technology',
      'concentration',
      'Concentration',
      'Provides a comprehensive understanding of the evolving financial-services ecosystem driven by digital innovation, regulatory transformation, and emerging technologies. Covers the architecture of digital payment systems — card networks, real-time payment rails, mobile wallets, open banking frameworks, and cross-border payment infrastructures — and the roles of banks, fintechs, payment service providers, and central banks.',
      'Lead Anjali Pai; Support Ishika Jain'
    ),
    track(
      'fintech',
      FINTECH,
      'CR02',
      FT_WINDOW,
      3,
      'FT04',
      'Financial Data Analytics',
      'concentration',
      'Concentration',
      'Provides a comprehensive understanding of how data-driven techniques are transforming finance, banking, and investment decision-making. Covers data collection, cleaning, and transformation; statistical analysis; predictive modeling; and visualization, applied to structured and unstructured financial data such as transaction records, market feeds, customer behavior, and risk indicators.',
      'Lead Anjali Pai; Support Ishika Jain'
    ),
    track(
      'fintech',
      FINTECH,
      'CR02',
      FT_WINDOW,
      4,
      'FT06',
      'FinTech Capstone Project',
      'capstone',
      'Capstone',
      '',
      'Lead Anjali Pai; Capstone supervision Sherin Thomas'
    ),

    track(
      'finance',
      FINANCE,
      'CR02',
      FN_WINDOW,
      1,
      'FN01',
      'Advanced Corporate Finance',
      'entry',
      'Entry → Course Certificate',
      '',
      'Lead Anjali Pai'
    ),
    track(
      'finance',
      FINANCE,
      'CR02',
      FN_WINDOW,
      2,
      'FN02',
      'International Finance',
      'concentration',
      'Concentration',
      'Provides a comprehensive understanding of how financial systems operate across global markets, focusing on cross-border capital flows, foreign exchange markets, international investment strategies, and global financial institutions. Covers exchange-rate mechanisms, balance of payments, international monetary systems, global risk management, and multinational corporate finance.',
      'Lead Bincy Kaluvilla; Support Ishika Jain'
    ),
    track(
      'finance',
      FINANCE,
      'CR02',
      FN_WINDOW,
      3,
      'FN04',
      'Investment & Portfolio Management',
      'concentration',
      'Concentration',
      'Provides a comprehensive understanding of investment principles, portfolio construction, asset valuation, and risk management. Covers financial markets, asset classes, security analysis, portfolio theory, asset allocation, performance evaluation, behavioral finance, and alternative investments, with practical use of industry-relevant tools and data.',
      'Lead Anjali Pai'
    ),
    track(
      'finance',
      FINANCE,
      'CR02',
      FN_WINDOW,
      4,
      'FN06',
      'Finance Capstone',
      'capstone',
      'Capstone',
      '',
      'Lead Anjali Pai; Capstone supervision Sherin Thomas'
    ),

    track(
      'supply_chain_operations',
      SCO,
      'CR05',
      SC_WINDOW,
      1,
      'SC01',
      'Global Supply Chain Strategy',
      'entry',
      'Entry → Course Certificate',
      '',
      'Lead Rejin Rajan'
    ),
    track(
      'supply_chain_operations',
      SCO,
      'CR05',
      SC_WINDOW,
      2,
      'SC02',
      'Logistics & Distribution Management',
      'concentration',
      'Concentration',
      'Provides a comprehensive understanding of logistics and distribution management within modern supply chains — the planning, implementation, and control of the efficient flow of goods, services, and information from origin to consumption. Covers supply chain design, transportation management, warehousing operations, inventory control, order fulfillment, procurement, and distribution network optimization.',
      'Lead Rejin Rajan'
    ),
    track(
      'supply_chain_operations',
      SCO,
      'CR05',
      SC_WINDOW,
      3,
      'SC03',
      'Lean & Six Sigma',
      'concentration',
      'Concentration',
      'Provides a comprehensive understanding of Lean and Six Sigma methodologies for process improvement, operational excellence, and quality management. Covers Lean thinking, the Six Sigma DMAIC methodology, process mapping, statistical analysis, and quality-control tools for identifying inefficiencies, analyzing root causes, and implementing sustainable improvements.',
      'Lead Rejin Rajan'
    ),
    track(
      'supply_chain_operations',
      SCO,
      'CR05',
      SC_WINDOW,
      4,
      'SC06',
      'Supply Chain Capstone',
      'capstone',
      'Capstone',
      '',
      'Lead Rejin Rajan; Capstone supervision Sherin Thomas'
    ),
  ],
  courseShape: {
    weeks: { value: 4, source: 'AGU template T01' },
    liveLecturesPerWeek: { value: 1, source: 'AGU template T01' },
    liveLectureHours: { value: 3, source: 'AGU template T01, T03' },
    contactHours: { value: 45, source: 'Catalog v1.4 §4; AGU template T04' },
    independentHours: { value: 90, source: 'Catalog v1.4 §4; AGU template T04' },
    contactHourDefinition: {
      value:
        'An hour only counts as contact if it involves direct, regular faculty participation and the platform can log it. Viewing content and using the AI tutor are engagement, not contact.',
      source: 'AGU template T04',
    },
    outcomeCount: { value: { min: 4, max: 6 }, source: 'AGU template T01' },
    assessment: {
      value: [
        { component: 'Applied assignment', weight: 40 },
        { component: 'Weekly quizzes / discussion', weight: 20 },
        { component: 'Proctored final exam', weight: 40 },
      ],
      source: 'AGU templates T01, T02',
    },
    capstoneAssessment: {
      value:
        'Capstones (FT06, FN06, SC06) replace the 40/20/40 scheme with a design approved through T13.',
      source: 'AGU template T13',
    },
  },
  policies: [
    {
      id: 'grading',
      statement:
        'Letter grades A to B- pass; B- (2.7) is the minimum passing grade; there is no Pass/Fail and no Incomplete. A Course Certificate requires B (3.0).',
      source: 'Catalog v1.4 §5; template T02',
    },
    {
      id: 'resit',
      statement: 'One free assessment resit where the course rules permit.',
      source: 'Catalog v1.4 §5',
    },
    {
      id: 'proctoring',
      statement:
        'Final examinations are proctored (browser lockdown, webcam verification, ID match); quizzes and formative assessments are not.',
      source: 'Catalog v1.4 §9.8; template T09',
    },
    {
      id: 'no_library',
      statement:
        'AGU has no library or research-database subscriptions. Every required item must be openly accessible, original, or cleared for use, and supplied through the platform.',
      source: 'Catalog v1.4; template T05',
    },
    {
      id: 'materials_included',
      statement:
        'Course materials are included in tuition; students are not required to buy textbooks or install software.',
      source: 'Catalog v1.4 §4.4',
    },
    {
      id: 'ai_misuse',
      statement:
        'Misconduct includes using AI tools in a way that violates the stated rules of an assessment, so every assessment must state its AI rules.',
      source: 'Catalog v1.4 academic integrity',
    },
    {
      id: 'ai_tutor',
      statement:
        'The course AI tutor explains and guides; it must refuse to produce graded or summative work.',
      source: 'AGU templates T02, T11',
    },
    {
      id: 'attendance',
      statement:
        'Attendance is recorded LMS activity; a 14-day inactivity warning and 21-day withdrawal apply.',
      source: 'Catalog v1.4 §5.3',
    },
    {
      id: 'response_time',
      statement:
        'Instructors reply within two business days (Mountain Time, excluding institutional holidays).',
      source: 'Catalog v1.4 §9.3; template T02',
    },
  ],
};

export function catalogueCourse(code: string): CatalogueCourse | undefined {
  const wanted = code.trim().toUpperCase();
  return AGU_CATALOGUE_V1_4.courses.find((c) => c.code === wanted);
}
