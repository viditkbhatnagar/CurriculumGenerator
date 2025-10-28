/**
 * WebSocket Service
 * Manages WebSocket connections for real-time progress notifications
 * Implements Requirements 5.4, 12.1
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { JobProgressUpdate } from '../types/curriculum';

class WebSocketService {
  private io: SocketIOServer | null = null;
  private connections: Map<string, Set<string>> = new Map(); // jobId -> Set of socketIds

  /**
   * Initialize WebSocket server
   */
  initialize(httpServer: HTTPServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      path: '/ws',
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`WebSocket client connected: ${socket.id}`);

      // Handle job subscription
      socket.on('subscribe:job', (jobId: string) => {
        this.subscribeToJob(socket, jobId);
      });

      // Handle job unsubscription
      socket.on('unsubscribe:job', (jobId: string) => {
        this.unsubscribeFromJob(socket, jobId);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
        console.log(`WebSocket client disconnected: ${socket.id}`);
      });
    });

    console.log('WebSocket server initialized');
  }

  /**
   * Subscribe socket to job updates
   */
  private subscribeToJob(socket: Socket, jobId: string): void {
    // Join socket to job room
    socket.join(`job:${jobId}`);

    // Track connection
    if (!this.connections.has(jobId)) {
      this.connections.set(jobId, new Set());
    }
    this.connections.get(jobId)!.add(socket.id);

    console.log(`Socket ${socket.id} subscribed to job ${jobId}`);
    
    // Send confirmation
    socket.emit('subscribed', { jobId });
  }

  /**
   * Unsubscribe socket from job updates
   */
  private unsubscribeFromJob(socket: Socket, jobId: string): void {
    // Leave socket from job room
    socket.leave(`job:${jobId}`);

    // Remove from tracking
    const connections = this.connections.get(jobId);
    if (connections) {
      connections.delete(socket.id);
      if (connections.size === 0) {
        this.connections.delete(jobId);
      }
    }

    console.log(`Socket ${socket.id} unsubscribed from job ${jobId}`);
    
    // Send confirmation
    socket.emit('unsubscribed', { jobId });
  }

  /**
   * Handle socket disconnection
   */
  private handleDisconnect(socket: Socket): void {
    // Remove socket from all job subscriptions
    for (const [jobId, connections] of this.connections.entries()) {
      if (connections.has(socket.id)) {
        connections.delete(socket.id);
        if (connections.size === 0) {
          this.connections.delete(jobId);
        }
      }
    }
  }

  /**
   * Send progress update to all subscribers of a job
   */
  sendProgressUpdate(update: JobProgressUpdate): void {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const room = `job:${update.jobId}`;
    
    this.io.to(room).emit('job:progress', {
      jobId: update.jobId,
      progress: update.progress,
      stage: update.stage,
      message: update.message,
      timestamp: update.timestamp,
    });

    console.log(`Progress update sent to job ${update.jobId} subscribers`);
  }

  /**
   * Send job completion notification
   */
  sendJobCompleted(jobId: string, result: any): void {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const room = `job:${jobId}`;
    
    this.io.to(room).emit('job:completed', {
      jobId,
      result,
      timestamp: new Date(),
    });

    console.log(`Completion notification sent for job ${jobId}`);
  }

  /**
   * Send job failure notification
   */
  sendJobFailed(jobId: string, error: string): void {
    if (!this.io) {
      console.warn('WebSocket server not initialized');
      return;
    }

    const room = `job:${jobId}`;
    
    this.io.to(room).emit('job:failed', {
      jobId,
      error,
      timestamp: new Date(),
    });

    console.log(`Failure notification sent for job ${jobId}`);
  }

  /**
   * Get number of subscribers for a job
   */
  getSubscriberCount(jobId: string): number {
    return this.connections.get(jobId)?.size || 0;
  }

  /**
   * Close WebSocket server
   */
  close(): void {
    if (this.io) {
      this.io.close();
      this.io = null;
      this.connections.clear();
      console.log('WebSocket server closed');
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
