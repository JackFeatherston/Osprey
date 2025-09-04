# Testing Guide - Osprey Trading Assistant

This guide provides instructions for testing the complete AI trading workflow from proposal generation to execution.

## Prerequisites

Before testing, ensure you have:

1. **Database Setup**: Supabase project with schema applied
2. **Environment Variables**: All required variables in `.env.local`
3. **API Keys**: Valid Alpaca paper trading credentials
4. **Services Running**: Backend, frontend, and Redis

## Complete Testing Checklist

### 1. Environment Setup ✓

```bash
# 1. Copy environment template
cp .env.local

# 2. Update .env.local with your actual values
# - Supabase URL and keys
# - Alpaca API credentials
# - Redis URL (for docker-compose)

# 3. Apply database schema
# (Use Supabase dashboard SQL editor with supabase/schema.sql)
```

### 2. Start Services ✓

```bash
# Start all services with Docker Compose
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - Redis: localhost:6379
```

### 3. Authentication Testing ✓

1. **User Registration**
   - Navigate to http://localhost:3000
   - Click "Sign Up" and create a test account
   - Verify email confirmation (if enabled)

2. **User Login**
   - Sign in with test credentials
   - Verify redirect to dashboard
   - Check that auth token is set for API calls

### 4. Backend API Testing ✓

Test all API endpoints:

```bash
# Health check
curl http://localhost:8000/health

# AI engine status
curl http://localhost:8000/ai-status

# Account information (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:8000/account

# Dashboard stats (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:8000/dashboard-stats
```

### 5. AI Engine Testing ✓

1. **Start AI Engine**
   - Go to Dashboard
   - Check AI Engine status card
   - Click "Start" to activate AI engine
   - Verify status changes to "running"

2. **Monitor AI Activity**
   - AI should analyze markets every 5 minutes
   - Check backend logs for analysis messages
   - Wait for trade proposals to be generated

3. **Manual Proposal Creation** (for testing)
   ```bash
   # Create test proposal via API
   curl -X POST http://localhost:8000/proposals \
   -H "Content-Type: application/json" \
   -H "Authorization: Bearer YOUR_JWT_TOKEN" \
   -d '{
     "symbol": "AAPL",
     "action": "BUY",
     "quantity": 10,
     "price": 150.00,
     "reason": "Test proposal for development",
     "strategy": "Manual_Test"
   }'
   ```

### 6. Real-time Updates Testing ✓

1. **WebSocket Connection**
   - Check browser console for WebSocket connection logs
   - Verify "Real-time Updates: Connected" in dashboard
   - Test connection resilience by restarting backend

2. **Live Proposal Updates**
   - Create a proposal (manually or wait for AI)
   - Verify it appears immediately in dashboard
   - Check that proposal updates in real-time

### 7. Proposal Decision Testing ✓

1. **View Active Proposals**
   - Navigate to Dashboard
   - Check "Active Proposals" section
   - Click "View All" to see Proposals page

2. **Approve Proposal**
   - Click "Approve Trade" on a proposal
   - Add optional decision notes
   - Verify proposal status updates
   - Check execution in trade history

3. **Reject Proposal**
   - Click "Reject" on a proposal
   - Add optional rejection reason
   - Verify status updates immediately

### 8. Trade Execution Testing ✓

1. **Successful Execution**
   - Approve a proposal
   - Monitor backend logs for execution
   - Check Alpaca dashboard for paper trade
   - Verify execution record in database

2. **Execution Failure Handling**
   - Test with invalid symbols or market closed
   - Verify error handling and logging
   - Check that failure is properly recorded

### 9. Data Persistence Testing ✓

1. **Database Verification**
   - Check Supabase tables for data:
     - `trade_proposals`
     - `trade_decisions`  
     - `trade_executions`
   - Verify data integrity and relationships

2. **User Data Isolation**
   - Create multiple users
   - Verify each user only sees their own data
   - Test Row Level Security policies

### 10. UI/UX Testing ✓

1. **Dashboard Functionality**
   - Verify all cards show correct data
   - Test AI engine start/stop controls
   - Check system status indicators

2. **Proposals Page**
   - Test proposal filtering and sorting
   - Verify approve/reject actions work
   - Check loading states and error handling

3. **History Page**
   - Verify complete trading history display
   - Test filtering by status
   - Check data accuracy

### 11. Error Handling Testing ✓

1. **Network Errors**
   - Disconnect from internet
   - Verify graceful error messages
   - Test automatic reconnection

2. **API Errors**
   - Stop backend service
   - Verify error boundaries catch failures
   - Test fallback behaviors

3. **Database Errors**
   - Test with invalid credentials
   - Verify proper error messages
   - Check that app doesn't crash

### 12. Performance Testing ✓

1. **Load Testing**
   - Generate multiple proposals quickly
   - Test WebSocket with many connections
   - Monitor memory usage

2. **Real-time Performance**
   - Measure proposal-to-display latency
   - Test with multiple browser tabs
   - Verify WebSocket efficiency

## Test Results Checklist

Mark each item when successfully tested:

- [ ] User registration and authentication works
- [ ] API endpoints respond correctly
- [ ] AI engine starts and generates proposals
- [ ] WebSocket real-time updates function
- [ ] Proposals can be approved and rejected
- [ ] Trade execution works through Alpaca
- [ ] Data is properly stored in Supabase
- [ ] User data isolation is maintained
- [ ] Error handling is graceful
- [ ] UI is responsive and intuitive

## Troubleshooting

### Common Issues

1. **AI Engine Not Starting**
   - Check Alpaca API credentials
   - Verify environment variables
   - Check backend logs for errors

2. **WebSocket Not Connecting**
   - Verify Redis is running
   - Check CORS configuration
   - Test WebSocket endpoint directly

3. **Database Connection Issues**
   - Verify Supabase credentials
   - Check network connectivity
   - Ensure database schema is applied

4. **Authentication Problems**
   - Check JWT token format
   - Verify Supabase auth configuration
   - Test token refresh behavior

### Debug Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs redis

# Test database connection
psql "postgresql://[username]:[password]@[host]:[port]/[database]"

# Test Redis connection
redis-cli -h localhost -p 6379 ping
```

## Production Testing

Before deploying to production:

1. Test with real market data (market hours)
2. Verify all environment variables for production
3. Test deployment scripts
4. Perform security audit
5. Load test with expected user volume
6. Verify monitoring and alerting systems

## Success Criteria

The system passes testing when:

1. ✅ Complete user flow works end-to-end
2. ✅ Real-time updates are reliable
3. ✅ All data is correctly persisted
4. ✅ Error handling is comprehensive
5. ✅ Performance meets requirements
6. ✅ Security measures are effective