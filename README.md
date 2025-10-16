# Osprey Trading Assistant 🦅

A complete **human-in-the-loop algorithmic trading system** that analyzes market data using technical indicators and news sentiment, proposes trades, and executes them only with your approval. Built with Next.js, FastAPI, Supabase, and Websockets for real-time trading decisions.

## 🌟 Features

###  **Complete Trading Workflow**
- **Technical Market Analysis**: 100-day historical price/volume analysis with trend detection and momentum signals
- **News Sentiment Analysis**: Real-time financial news fetching via NewsAPI with FinBERT sentiment scoring
- **Sentiment-Enhanced Strategy**: Combines news sentiment (60%) with technical indicators (40%) for trade signals
- **Trade Proposals**: System generates trade recommendations with detailed reasoning showing sentiment + technical factors
- **Human Approval**: All trades require explicit user approval before execution
- **Live Execution**: Integrates with Alpaca API for paper and live trading
- **Full Audit Trail**: Complete history of all proposals, decisions, and executions

###  **Real-time Dashboard**
- **Live Updates**: WebSocket-powered real-time proposal notifications
- **Portfolio Tracking**: Real-time portfolio value and trading statistics
- **Market Analyzer Control**: Start/stop market analysis with one click
- **System Health**: Comprehensive system status monitoring

###  **Secure & Scalable**
- **User Authentication**: Supabase Auth with email/password and OAuth
- **Database Security**: Row-level security ensuring data isolation
- **Paper Trading**: Safe testing environment with Alpaca paper trading
- **Docker Ready**: Complete containerization for easy deployment

## 🏗️ Architecture & File Interactions

### System Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         market_analyzer.py                       │
│  • Fetches 100-day historical market data from Alpaca           │
│  • Coordinates analysis every 60 seconds                        │
│  • Manages watchlist of symbols (AAPL, GOOGL, MSFT, etc.)      │
│  • Broadcasts proposals via WebSocket                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ├──► sentiment_trading_strategy.py
                      │    • Receives historical price/volume data
                      │    • Orchestrates sentiment + technical analysis
                      │    • Generates BUY/SELL signals
                      │
                      ├──► news_fetcher.py
                      │    • Fetches recent financial news from NewsAPI
                      │    • Caches articles (30min TTL)
                      │    • Rate limits API requests
                      │
                      └──► finbert_news_analyzer.py
                           • Loads ProsusAI/finbert model
                           • Analyzes sentiment of news articles
                           • Returns scores: -1 (negative) to +1 (positive)
```

### Backend File Responsibilities

#### **`main.py`** - FastAPI Application
- HTTP endpoints for proposals, decisions, and system control
- WebSocket server for real-time updates
- Initializes and manages the market analyzer lifecycle
- Handles user authentication via Supabase

#### **`market_analyzer.py`** - Analysis Coordinator
- **Data Fetching**: Retrieves 100 days of OHLCV data from Alpaca API
- **Strategy Execution**: Runs sentiment-enhanced strategy on each symbol
- **Proposal Generation**: Creates trade proposals and stores in Supabase
- **WebSocket Broadcasting**: Sends proposals to connected clients
- **Trade Execution**: Submits approved orders to Alpaca

#### **`sentiment_trading_strategy.py`** - Main Strategy Logic
- **Technical Analysis** (40% weight):
  - Price trend calculation (5-day and 20-day changes)
  - Simple moving average (10-day SMA)
  - Volume analysis and spike detection
- **Sentiment Analysis** (60% weight):
  - Fetches news articles via `news_fetcher.py`
  - Gets sentiment scores via `finbert_news_analyzer.py`
  - Requires minimum 2 articles for sentiment signals
- **Signal Generation**: Combines both analyses to produce BUY/SELL signals
- **Reasoning**: Generates human-readable explanations for decisions

#### **`news_fetcher.py`** - News Data Provider
- **API Integration**: Queries NewsAPI for recent financial articles
- **Caching**: 30-minute TTL to reduce API calls and costs
- **Rate Limiting**: 1-second delay between requests
- **Article Parsing**: Extracts title, description, URL, and metadata

#### **`finbert_news_analyzer.py`** - Sentiment Scorer
- **Model Loading**: Lazy loads ProsusAI/finbert (memory optimized)
- **Text Analysis**: Processes article titles + descriptions
- **Sentiment Scoring**: Returns positive/negative/neutral labels with confidence
- **Aggregation**: Calculates weighted average sentiment across multiple articles
- **Caching**: LRU cache for repeated text analysis

#### **`supabase_client.py`** - Database Layer
- CRUD operations for proposals, decisions, and executions
- User authentication and authorization
- Row-level security enforcement

### Data Flow Example

```
1. market_analyzer.py fetches 100 days of AAPL price data
                ↓
2. Passes data to sentiment_trading_strategy.py
                ↓
3. Strategy calculates technical indicators:
   - AAPL up 3.2% over 5 days
   - Volume 1.8x average
   - Technical score: +0.35
                ↓
4. Strategy calls news_fetcher.py for AAPL news
                ↓
5. news_fetcher.py returns 5 recent articles from NewsAPI
                ↓
6. Strategy passes articles to finbert_news_analyzer.py
                ↓
7. FinBERT analyzes each article:
   - Article 1: "AAPL beats earnings" → Positive (+0.92)
   - Article 2: "iPhone sales strong" → Positive (+0.88)
   - Article 3: "Market concerns" → Negative (-0.65)
   - Weighted average: +0.58
                ↓
8. Strategy combines scores:
   - Sentiment (60%): +0.58 * 0.6 = +0.348
   - Technical (40%): +0.35 * 0.4 = +0.140
   - Combined: +0.488 → BUY signal ✓
                ↓
9. market_analyzer.py creates proposal and broadcasts via WebSocket
                ↓
10. Frontend displays proposal with full reasoning to user
```

##  Quick Start

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

### Project Structure
```
osprey/
├── src/                    # Frontend (Next.js)
│   ├── app/               # App router pages
│   ├── components/        # React components
│   ├── hooks/            # Custom hooks
│   └── lib/              # Utilities and API client
├── backend/               # Backend (FastAPI)
│   ├── main.py           # FastAPI application & WebSocket server
│   ├── market_analyzer.py # Coordinates analysis & fetches 100-day market data
│   ├── sentiment_trading_strategy.py # Combines sentiment + technical analysis
│   ├── news_fetcher.py   # Fetches financial news from NewsAPI
│   ├── finbert_news_analyzer.py # FinBERT sentiment analysis model
│   └── supabase_client.py # Database operations
├── supabase/             # Database schema
└── docker-compose.yml    # Development environment
```

### Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: FastAPI, Python 3.11, asyncio
- **Database**: Supabase (PostgreSQL) with Row Level Security
- **Real-time**: WebSockets
- **Trading**: Alpaca API with paper trading support
- **News Data**: NewsAPI for financial news articles
- **Sentiment Analysis**: FinBERT (ProsusAI/finbert) via Transformers
- **Market Data**: 100-day historical price/volume from Alpaca
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

# 4. Start market analyzer and wait for proposals
# (Use dashboard controls)
```


## 📊 Database Schema

The system uses 5 main tables:

- **`trade_proposals`**: AI-generated trade recommendations
- **`trade_decisions`**: User approve/reject decisions  
- **`trade_executions`**: Actual trade execution records
- **`market_data`**: Cached market data

All tables include Row Level Security for multi-user isolation.

## 🔒 Security Features

- **Authentication**: JWT-based auth via Supabase
- **Authorization**: Row-level security policies
- **API Security**: Bearer token validation
- **Data Isolation**: Users only access their own data
- **Paper Trading**: Safe testing environment
- **Error Boundaries**: Graceful failure handling