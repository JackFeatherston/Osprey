# Osprey Trading Assistant 🦅

A complete **human-in-the-loop AI trading system** that analyzes market data, proposes trades, and executes them only with your approval. Built with Next.js, FastAPI, Supabase, and Redis for real-time trading decisions.

## 🌟 Features

### ✅ **Complete Trading Workflow**
- **AI Market Analysis**: Real-time analysis using moving averages and RSI strategies  
- **Trade Proposals**: AI generates trade recommendations with detailed reasoning
- **Human Approval**: All trades require explicit user approval before execution
- **Live Execution**: Integrates with Alpaca API for paper and live trading
- **Full Audit Trail**: Complete history of all proposals, decisions, and executions

### ✅ **Real-time Dashboard**  
- **Live Updates**: WebSocket-powered real-time proposal notifications
- **Portfolio Tracking**: Real-time portfolio value and trading statistics
- **AI Engine Control**: Start/stop AI analysis with one click
- **System Health**: Comprehensive system status monitoring

### ✅ **Secure & Scalable**
- **User Authentication**: Supabase Auth with email/password and OAuth
- **Database Security**: Row-level security ensuring data isolation
- **Paper Trading**: Safe testing environment with Alpaca paper trading
- **Docker Ready**: Complete containerization for easy deployment

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js UI   │◄──►│   FastAPI API   │◄──►│   Supabase DB   │
│   (Frontend)    │    │   (Backend)     │    │   (Database)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       
         │              ┌─────────────────┐              
         └──────────────►│   Redis Pub/Sub │              
                        │  (Real-time)    │              
                        └─────────────────┘              
                                 ▲                       
                        ┌─────────────────┐              
                        │   Alpaca API    │              
                        │  (Trading)      │              
                        └─────────────────┘              
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Supabase account
- Alpaca trading account (paper trading)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd osprey
cp .env.example .env.local
```

### 2. Configure Environment
Edit `.env.local` with your credentials:
```env
# Frontend
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Backend  
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Trading
ALPACA_API_KEY=your-alpaca-api-key
ALPACA_SECRET_KEY=your-alpaca-secret-key
```

### 3. Setup Database
1. Create a new Supabase project
2. Run the SQL schema from `supabase/schema.sql` in your Supabase SQL editor
3. Verify all tables and policies are created

### 4. Start Services
```bash
docker-compose up --build
```

### 5. Access Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📖 Usage Guide

### Getting Started
1. **Sign Up**: Create an account at http://localhost:3000
2. **Dashboard**: View your trading dashboard with real-time data
3. **Start AI**: Click "Start" on the AI Trading Engine card
4. **Review Proposals**: AI will generate trade proposals based on market analysis
5. **Make Decisions**: Approve or reject proposals with optional notes
6. **Monitor Trades**: View execution status and trading history

### Key Pages
- **Dashboard** (`/dashboard`): Overview with stats and recent activity
- **Proposals** (`/proposals`): Detailed view of all trade proposals  
- **History** (`/history`): Complete trading history and decisions

## 🔧 Development

### Project Structure
```
osprey/
├── src/                    # Frontend (Next.js)
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── hooks/            # Custom hooks
│   └── lib/              # Utilities and API client
├── backend/               # Backend (FastAPI)
│   ├── main.py           # FastAPI application
│   ├── ai_engine.py      # Trading AI logic
│   └── supabase_client.py # Database operations
├── supabase/             # Database schema
└── docker-compose.yml    # Development environment
```

### Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.11, asyncio
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Real-time**: Redis Pub/Sub + WebSockets
- **Trading**: Alpaca API with paper trading support
- **Deployment**: Docker containers

### Development Commands
```bash
# Start development environment
docker-compose up --build

# View logs
docker-compose logs backend
docker-compose logs frontend

# Run tests
npm test                    # Frontend tests
pytest backend/            # Backend tests

# Database migrations
# (Apply schema changes via Supabase dashboard)
```

## 🧪 Testing

See [TESTING.md](./TESTING.md) for comprehensive testing instructions covering:
- End-to-end workflow testing
- Real-time functionality verification  
- Database integration testing
- Error handling validation
- Performance testing

### Quick Test
```bash
# 1. Ensure all services are running
docker-compose ps

# 2. Test API health
curl http://localhost:8000/health

# 3. Create test user and verify dashboard
# (Open http://localhost:3000 and sign up)

# 4. Start AI engine and wait for proposals
# (Use dashboard AI controls)
```

## 🚀 Production Deployment

### Frontend (Vercel)
```bash
# Build and deploy to Vercel
vercel deploy --prod
```

### Backend (AWS EC2)
```bash
# Prepare for 1GB RAM limit
# Use provided Dockerfile for optimized build
docker build -t osprey-backend ./backend
```

### Database (Supabase)
- Production database automatically scales
- Backup and monitoring included
- Apply schema via Supabase dashboard

## 📊 Database Schema

The system uses 5 main tables:

- **`trade_proposals`**: AI-generated trade recommendations
- **`trade_decisions`**: User approve/reject decisions  
- **`trade_executions`**: Actual trade execution records
- **`user_settings`**: User trading preferences
- **`market_data`**: Cached market data

All tables include Row Level Security for multi-user isolation.

## 🔒 Security Features

- **Authentication**: JWT-based auth via Supabase
- **Authorization**: Row-level security policies
- **API Security**: Bearer token validation
- **Data Isolation**: Users only access their own data
- **Paper Trading**: Safe testing environment
- **Error Boundaries**: Graceful failure handling