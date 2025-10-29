# Osprey

A complete human-in-the-loop algorithmic trading system that analyzes market data using technical indicators and news sentiment, proposes trades, and executes them only with your approval. Built with Next.js, FastAPI, Supabase (PostgreSQL), and WebSockets for real-time trading decisions.

image of whole dashboard.

## Features

Multimodal Market Analysis
- Classic **trading algorithms** such as simple moving averages (SMA) used to analyze real-time market data
- **Sentiment analysis** of recent news articles
- Scoring system that combines stock market analysis with recent news article analyis to generate a well informed trade proposal


Trading Dashboard
- Websockets used to update the user's dashboard with live stock market data and trade proposals
- Trade proposals with Buy/Sell recommendations included with **reasoning** for making the trade
- User **stock portfolio** displayed with portfolio value, cash, and buying power
- **Order history** displaying all proposals, decisions, and executions

Secure & Scalable
- **User authentication** through Supabase allowing for signing in with Google, GitHub, or email
- Database designed with **row level security** 
- All trade executions are done through **paper trading** for demo purposes
- **Containerized** application for development and possible deployment

## Tech Stack
Frontend
- Next.js
- React
- Tailwind CSS
- Shadcn

Backend
- FastAPI
- Num.py & Pandas
- Supabase/PostgreSQL database
- Alpaca API (for trading)
- NewsAPI (for fetching daily news articles)
- VADER Sentiment (for extracting financial sentiment from news articles)
- Docker

## PostgreSQL Database Schema

The system uses 4 main tables:

- **`trade_proposals`**: Trade recommendations based on stock market and news article analysis
- **`trade_decisions`**: User approve/reject decisions  
- **`trade_executions`**: Actual trade execution records
- **`market_data`**: Cached market data

## Application Workflow

lucid workflow here

**System Requirements**
- Docker & Docker Compose
- Node.js 18+

**Setup**
1. Clone the Repository and navigate to the project
```
git clone <repository-url>
```
```
cd osprey
```
2. Build the Docker containers
```
docker-compose up --build
```
3. Navigate to the application
```
http://localhost:3000
```

## Usage
- After logging in, every minute the application will generate a Trade Proposal card based on market and news analysis 
- If you accept the Buy/Sell recommendation, the trade order will be executed and the Trade Proposal card will disappear
- If you reject the Trade Proposal, the proposal will simply go away
- All decisions are logged and displayed immediately in the Order History 







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
6. Strategy passes articles to vader_sentiment_analyzer.py
                ↓
7. VADER analyzes each article with financial context:
   - Article 1: "AAPL beats earnings" → Positive (+0.85)
   - Article 2: "iPhone sales surge" → Positive (+0.78)
   - Article 3: "Market concerns" → Negative (-0.52)
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




