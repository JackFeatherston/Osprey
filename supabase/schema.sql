-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trade Proposals Table
-- Stores AI-generated trade proposals awaiting user approval
CREATE TABLE trade_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    symbol VARCHAR(10) NOT NULL,
    action VARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10, 2) NOT NULL CHECK (price > 0),
    reason TEXT NOT NULL,
    strategy VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Create indexes for trade_proposals
CREATE INDEX idx_trade_proposals_user_id ON trade_proposals(user_id);
CREATE INDEX idx_trade_proposals_status ON trade_proposals(status);
CREATE INDEX idx_trade_proposals_created_at ON trade_proposals(created_at);

-- Trade Decisions Table  
-- Records user decisions (approve/reject) on trade proposals
CREATE TABLE trade_decisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES trade_proposals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    decision VARCHAR(10) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    
    -- Ensure one decision per proposal
    UNIQUE(proposal_id)
);

-- Create indexes for trade_decisions
CREATE INDEX idx_trade_decisions_user_id ON trade_decisions(user_id);
CREATE INDEX idx_trade_decisions_created_at ON trade_decisions(created_at);

-- Trade Executions Table
-- Records actual trade executions through broker API
CREATE TABLE trade_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES trade_proposals(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    broker_order_id VARCHAR(100), -- Alpaca order ID
    symbol VARCHAR(10) NOT NULL,
    action VARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL')),
    quantity INTEGER NOT NULL,
    executed_price DECIMAL(10, 2),
    execution_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (execution_status IN ('PENDING', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'REJECTED')),
    executed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    error_message TEXT
);

-- Create indexes for trade_executions
CREATE INDEX idx_trade_executions_user_id ON trade_executions(user_id);
CREATE INDEX idx_trade_executions_symbol ON trade_executions(symbol);
CREATE INDEX idx_trade_executions_created_at ON trade_executions(created_at);

-- User Settings Table
-- Store user-specific trading preferences and configurations
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    max_trade_amount DECIMAL(10, 2) DEFAULT 1000.00,
    auto_approve_under DECIMAL(10, 2) DEFAULT 0, -- Auto-approve trades under this amount
    enabled_strategies TEXT[] DEFAULT ARRAY['MA_Crossover', 'RSI'],
    risk_tolerance VARCHAR(10) DEFAULT 'MEDIUM' CHECK (risk_tolerance IN ('LOW', 'MEDIUM', 'HIGH')),
    notifications_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Market Data Cache Table (optional - for caching frequently accessed data)
CREATE TABLE market_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(10) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    volume BIGINT,
    change_percent DECIMAL(5, 2),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(symbol)
);

-- Create indexes for market_data
CREATE INDEX idx_market_data_symbol ON market_data(symbol);
CREATE INDEX idx_market_data_updated_at ON market_data(updated_at);

-- Row Level Security Policies
-- Enable RLS on all tables
ALTER TABLE trade_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trade_proposals
CREATE POLICY "Users can view their own trade proposals" ON trade_proposals
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade proposals" ON trade_proposals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own trade proposals" ON trade_proposals
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for trade_decisions
CREATE POLICY "Users can view their own trade decisions" ON trade_decisions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade decisions" ON trade_decisions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for trade_executions
CREATE POLICY "Users can view their own trade executions" ON trade_executions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own trade executions" ON trade_executions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for user_settings
CREATE POLICY "Users can view their own settings" ON user_settings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policy for market_data (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view market data" ON market_data
    FOR SELECT TO authenticated USING (true);

-- Functions and Triggers

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_settings updated_at
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create default user settings when a new user signs up
CREATE OR REPLACE FUNCTION create_default_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_settings (user_id)
    VALUES (NEW.id);
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to create user settings on user creation
CREATE TRIGGER create_user_settings_trigger
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_user_settings();

-- Function to expire old proposals
CREATE OR REPLACE FUNCTION expire_old_proposals()
RETURNS void AS $$
BEGIN
    UPDATE trade_proposals
    SET status = 'EXPIRED'
    WHERE status = 'PENDING'
    AND expires_at < NOW();
END;
$$ language 'plpgsql';

-- Views for easier querying

-- Active proposals view
CREATE VIEW active_proposals AS
SELECT * FROM trade_proposals
WHERE status = 'PENDING'
AND expires_at > NOW();

-- Recent trade activity view
CREATE VIEW recent_trade_activity AS
SELECT 
    tp.id as proposal_id,
    tp.symbol,
    tp.action,
    tp.quantity,
    tp.price,
    tp.reason,
    tp.strategy,
    td.decision,
    td.created_at as decision_at,
    te.execution_status,
    te.executed_price,
    te.executed_at,
    tp.user_id
FROM trade_proposals tp
LEFT JOIN trade_decisions td ON tp.id = td.proposal_id
LEFT JOIN trade_executions te ON tp.id = te.proposal_id
ORDER BY tp.created_at DESC;

-- User portfolio summary view
CREATE VIEW user_portfolio_summary AS
SELECT 
    user_id,
    COUNT(CASE WHEN te.execution_status = 'FILLED' THEN 1 END) as total_trades,
    COUNT(CASE WHEN te.execution_status = 'FILLED' AND te.action = 'BUY' THEN 1 END) as buy_trades,
    COUNT(CASE WHEN te.execution_status = 'FILLED' AND te.action = 'SELL' THEN 1 END) as sell_trades,
    COALESCE(SUM(CASE WHEN te.execution_status = 'FILLED' THEN te.quantity * te.executed_price END), 0) as total_trade_volume
FROM trade_executions te
GROUP BY user_id;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;