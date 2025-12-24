import mongoose from 'mongoose';
import config from '../config';

class Database {
  private connection: typeof mongoose | null = null;
  private isConnecting: boolean = false;

  /**
   * Connect to MongoDB with connection pooling
   */
  async connect(): Promise<void> {
    if (this.connection) {
      console.log('MongoDB already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('MongoDB connection in progress');
      return;
    }

    this.isConnecting = true;

    try {
      // MongoDB connection options
      const options = {
        maxPoolSize: 20, // Maximum number of connections in the pool
        minPoolSize: 5, // Minimum number of connections in the pool
        socketTimeoutMS: 7200000, // 2 hours socket timeout for long-running Step 10 generation
        serverSelectionTimeoutMS: 10000, // 10 seconds for server selection
        connectTimeoutMS: 30000, // 30 seconds connection timeout
        heartbeatFrequencyMS: 10000, // Heartbeat frequency
        retryWrites: true, // Retry writes on network errors
        retryReads: true, // Retry reads on network errors
        maxIdleTimeMS: 7200000, // 2 hours max idle time
      };

      this.connection = await mongoose.connect(config.database.mongoUri, options);

      console.log('MongoDB connected successfully');
      console.log(`Database: ${mongoose.connection.name}`);
      console.log(`Host: ${mongoose.connection.host}`);

      // Handle connection events
      mongoose.connection.on('error', (err) => {
        console.error('MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('MongoDB disconnected');
        this.connection = null;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('MongoDB reconnected');
      });

      // Handle process termination
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });

      process.on('SIGTERM', async () => {
        await this.disconnect();
        process.exit(0);
      });
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      this.isConnecting = false;
      throw error;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.disconnect();
      this.connection = null;
      console.log('MongoDB disconnected gracefully');
    }
  }

  /**
   * Close database connection (alias for disconnect)
   */
  async close(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Check MongoDB connection health
   */
  async healthCheck(): Promise<boolean> {
    try {
      const state = mongoose.connection.readyState;
      // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
      return state === 1;
    } catch (error) {
      console.error('MongoDB health check failed', error);
      return false;
    }
  }

  /**
   * Get connection state
   * @returns 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
   */
  getConnectionState(): number {
    return mongoose.connection.readyState;
  }

  /**
   * Execute a function within a MongoDB transaction
   * @param callback Function to execute within the transaction
   * @returns Result of the callback function
   */
  async transaction<T>(callback: (session: mongoose.ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      console.error('Transaction aborted:', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Get the native MongoDB connection
   */
  getConnection(): typeof mongoose | null {
    return this.connection;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    if (!this.connection) {
      return null;
    }

    return {
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      port: mongoose.connection.port,
      name: mongoose.connection.name,
      collections: Object.keys(mongoose.connection.collections),
    };
  }
}

// Export singleton instance
export const db = new Database();

// Export MongoDB connection (for backward compatibility)
export { mongodb } from './mongodb';

export default db;
