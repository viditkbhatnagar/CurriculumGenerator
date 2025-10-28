/**
 * Mock Repository
 * 
 * Provides MongoDB-like interface for synthetic data.
 * This allows the app to work without a database connection.
 */

import { syntheticData, generateId } from './syntheticData';

type CollectionName = keyof typeof syntheticData;

/**
 * Mock repository that mimics Mongoose model methods
 */
export class MockRepository<T extends { _id: string }> {
  constructor(private collectionName: CollectionName) {}

  private get collection(): T[] {
    return syntheticData[this.collectionName] as T[];
  }

  /**
   * Find all documents matching query
   */
  async find(query: Partial<T> = {}): Promise<T[]> {
    return this.collection.filter(doc => this.matchesQuery(doc, query));
  }

  /**
   * Find one document matching query
   */
  async findOne(query: Partial<T>): Promise<T | null> {
    return this.collection.find(doc => this.matchesQuery(doc, query)) || null;
  }

  /**
   * Find document by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.collection.find(doc => doc._id === id) || null;
  }

  /**
   * Create new document
   */
  async create(data: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    const newDoc = {
      ...data,
      _id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    } as T;

    this.collection.push(newDoc);
    return newDoc;
  }

  /**
   * Update document by ID
   */
  async findByIdAndUpdate(
    id: string,
    update: Partial<T>,
    options: { new?: boolean } = {}
  ): Promise<T | null> {
    const index = this.collection.findIndex(doc => doc._id === id);
    if (index === -1) return null;

    const oldDoc = this.collection[index];
    const updatedDoc = {
      ...oldDoc,
      ...update,
      _id: oldDoc._id, // Preserve ID
      createdAt: oldDoc.createdAt, // Preserve creation date
      updatedAt: new Date(),
    } as T;

    this.collection[index] = updatedDoc;
    return options.new ? updatedDoc : oldDoc;
  }

  /**
   * Update one document matching query
   */
  async findOneAndUpdate(
    query: Partial<T>,
    update: Partial<T>,
    options: { new?: boolean; upsert?: boolean } = {}
  ): Promise<T | null> {
    const doc = await this.findOne(query);

    if (!doc) {
      if (options.upsert) {
        return this.create({ ...query, ...update } as any);
      }
      return null;
    }

    return this.findByIdAndUpdate(doc._id, update, options);
  }

  /**
   * Delete document by ID
   */
  async findByIdAndDelete(id: string): Promise<T | null> {
    const index = this.collection.findIndex(doc => doc._id === id);
    if (index === -1) return null;

    const deleted = this.collection[index];
    this.collection.splice(index, 1);
    return deleted;
  }

  /**
   * Delete one document matching query
   */
  async findOneAndDelete(query: Partial<T>): Promise<T | null> {
    const doc = await this.findOne(query);
    if (!doc) return null;
    return this.findByIdAndDelete(doc._id);
  }

  /**
   * Delete all documents matching query
   */
  async deleteMany(query: Partial<T> = {}): Promise<{ deletedCount: number }> {
    const toDelete = this.collection.filter(doc => this.matchesQuery(doc, query));
    const deletedCount = toDelete.length;

    toDelete.forEach(doc => {
      const index = this.collection.findIndex(d => d._id === doc._id);
      if (index !== -1) {
        this.collection.splice(index, 1);
      }
    });

    return { deletedCount };
  }

  /**
   * Count documents matching query
   */
  async countDocuments(query: Partial<T> = {}): Promise<number> {
    return this.collection.filter(doc => this.matchesQuery(doc, query)).length;
  }

  /**
   * Check if document exists
   */
  async exists(query: Partial<T>): Promise<boolean> {
    return this.collection.some(doc => this.matchesQuery(doc, query));
  }

  /**
   * Get distinct values for a field
   */
  async distinct(field: keyof T, query: Partial<T> = {}): Promise<any[]> {
    const docs = this.collection.filter(doc => this.matchesQuery(doc, query));
    const values = docs.map(doc => doc[field]);
    return [...new Set(values)];
  }

  /**
   * Simple aggregation support
   */
  async aggregate(pipeline: any[]): Promise<any[]> {
    let results = [...this.collection];

    for (const stage of pipeline) {
      if (stage.$match) {
        results = results.filter(doc => this.matchesQuery(doc, stage.$match));
      } else if (stage.$sort) {
        const sortField = Object.keys(stage.$sort)[0];
        const sortOrder = stage.$sort[sortField];
        results.sort((a: any, b: any) => {
          if (a[sortField] < b[sortField]) return sortOrder === 1 ? -1 : 1;
          if (a[sortField] > b[sortField]) return sortOrder === 1 ? 1 : -1;
          return 0;
        });
      } else if (stage.$limit) {
        results = results.slice(0, stage.$limit);
      } else if (stage.$skip) {
        results = results.slice(stage.$skip);
      }
    }

    return results;
  }

  /**
   * Mock populate - returns the document with populated references
   */
  populate(field: string) {
    return {
      exec: async () => {
        // For mock, just return the documents as-is
        // In real implementation, this would resolve references
        return this.collection;
      },
    };
  }

  /**
   * Mock sort
   */
  sort(sortOptions: any) {
    return {
      exec: async () => {
        const sortField = Object.keys(sortOptions)[0];
        const sortOrder = sortOptions[sortField];
        const sorted = [...this.collection].sort((a: any, b: any) => {
          if (a[sortField] < b[sortField]) return sortOrder === 1 ? -1 : 1;
          if (a[sortField] > b[sortField]) return sortOrder === 1 ? 1 : -1;
          return 0;
        });
        return sorted;
      },
    };
  }

  /**
   * Mock limit
   */
  limit(n: number) {
    return {
      exec: async () => {
        return this.collection.slice(0, n);
      },
    };
  }

  /**
   * Helper: Check if document matches query
   */
  private matchesQuery(doc: any, query: any): boolean {
    return Object.keys(query).every(key => {
      const queryValue = query[key];
      const docValue = doc[key];

      // Handle nested queries
      if (typeof queryValue === 'object' && queryValue !== null) {
        // Handle operators like $gte, $lte, $in, etc.
        if (queryValue.$gte !== undefined && docValue < queryValue.$gte) return false;
        if (queryValue.$lte !== undefined && docValue > queryValue.$lte) return false;
        if (queryValue.$gt !== undefined && docValue <= queryValue.$gt) return false;
        if (queryValue.$lt !== undefined && docValue >= queryValue.$lt) return false;
        if (queryValue.$in !== undefined && !queryValue.$in.includes(docValue)) return false;
        if (queryValue.$nin !== undefined && queryValue.$nin.includes(docValue)) return false;
        if (queryValue.$ne !== undefined && docValue === queryValue.$ne) return false;
        return true;
      }

      // Simple equality check
      return docValue === queryValue;
    });
  }
}

/**
 * Create mock repositories for all collections
 */
export const mockRepositories = {
  Program: new MockRepository('programs'),
  Module: new MockRepository('modules'),
  LearningOutcome: new MockRepository('learningOutcomes'),
  KnowledgeBase: new MockRepository('knowledgeBase'),
  Assessment: new MockRepository('assessments'),
  SkillMapping: new MockRepository('skillMappings'),
  GenerationJob: new MockRepository('generationJobs'),
  User: new MockRepository('users'),
  AuditLog: new MockRepository('auditLogs'),
  FileUpload: new MockRepository('fileUploads'),
};

/**
 * Get repository by name
 */
export function getRepository(name: CollectionName): MockRepository<any> {
  return new MockRepository(name);
}
