/**
 * The domain ontology above the books (Rejin's design, section 5): "Every textbook section
 * maps into this ontology. A book therefore no longer defines the curriculum. The body of
 * knowledge across the books defines the curriculum."
 *
 * Domains and areas are fixed here so every book files its concepts in the same places; the
 * extractor chooses an area from this list and may name a sub-area beneath it. The Business &
 * Management tree follows the one in Rejin's design; AI, Data & Computing covers the first
 * trial programme (SP Jain's Master of AI in Business). Each area has a three-letter code used
 * in concept codes (K-STR-0014).
 *
 * Pure data and lookups, so it can be tested.
 */

export interface Area {
  code: string;
  name: string;
  /** Example sub-areas, offered to the extractor; others may be named. */
  subAreas: string[];
}

export interface Domain {
  key: string;
  name: string;
  areas: Area[];
}

export const DOMAINS: Domain[] = [
  {
    key: 'business',
    name: 'Business & Management',
    areas: [
      {
        code: 'STR',
        name: 'Strategy',
        subAreas: [
          'External environment',
          'Internal analysis',
          'Competitive strategy',
          'Corporate strategy',
          'Strategy implementation',
        ],
      },
      {
        code: 'MKT',
        name: 'Marketing',
        subAreas: [
          'Consumer behaviour',
          'Segmentation',
          'Positioning',
          'Marketing mix',
          'Marketing analytics',
          'Digital marketing',
        ],
      },
      {
        code: 'FIN',
        name: 'Finance',
        subAreas: [
          'Financial statements analysis',
          'Investment appraisal',
          'Working capital',
          'Valuation',
          'Capital structure',
          'Risk and return',
        ],
      },
      {
        code: 'ACC',
        name: 'Accounting',
        subAreas: [
          'Financial accounting',
          'Management accounting',
          'Reporting standards',
          'Costing',
          'Auditing',
        ],
      },
      {
        code: 'ECO',
        name: 'Economics',
        subAreas: ['Microeconomics', 'Macroeconomics', 'Managerial economics', 'Market structures'],
      },
      {
        code: 'OPS',
        name: 'Operations & Supply Chain',
        subAreas: [
          'Process design',
          'Capacity',
          'Inventory',
          'Quality',
          'Supply chain',
          'Logistics',
        ],
      },
      {
        code: 'ORG',
        name: 'Organisational Behaviour & Leadership',
        subAreas: [
          'Individual behaviour',
          'Motivation',
          'Teams',
          'Leadership',
          'Organisational culture',
          'Change management',
        ],
      },
      {
        code: 'HRM',
        name: 'Human Resource Management',
        subAreas: [
          'Recruitment and selection',
          'Performance management',
          'Reward',
          'Learning and development',
          'Employment relations',
        ],
      },
      {
        code: 'ENT',
        name: 'Entrepreneurship & Innovation',
        subAreas: [
          'Opportunity recognition',
          'Business models',
          'New venture finance',
          'Innovation management',
          'Design thinking',
        ],
      },
      {
        code: 'ETH',
        name: 'Business Ethics, Law & Governance',
        subAreas: [
          'Ethical theories',
          'Corporate governance',
          'Corporate social responsibility',
          'Business law',
          'Regulation',
        ],
      },
      {
        code: 'INB',
        name: 'International Business',
        subAreas: [
          'Globalisation',
          'Market entry',
          'Trade and investment',
          'Cross-cultural management',
        ],
      },
      {
        code: 'ISY',
        name: 'Information Systems & Digital Business',
        subAreas: ['Digital transformation', 'Platforms', 'Enterprise systems', 'E-commerce'],
      },
      {
        code: 'PRJ',
        name: 'Project Management',
        subAreas: [
          'Planning and scheduling',
          'Agile methods',
          'Risk management',
          'Stakeholder management',
        ],
      },
      {
        code: 'RES',
        name: 'Research Methods',
        subAreas: [
          'Research design',
          'Quantitative methods',
          'Qualitative methods',
          'Research ethics',
        ],
      },
    ],
  },
  {
    key: 'ai-data',
    name: 'AI, Data & Computing',
    areas: [
      {
        code: 'MAT',
        name: 'Mathematics for AI',
        subAreas: ['Linear algebra', 'Calculus', 'Optimisation theory', 'Discrete mathematics'],
      },
      {
        code: 'STA',
        name: 'Statistics & Probability',
        subAreas: [
          'Probability',
          'Inference',
          'Regression',
          'Bayesian methods',
          'Experimental design',
        ],
      },
      {
        code: 'MLE',
        name: 'Machine Learning',
        subAreas: [
          'Supervised learning',
          'Unsupervised learning',
          'Model evaluation',
          'Ensemble methods',
          'Reinforcement learning',
          'Feature engineering',
        ],
      },
      {
        code: 'DLN',
        name: 'Deep Learning',
        subAreas: [
          'Neural network foundations',
          'Training and optimisation',
          'Convolutional networks',
          'Recurrent networks',
          'Attention and transformers',
        ],
      },
      {
        code: 'NLP',
        name: 'Natural Language Processing',
        subAreas: [
          'Text representation',
          'Language models',
          'Sequence labelling',
          'Information extraction',
        ],
      },
      {
        code: 'CVI',
        name: 'Computer Vision',
        subAreas: [
          'Image processing',
          'Recognition',
          'Detection and segmentation',
          'Generative vision',
        ],
      },
      {
        code: 'GAI',
        name: 'Generative AI',
        subAreas: [
          'Large language models',
          'Diffusion models',
          'Variational autoencoders',
          'Generative adversarial networks',
          'Prompting and alignment',
        ],
      },
      {
        code: 'OPT',
        name: 'Decision Making & Optimisation',
        subAreas: [
          'Decision theory',
          'Decision under uncertainty',
          'Linear programming',
          'Sequential decisions',
        ],
      },
      {
        code: 'DVA',
        name: 'Data Visualisation & Analytics',
        subAreas: ['Exploratory analysis', 'Visual encoding', 'Dashboards', 'Business analytics'],
      },
      {
        code: 'PRG',
        name: 'Programming',
        subAreas: [
          'Python fundamentals',
          'Control flow',
          'Functions and modules',
          'Object-oriented programming',
        ],
      },
      {
        code: 'DSA',
        name: 'Data Structures & Algorithms',
        subAreas: [
          'Complexity analysis',
          'Lists and arrays',
          'Trees',
          'Hashing',
          'Graphs',
          'Sorting and searching',
        ],
      },
      {
        code: 'DBS',
        name: 'Databases & Data Engineering',
        subAreas: ['Relational model', 'SQL', 'Database design', 'Data pipelines'],
      },
      {
        code: 'MLO',
        name: 'AI Engineering & MLOps',
        subAreas: ['Software engineering for ML', 'Deployment', 'Monitoring', 'Data management'],
      },
      {
        code: 'AIE',
        name: 'AI Ethics & Governance',
        subAreas: [
          'Fairness',
          'Accountability and transparency',
          'Privacy',
          'AI regulation',
          'Societal impact',
        ],
      },
    ],
  },
];

export const OTHER_AREA: Area = { code: 'GEN', name: 'Other', subAreas: [] };

export function domainByKey(key: string): Domain | undefined {
  return DOMAINS.find((d) => d.key === key);
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]+/g, '');

/** The area a name refers to (exact name or code, case and punctuation ignored), across domains. */
export function findArea(name: string): { domain: Domain; area: Area } | null {
  const want = squash(name);
  if (!want) return null;
  for (const domain of DOMAINS) {
    for (const area of domain.areas) {
      if (squash(area.name) === want || area.code.toLowerCase() === want) return { domain, area };
    }
  }
  return null;
}

/** Areas offered to the extractor for a book: its domains' areas, or every area if none. */
export function areasFor(domainKeys: string[]): { domain: Domain; area: Area }[] {
  const domains = domainKeys.length ? DOMAINS.filter((d) => domainKeys.includes(d.key)) : DOMAINS;
  return domains.flatMap((domain) => domain.areas.map((area) => ({ domain, area })));
}
