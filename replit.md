# FinanceFlow WhatsApp AI Bot

## Overview

This is a backend-only WhatsApp AI bot that integrates with the existing FinanceFlow personal finance application to enable natural language transaction processing through text and voice messages. The bot allows users to register expenses and income, query financial data, and interact with their existing financial records using conversational AI.

**Current Status**: Fully functional and ready for deployment
- ✅ WhatsApp webhook integration working
- ✅ Database schema properly matched to existing FinanceFlow structure
- ✅ Transaction registration and financial queries working
- ✅ Portuguese language natural language processing
- ✅ OpenAI GPT-4o integration with function calling
- ✅ User authentication via phone number verification
- ✅ Graceful error handling and logging

**Recent Changes (July 13, 2025)**:
- Fixed database schema to match existing FinanceFlow structure
- Updated UUID column handling for proper auto-generation
- Implemented proper transaction date handling
- Added source tracking for WhatsApp transactions
- Validated full end-to-end functionality with test transactions

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend-Only Architecture
- **Runtime**: Node.js with Express framework
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM
- **Status**: Production-ready backend-only implementation

### WhatsApp Bot Architecture
- **Message Processing**: Dedicated bot folder with modular components
- **AI Processing**: OpenAI GPT-4o with function calling capabilities
- **Speech Recognition**: Azure Speech API for voice-to-text conversion (configured but requires API key)
- **WhatsApp Integration**: Webhook-based message handling with signature verification
- **Authentication**: Phone number verification against existing users table
- **Database Integration**: Full CRUD operations for transactions and categories

## Key Components

### Database Layer (`server/storage.ts`)
- **Purpose**: Centralized data access layer using Drizzle ORM
- **Features**: User management, transaction CRUD operations, category management, financial calculations
- **Design**: Interface-based architecture for easy testing and extensibility

### Bot Components (`bot/` directory)
- **`ai-processor.ts`**: OpenAI GPT-4o integration with function calling for transaction processing
- **`speech-handler.ts`**: Azure Speech API integration for audio transcription
- **`message-router.ts`**: Central message routing and processing logic
- **`whatsapp-client.ts`**: WhatsApp API client for sending/receiving messages
- **`webhook.ts`**: Express router for handling WhatsApp webhook events

### Shared Schema (`shared/schema.ts`)
- **Users Table**: Authentication and user identification
- **Categories Table**: Transaction categorization system
- **Transactions Table**: Financial record storage
- **Validation**: Zod schemas for type-safe data validation

## Data Flow

1. **Incoming Messages**: WhatsApp sends webhook events to `/api/bot/webhook/whatsapp`
2. **User Authentication**: Phone number verification against users table
3. **Message Processing**: 
   - Text messages → Direct AI processing
   - Audio messages → Speech transcription → AI processing
4. **AI Understanding**: GPT-4o analyzes intent and extracts financial data
5. **Database Operations**: Transactions saved to PostgreSQL via Drizzle ORM
6. **Response Generation**: AI generates contextual responses
7. **WhatsApp Response**: Bot sends formatted messages back to user

## External Dependencies

### AI and Speech Services
- **OpenAI GPT-4o**: Natural language understanding and response generation
- **Azure Speech API**: Voice-to-text conversion for audio messages
- **Rationale**: GPT-4o chosen for superior function calling capabilities; Azure Speech for reliable voice recognition

### WhatsApp Integration
- **Z-API or Evolution API**: WhatsApp Business API integration
- **Webhook Security**: Signature verification for secure message handling

### Database and Infrastructure
- **PostgreSQL**: Primary database with Drizzle ORM
- **Session Store**: PostgreSQL-based session management
- **Environment Variables**: Secure configuration management

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server with HMR for frontend, tsx for backend
- **Database**: Local PostgreSQL or cloud database connection
- **Environment**: Separate development configuration

### Production Build
- **Frontend**: Vite build with static asset generation
- **Backend**: esbuild bundling with ESM output
- **Database**: Drizzle migrations for schema management
- **Process**: Single Node.js process serving both API and static files

### Configuration Requirements
- **Required Environment Variables**:
  - `DATABASE_URL`: PostgreSQL connection string
  - `OPENAI_API_KEY`: OpenAI API key
  - `AZURE_SPEECH_KEY`: Azure Speech API key
  - `AZURE_SPEECH_REGION`: Azure region
  - `ZAPI_BASE_URL`: WhatsApp API base URL
  - `ZAPI_TOKEN`: WhatsApp API token
  - `WEBHOOK_SECRET`: Webhook verification secret

### Security Considerations
- **Webhook Verification**: Cryptographic signature validation
- **Phone Number Authentication**: User verification against existing database
- **API Key Protection**: Secure environment variable handling
- **Session Security**: Secure session management with PostgreSQL store

The system is designed to be a natural extension of the existing FinanceFlow application, reusing existing database schemas and authentication patterns while adding conversational AI capabilities through WhatsApp integration.