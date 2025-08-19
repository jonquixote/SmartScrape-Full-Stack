-- Migration 0005: Proxy performance tracking and monitoring
-- Adds comprehensive proxy performance metrics and monitoring capabilities

-- Create proxy_performance table for detailed metrics tracking
CREATE TABLE IF NOT EXISTS proxy_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proxy_id INTEGER NOT NULL,
    response_time INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 0,
    last_success TIMESTAMP DEFAULT NULL,
    last_failure TIMESTAMP DEFAULT NULL,
    total_requests INTEGER NOT NULL DEFAULT 0,
    failed_requests INTEGER NOT NULL DEFAULT 0,
    consecutive_failures INTEGER NOT NULL DEFAULT 0,
    average_response_time INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE CASCADE
);

-- Add reliability rating column to proxies table
ALTER TABLE proxies ADD COLUMN reliability_rating TEXT DEFAULT 'unknown';

-- Add more detailed proxy information columns
ALTER TABLE proxies ADD COLUMN country TEXT DEFAULT NULL;
ALTER TABLE proxies ADD COLUMN city TEXT DEFAULT NULL;
ALTER TABLE proxies ADD COLUMN isp TEXT DEFAULT NULL;
ALTER TABLE proxies ADD COLUMN protocol_support TEXT DEFAULT 'http';
ALTER TABLE proxies ADD COLUMN anonymity_level TEXT DEFAULT 'unknown';
ALTER TABLE proxies ADD COLUMN last_tested TIMESTAMP DEFAULT NULL;

-- Create proxy_test_history table for historical test data
CREATE TABLE IF NOT EXISTS proxy_test_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    proxy_id INTEGER NOT NULL,
    test_url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'timeout', 'blocked')),
    response_time INTEGER NOT NULL,
    error_message TEXT DEFAULT NULL,
    response_code INTEGER DEFAULT NULL,
    response_size INTEGER DEFAULT NULL,
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_proxy_performance_proxy_id ON proxy_performance(proxy_id);
CREATE INDEX IF NOT EXISTS idx_proxy_performance_success_rate ON proxy_performance(success_rate DESC);
CREATE INDEX IF NOT EXISTS idx_proxy_performance_response_time ON proxy_performance(average_response_time ASC);
CREATE INDEX IF NOT EXISTS idx_proxy_performance_last_success ON proxy_performance(last_success DESC);

CREATE INDEX IF NOT EXISTS idx_proxies_reliability ON proxies(reliability_rating);
CREATE INDEX IF NOT EXISTS idx_proxies_score_status ON proxies(score DESC, status);
CREATE INDEX IF NOT EXISTS idx_proxies_last_tested ON proxies(last_tested DESC);

CREATE INDEX IF NOT EXISTS idx_proxy_test_history_proxy_id ON proxy_test_history(proxy_id);
CREATE INDEX IF NOT EXISTS idx_proxy_test_history_tested_at ON proxy_test_history(tested_at DESC);
CREATE INDEX IF NOT EXISTS idx_proxy_test_history_status ON proxy_test_history(status);

-- Create view for proxy analytics
CREATE VIEW IF NOT EXISTS proxy_analytics AS
SELECT 
    p.id,
    p.name,
    p.url,
    p.source,
    p.type,
    p.status,
    p.score,
    p.reliability_rating,
    p.latency,
    p.country,
    p.city,
    p.last_tested,
    pp.success_rate,
    pp.average_response_time,
    pp.total_requests,
    pp.failed_requests,
    pp.consecutive_failures,
    pp.last_success,
    pp.last_failure,
    -- Calculate uptime percentage
    CASE 
        WHEN pp.total_requests > 0 THEN 
            ROUND(((pp.total_requests - pp.failed_requests) * 100.0 / pp.total_requests), 2)
        ELSE 0
    END as uptime_percentage,
    -- Calculate reliability score
    CASE 
        WHEN pp.total_requests >= 10 THEN
            CASE 
                WHEN pp.success_rate >= 95 AND pp.consecutive_failures <= 1 THEN 'excellent'
                WHEN pp.success_rate >= 85 AND pp.consecutive_failures <= 3 THEN 'good' 
                WHEN pp.success_rate >= 70 AND pp.consecutive_failures <= 5 THEN 'fair'
                WHEN pp.success_rate >= 50 AND pp.consecutive_failures <= 10 THEN 'poor'
                ELSE 'unreliable'
            END
        ELSE 'untested'
    END as calculated_reliability,
    -- Days since last success
    CASE 
        WHEN pp.last_success IS NOT NULL THEN
            ROUND(CAST((julianday('now') - julianday(pp.last_success)) AS REAL), 1)
        ELSE NULL
    END as days_since_last_success
FROM proxies p
LEFT JOIN proxy_performance pp ON p.id = pp.proxy_id;

-- Create trigger to update proxy last_tested timestamp
CREATE TRIGGER IF NOT EXISTS update_proxy_last_tested
    AFTER INSERT ON proxy_test_history
    FOR EACH ROW
BEGIN
    UPDATE proxies 
    SET last_tested = NEW.tested_at 
    WHERE id = NEW.proxy_id;
END;

-- Create trigger to maintain proxy_performance averages
CREATE TRIGGER IF NOT EXISTS update_proxy_performance_averages
    AFTER INSERT ON proxy_test_history
    FOR EACH ROW
BEGIN
    INSERT OR REPLACE INTO proxy_performance (
        proxy_id, response_time, success_rate, last_success, last_failure,
        total_requests, failed_requests, consecutive_failures, average_response_time
    )
    SELECT 
        NEW.proxy_id,
        NEW.response_time,
        ROUND(
            (COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as success_rate,
        MAX(CASE WHEN status = 'success' THEN tested_at END) as last_success,
        MAX(CASE WHEN status != 'success' THEN tested_at END) as last_failure,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status != 'success' THEN 1 END) as failed_requests,
        CASE 
            WHEN NEW.status = 'success' THEN 0
            ELSE (
                SELECT COUNT(*) FROM proxy_test_history 
                WHERE proxy_id = NEW.proxy_id 
                AND tested_at > COALESCE(
                    (SELECT MAX(tested_at) FROM proxy_test_history 
                     WHERE proxy_id = NEW.proxy_id AND status = 'success'), 
                    '1970-01-01'
                )
            )
        END as consecutive_failures,
        ROUND(AVG(response_time)) as average_response_time
    FROM proxy_test_history 
    WHERE proxy_id = NEW.proxy_id;
END;