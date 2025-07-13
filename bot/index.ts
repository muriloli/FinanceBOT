import express from 'express';
import { WebhookHandler } from './webhook';
import { MessageRouter } from './message-router';

class FinanceFlowBot {
  private app: express.Application;
  private webhookHandler: WebhookHandler;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.BOT_WEBHOOK_PORT || '5001');
    this.webhookHandler = new WebhookHandler();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    this.app.use('/api/bot', this.webhookHandler.getRouter());
    
    // Root health check
    this.app.get('/', (req, res) => {
      res.json({
        service: 'FinanceFlow WhatsApp Bot',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });
  }

  public start(): void {
    this.app.listen(this.port, '0.0.0.0', () => {
      console.log(`FinanceFlow WhatsApp Bot listening on port ${this.port}`);
      console.log(`Webhook endpoint: http://localhost:${this.port}/api/bot/webhook/whatsapp`);
      console.log(`Health check: http://localhost:${this.port}/health`);
    });
  }
}

// Start the bot if this file is run directly
if (require.main === module) {
  const bot = new FinanceFlowBot();
  bot.start();
}

export { FinanceFlowBot };
