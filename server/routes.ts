import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebhookHandler } from "../bot/webhook";
import { MessageRouter } from "../bot/message-router";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize WhatsApp bot webhook handler
  const webhookHandler = new WebhookHandler();
  app.use('/api/bot', webhookHandler.getRouter());

  // User routes
  app.get('/api/users/:id', async (req, res) => {
    try {
      const id = req.params.id;
      const user = await storage.getUser(id);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/users/phone/:phone', async (req, res) => {
    try {
      const phone = req.params.phone;
      const user = await storage.getUserByPhone(phone);
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Transaction routes
  app.get('/api/transactions/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const transactions = await storage.getTransactionsByUser(userId, startDate, endDate);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/balance/:userId', async (req, res) => {
    try {
      const userId = req.params.userId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      const balance = await storage.getUserBalance(userId, startDate, endDate);
      res.json(balance);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Categories routes
  app.get('/api/categories', async (req, res) => {
    try {
      const userId = req.query.userId ? req.query.userId as string : undefined;
      const categories = await storage.getCategories(userId);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Test route to simulate WhatsApp message (for development)
  app.post('/api/test-message', async (req, res) => {
    try {
      const { phone, message, messageType = 'text' } = req.body;
      
      if (!phone || !message) {
        return res.status(400).json({ error: 'Phone and message are required' });
      }

      // Create mock WhatsApp message
      const mockMessage = {
        id: `test_${Date.now()}`,
        from: phone,
        to: '5511999999999',
        timestamp: Date.now(),
        type: messageType as 'text' | 'audio',
        text: messageType === 'text' ? { body: message } : undefined,
        audio: messageType === 'audio' ? { 
          id: `audio_${Date.now()}`, 
          mime_type: 'audio/ogg',
          sha256: 'test_hash',
          size: 1024,
          voice: true
        } : undefined
      };

      // Create new message router instance for testing
      const messageRouter = new MessageRouter();
      await messageRouter.routeMessage(mockMessage);

      res.json({ 
        success: true, 
        message: 'Test message processed',
        mockMessage 
      });
    } catch (error) {
      console.error('Error in test message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
