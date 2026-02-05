import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Real-time Chat Service for African Fintech Platform
 * Supports one-on-one messaging, group chats, and customer support
 */

export interface ChatMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'system';
  fileUrl?: string;
  fileName?: string;
  timestamp: Date;
  read: boolean;
  delivered: boolean;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group' | 'support';
  name: string;
  avatar?: string;
  participants: string[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingIndicator {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

export type ChatEventHandler = (data: any) => void;

export class ChatService {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private eventHandlers: Map<string, ChatEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Initialize chat service and connect to server
   */
  async connect(userId: string, serverUrl: string = 'https://chat.africanfintech.com'): Promise<void> {
    this.userId = userId;

    // Create socket connection
    this.socket = io(serverUrl, {
      auth: {
        userId,
      },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    // Set up event listeners
    this.setupEventListeners();

    // Wait for connection
    return new Promise((resolve, reject) => {
      this.socket?.on('connect', () => {
        console.log('✅ Chat service connected');
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket?.on('connect_error', (error) => {
        console.error('❌ Chat connection error:', error);
        this.reconnectAttempts++;
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(error);
        }
      });
    });
  }

  /**
   * Disconnect from chat server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      console.log('✅ Chat service disconnected');
    }
  }

  /**
   * Set up socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Message events
    this.socket.on('message:new', (message: ChatMessage) => {
      this.emit('message:new', message);
    });

    this.socket.on('message:delivered', (data: { messageId: string; chatId: string }) => {
      this.emit('message:delivered', data);
    });

    this.socket.on('message:read', (data: { messageId: string; chatId: string; userId: string }) => {
      this.emit('message:read', data);
    });

    // Typing indicators
    this.socket.on('typing:start', (data: TypingIndicator) => {
      this.emit('typing:start', data);
    });

    this.socket.on('typing:stop', (data: TypingIndicator) => {
      this.emit('typing:stop', data);
    });

    // Chat events
    this.socket.on('chat:created', (chat: Chat) => {
      this.emit('chat:created', chat);
    });

    this.socket.on('chat:updated', (chat: Chat) => {
      this.emit('chat:updated', chat);
    });

    // Connection events
    this.socket.on('disconnect', () => {
      console.log('⚠️  Chat service disconnected');
      this.emit('disconnected', {});
    });

    this.socket.on('reconnect', () => {
      console.log('✅ Chat service reconnected');
      this.emit('reconnected', {});
    });
  }

  /**
   * Send a text message
   */
  async sendMessage(chatId: string, content: string): Promise<void> {
    if (!this.socket || !this.userId) {
      throw new Error('Chat service not connected');
    }

    const message: Partial<ChatMessage> = {
      chatId,
      senderId: this.userId,
      content,
      type: 'text',
      timestamp: new Date(),
    };

    this.socket.emit('message:send', message);
  }

  /**
   * Send an image message
   */
  async sendImage(chatId: string, imageUrl: string, fileName: string): Promise<void> {
    if (!this.socket || !this.userId) {
      throw new Error('Chat service not connected');
    }

    const message: Partial<ChatMessage> = {
      chatId,
      senderId: this.userId,
      content: 'Sent an image',
      type: 'image',
      fileUrl: imageUrl,
      fileName,
      timestamp: new Date(),
    };

    this.socket.emit('message:send', message);
  }

  /**
   * Send a file message
   */
  async sendFile(chatId: string, fileUrl: string, fileName: string): Promise<void> {
    if (!this.socket || !this.userId) {
      throw new Error('Chat service not connected');
    }

    const message: Partial<ChatMessage> = {
      chatId,
      senderId: this.userId,
      content: `Sent a file: ${fileName}`,
      type: 'file',
      fileUrl,
      fileName,
      timestamp: new Date(),
    };

    this.socket.emit('message:send', message);
  }

  /**
   * Mark message as read
   */
  markAsRead(messageId: string, chatId: string): void {
    if (!this.socket) return;

    this.socket.emit('message:read', {
      messageId,
      chatId,
      userId: this.userId,
    });
  }

  /**
   * Start typing indicator
   */
  startTyping(chatId: string, userName: string): void {
    if (!this.socket || !this.userId) return;

    this.socket.emit('typing:start', {
      chatId,
      userId: this.userId,
      userName,
    });
  }

  /**
   * Stop typing indicator
   */
  stopTyping(chatId: string): void {
    if (!this.socket || !this.userId) return;

    this.socket.emit('typing:stop', {
      chatId,
      userId: this.userId,
    });
  }

  /**
   * Create a new direct chat
   */
  async createDirectChat(participantId: string, participantName: string): Promise<Chat> {
    if (!this.socket || !this.userId) {
      throw new Error('Chat service not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket?.emit('chat:create', {
        type: 'direct',
        participants: [this.userId, participantId],
        name: participantName,
      }, (response: { success: boolean; chat?: Chat; error?: string }) => {
        if (response.success && response.chat) {
          resolve(response.chat);
        } else {
          reject(new Error(response.error || 'Failed to create chat'));
        }
      });
    });
  }

  /**
   * Create a new group chat
   */
  async createGroupChat(name: string, participantIds: string[]): Promise<Chat> {
    if (!this.socket || !this.userId) {
      throw new Error('Chat service not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket?.emit('chat:create', {
        type: 'group',
        participants: [this.userId, ...participantIds],
        name,
      }, (response: { success: boolean; chat?: Chat; error?: string }) => {
        if (response.success && response.chat) {
          resolve(response.chat);
        } else {
          reject(new Error(response.error || 'Failed to create group chat'));
        }
      });
    });
  }

  /**
   * Create a customer support chat
   */
  async createSupportChat(): Promise<Chat> {
    if (!this.socket || !this.userId) {
      throw new Error('Chat service not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket?.emit('chat:create', {
        type: 'support',
        participants: [this.userId],
        name: 'Customer Support',
      }, (response: { success: boolean; chat?: Chat; error?: string }) => {
        if (response.success && response.chat) {
          resolve(response.chat);
        } else {
          reject(new Error(response.error || 'Failed to create support chat'));
        }
      });
    });
  }

  /**
   * Get chat history
   */
  async getChatHistory(chatId: string, limit: number = 50, before?: Date): Promise<ChatMessage[]> {
    if (!this.socket) {
      throw new Error('Chat service not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket?.emit('chat:history', {
        chatId,
        limit,
        before: before?.toISOString(),
      }, (response: { success: boolean; messages?: ChatMessage[]; error?: string }) => {
        if (response.success && response.messages) {
          resolve(response.messages);
        } else {
          reject(new Error(response.error || 'Failed to get chat history'));
        }
      });
    });
  }

  /**
   * Get all chats for user
   */
  async getChats(): Promise<Chat[]> {
    if (!this.socket) {
      throw new Error('Chat service not connected');
    }

    return new Promise((resolve, reject) => {
      this.socket?.emit('chats:list', {}, (response: { success: boolean; chats?: Chat[]; error?: string }) => {
        if (response.success && response.chats) {
          resolve(response.chats);
        } else {
          reject(new Error(response.error || 'Failed to get chats'));
        }
      });
    });
  }

  /**
   * Register event handler
   */
  on(event: string, handler: ChatEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Unregister event handler
   */
  off(event: string, handler: ChatEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  /**
   * Emit event to handlers
   */
  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => handler(data));
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const chatService = new ChatService();
