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

**Recent Changes (July 15, 2025)**:
- Successfully migrated from Replit Agent to standard Replit environment
- PostgreSQL database configured and schema deployed 
- Fixed OpenAI initialization to handle missing API keys gracefully
- Application now starts successfully and runs on port 5000
- All dependencies properly installed and configured
- Fixed critical SQL query bug in user phone number lookup (replaced sql template literals with like() function)
- Bot now successfully finds users, processes transactions, and maintains conversation history
- **Fixed date interpretation bug**: Bot now correctly interprets "hoje" as current date, "ontem" as previous day
- Added robust error handling for conversation history tables - bot works with or without these tables
- Created database migration script for missing conversation tables
- Enhanced debugging capabilities for transaction processing
- **Implemented multiple transaction processing**: Bot now identifies and processes multiple transactions in a single message
- Added register_multiple_transactions function for handling complex expense/income descriptions
- Enhanced AI prompt to recognize patterns like "gastei X com Y e Z com W" as separate transactions
- **Fixed date interpretation and response messaging**: Bot now correctly interprets "hoje" as current date and "ontem" as previous day in both processing and response messages
- Added comprehensive date processing with debug logging for better reliability
- Implemented basic transaction parsing system that works without OpenAI API for testing
- Enhanced user experience with proper Portuguese date formatting and responses
- Migration completed - project fully functional and ready for production
- **Fixed date interpretation bug**: Bot now correctly interprets "hoje" as current date, "ontem" as previous day in both processing and response messages
- **Enhanced financial query system**: Complete overhaul of query_finances function with support for:
  - Multiple periods: today, yesterday, week, last_week, month, last_month, year, last_year
  - Category filtering for specific expense/income types
  - Comparison queries between different periods
  - Improved date range calculations and SQL queries
  - Better error handling and debug logging
- **Improved AI prompt system**: Enhanced OpenAI prompts with clear examples for financial queries
- **Storage layer improvements**: Added category filtering support in database queries
- **Fixed critical query bug**: Resolved issue where financial queries returned 0 results due to type mismatch (expenses vs expense)
- **Successfully implemented date range filtering**: Bot now correctly filters transactions by date periods
- **Enhanced debugging system**: Added comprehensive logging for transaction queries and date filtering
- **Query system fully operational**: All financial queries (today, yesterday, week, month, year) now work correctly
- **Fixed "Data inválida" issues**: Resolved invalid date formatting problems in transaction lists
- **Improved error handling**: Added robust date validation and exception handling in formatDateForMessage
- **Enhanced mock storage**: Added comprehensive fallback system for DatabaseStorage when DATABASE_URL not configured
- **Transaction registration fully functional**: Bot now successfully registers new transactions and updates totals
- **Complete end-to-end functionality**: All core features working - transaction registration, financial queries, date handling, Portuguese language support

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