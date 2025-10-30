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

<img width="1862" height="1374" alt="Image" src="https://github.com/user-attachments/assets/d078b6a3-dc80-4fb5-86d1-af7751032b0f" />

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

