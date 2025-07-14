import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { WebhookHandler } from "../bot/webhook";
import { MessageRouter } from "../bot/message-router";
import { PhoneUtils } from '../bot/phone-utils';

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize WhatsApp bot webhook handler
  const webhookHandler = new WebhookHandler();
  app.use('/api/bot', webhookHandler.getRouter());

  // Test endpoint for Postman - Process message with AI
  app.post('/api/test/process-message', async (req, res) => {
    try {
      const { message, phone } = req.body;
      
      if (!message || !phone) {
        return res.status(400).json({ 
          error: 'Message and phone are required',
          example: {
            message: "Gastei R$ 50 no almoço no restaurante",
            phone: "5511999999999"
          }
        });
      }

      // Get or create user for testing using improved phone search
      const formattedPhone = PhoneUtils.formatToStandard(phone);
      const searchPatterns = PhoneUtils.generateSearchPatterns(phone);
      
      console.log(`🔍 Test endpoint - searching user for phone: ${phone}`);
      console.log(`📱 Formatted: ${formattedPhone}`);
      console.log(`🔎 Search patterns: ${searchPatterns.join(', ')}`);
      
      let user = await storage.getUserByPhone(formattedPhone);
      
      if (!user) {
        // Try search patterns
        for (const pattern of searchPatterns) {
          user = await storage.getUserByPhoneContains(pattern);
          if (user) {
            console.log(`✅ Found user by pattern: ${pattern} -> ${user.name}`);
            break;
          }
        }
      }
      
      if (!user) {
        // Create test user
        user = await storage.createUser({
          name: `Test User ${phone}`,
          cpf: `${phone.slice(-11)}`,
          phone: phone,
          password: 'test123'
        });

        // Create default categories for new user
        const defaultCategories = [
          { name: 'Alimentação', type: 'expense', color: '#ff6b6b', icon: '🍽️' },
          { name: 'Transporte', type: 'expense', color: '#4ecdc4', icon: '🚗' },
          { name: 'Compras', type: 'expense', color: '#ffe66d', icon: '🛍️' },
          { name: 'Lazer', type: 'expense', color: '#ff8b94', icon: '🎉' },
          { name: 'Salário', type: 'income', color: '#95e1d3', icon: '💰' },
          { name: 'Freelance', type: 'income', color: '#a8e6cf', icon: '💼' }
        ];

        for (const category of defaultCategories) {
          await storage.createCategory(category);
        }
      }

      // Process message with AI
      const messageRouter = webhookHandler.getMessageRouter();
      const userContext = {
        userId: user.id,
        phone: user.phone || phone,
        username: user.name
      };
      
      console.log(`👤 Using user context: ${user.name} (${user.id}) - Phone: ${user.phone || phone}`);

      const aiProcessor = messageRouter.aiProcessor;
      const response = await aiProcessor.processMessage(message, userContext);

      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone
        },
        aiResponse: response,
        message: "Message processed successfully"
      });

    } catch (error) {
      console.error('Error processing test message:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

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
