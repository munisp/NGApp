-- SQL Queries for Superset Dashboard Data Sources
-- Enterprise CRM Analytics Views and Queries

-- =====================================================
-- SALES ANALYTICS VIEWS
-- =====================================================

-- Sales Pipeline Summary
CREATE OR REPLACE VIEW sales_pipeline_summary AS
SELECT 
    o.stage,
    COUNT(*) as opportunity_count,
    SUM(o.amount) as total_amount,
    AVG(o.amount) as avg_amount,
    SUM(CASE WHEN o.probability >= 75 THEN o.amount ELSE 0 END) as high_probability_amount,
    AVG(o.probability) as avg_probability
FROM opportunities o
WHERE o.deleted_at IS NULL 
    AND o.status IN ('open', 'in_progress')
GROUP BY o.stage
ORDER BY 
    CASE o.stage
        WHEN 'prospecting' THEN 1
        WHEN 'qualification' THEN 2
        WHEN 'needs_analysis' THEN 3
        WHEN 'value_proposition' THEN 4
        WHEN 'proposal' THEN 5
        WHEN 'negotiation' THEN 6
        WHEN 'closing' THEN 7
        ELSE 8
    END;

-- Lead Conversion Funnel
CREATE OR REPLACE VIEW lead_conversion_funnel AS
SELECT 
    stage,
    stage_order,
    count,
    conversion_rate
FROM (
    SELECT 'Leads' as stage, 1 as stage_order, COUNT(*) as count, 100.0 as conversion_rate
    FROM leads WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 'Qualified Leads' as stage, 2 as stage_order, COUNT(*) as count,
           (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL)) as conversion_rate
    FROM leads WHERE status = 'qualified' AND deleted_at IS NULL
    
    UNION ALL
    
    SELECT 'Opportunities' as stage, 3 as stage_order, COUNT(*) as count,
           (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL)) as conversion_rate
    FROM opportunities WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 'Won Opportunities' as stage, 4 as stage_order, COUNT(*) as count,
           (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL)) as conversion_rate
    FROM opportunities WHERE status IN ('won', 'closed_won') AND deleted_at IS NULL
    
    UNION ALL
    
    SELECT 'Customers' as stage, 5 as stage_order, COUNT(*) as count,
           (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL)) as conversion_rate
    FROM customers WHERE status = 'active' AND deleted_at IS NULL
) funnel
ORDER BY stage_order;

-- Monthly Sales Trend
CREATE OR REPLACE VIEW monthly_sales_trend AS
SELECT 
    DATE_TRUNC('month', o.close_date) as month,
    COUNT(*) as deals_closed,
    SUM(o.amount) as total_revenue,
    AVG(o.amount) as avg_deal_size,
    COUNT(DISTINCT o.account_id) as unique_accounts
FROM opportunities o
WHERE o.status IN ('won', 'closed_won')
    AND o.deleted_at IS NULL
    AND o.close_date >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY DATE_TRUNC('month', o.close_date)
ORDER BY month;

-- =====================================================
-- MARKETING ANALYTICS VIEWS
-- =====================================================

-- Lead Source Performance
CREATE OR REPLACE VIEW lead_source_performance AS
SELECT 
    l.source,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) as qualified_leads,
    COUNT(CASE WHEN l.status = 'converted' THEN 1 END) as converted_leads,
    ROUND(
        COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) * 100.0 / COUNT(*), 2
    ) as qualification_rate,
    ROUND(
        COUNT(CASE WHEN l.status = 'converted' THEN 1 END) * 100.0 / COUNT(*), 2
    ) as conversion_rate,
    AVG(l.score) as avg_lead_score
FROM leads l
WHERE l.deleted_at IS NULL
    AND l.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY l.source
ORDER BY total_leads DESC;

-- Campaign Performance
CREATE OR REPLACE VIEW marketing_campaigns AS
SELECT 
    c.name as campaign_name,
    c.type as campaign_type,
    c.channel,
    c.status,
    c.budget,
    c.cost_spent as cost,
    COUNT(l.id) as leads_generated,
    COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) as qualified_leads,
    COUNT(CASE WHEN l.status = 'converted' THEN 1 END) as converted_leads,
    ROUND(c.cost_spent / NULLIF(COUNT(l.id), 0), 2) as cost_per_lead,
    ROUND(
        COUNT(CASE WHEN l.status = 'qualified' THEN 1 END) * 100.0 / NULLIF(COUNT(l.id), 0), 2
    ) as conversion_rate
FROM campaigns c
LEFT JOIN leads l ON l.campaign_id = c.id AND l.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id, c.name, c.type, c.channel, c.status, c.budget, c.cost_spent
ORDER BY leads_generated DESC;

-- Marketing ROI by Channel
CREATE OR REPLACE VIEW marketing_roi AS
SELECT 
    channel,
    SUM(cost_spent) as total_cost,
    SUM(revenue_attributed) as total_revenue,
    COUNT(leads_generated) as total_leads,
    ROUND(
        (SUM(revenue_attributed) - SUM(cost_spent)) / NULLIF(SUM(cost_spent), 0) * 100, 2
    ) as roi_percentage,
    ROUND(SUM(cost_spent) / NULLIF(COUNT(leads_generated), 0), 2) as cost_per_lead
FROM (
    SELECT 
        c.channel,
        c.cost_spent,
        COUNT(l.id) as leads_generated,
        SUM(COALESCE(o.amount, 0)) as revenue_attributed
    FROM campaigns c
    LEFT JOIN leads l ON l.campaign_id = c.id AND l.deleted_at IS NULL
    LEFT JOIN opportunities o ON o.lead_id = l.id AND o.status IN ('won', 'closed_won') AND o.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c.id, c.channel, c.cost_spent
) channel_data
GROUP BY channel
ORDER BY roi_percentage DESC;

-- =====================================================
-- CUSTOMER ANALYTICS VIEWS
-- =====================================================

-- Customer Lifetime Value by Segment
CREATE OR REPLACE VIEW customer_analytics AS
SELECT 
    c.segment,
    c.tier,
    COUNT(*) as customer_count,
    AVG(c.lifetime_value) as avg_lifetime_value,
    SUM(c.lifetime_value) as total_lifetime_value,
    AVG(c.annual_revenue) as avg_annual_revenue,
    AVG(EXTRACT(DAYS FROM CURRENT_DATE - c.created_at)) as avg_customer_age_days
FROM customers c
WHERE c.deleted_at IS NULL
    AND c.status = 'active'
GROUP BY c.segment, c.tier
ORDER BY avg_lifetime_value DESC;

-- Customer Churn Analysis
CREATE OR REPLACE VIEW customer_churn AS
SELECT 
    DATE_TRUNC('month', analysis_date) as month,
    total_customers,
    churned_customers,
    ROUND(churned_customers * 100.0 / total_customers, 2) as churn_rate,
    new_customers,
    net_growth
FROM (
    SELECT 
        DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11)) as analysis_date,
        (
            SELECT COUNT(*) 
            FROM customers 
            WHERE status = 'active' 
                AND created_at <= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11))
                AND deleted_at IS NULL
        ) as total_customers,
        (
            SELECT COUNT(*) 
            FROM customers 
            WHERE status = 'churned'
                AND updated_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11))
                AND updated_at < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11)) + INTERVAL '1 month'
                AND deleted_at IS NULL
        ) as churned_customers,
        (
            SELECT COUNT(*) 
            FROM customers 
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11))
                AND created_at < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11)) + INTERVAL '1 month'
                AND deleted_at IS NULL
        ) as new_customers,
        (
            SELECT COUNT(*) 
            FROM customers 
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11))
                AND created_at < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11)) + INTERVAL '1 month'
                AND deleted_at IS NULL
        ) - (
            SELECT COUNT(*) 
            FROM customers 
            WHERE status = 'churned'
                AND updated_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11))
                AND updated_at < DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month' * generate_series(0, 11)) + INTERVAL '1 month'
                AND deleted_at IS NULL
        ) as net_growth
) churn_data
ORDER BY month DESC;

-- =====================================================
-- INVENTORY ANALYTICS VIEWS
-- =====================================================

-- Inventory Summary by Category
CREATE OR REPLACE VIEW inventory_summary AS
SELECT 
    pc.name as category,
    COUNT(DISTINCT p.id) as product_count,
    SUM(si.quantity_on_hand) as quantity_on_hand,
    SUM(si.quantity_reserved) as quantity_reserved,
    SUM(si.quantity_on_hand - si.quantity_reserved) as available_quantity,
    SUM(si.total_value) as total_value,
    AVG(si.unit_cost) as avg_unit_cost,
    COUNT(CASE WHEN si.quantity_on_hand <= p.reorder_point THEN 1 END) as low_stock_items,
    COUNT(CASE WHEN si.quantity_on_hand = 0 THEN 1 END) as out_of_stock_items
FROM stock_items si
JOIN products p ON p.id = si.product_id
JOIN product_categories pc ON pc.id = p.category_id
WHERE si.deleted_at IS NULL 
    AND p.deleted_at IS NULL 
    AND pc.deleted_at IS NULL
GROUP BY pc.id, pc.name
ORDER BY total_value DESC;

-- Product Performance
CREATE OR REPLACE VIEW product_performance AS
SELECT 
    p.name as product_name,
    p.sku,
    pc.name as category,
    pb.name as brand,
    SUM(oi.quantity) as quantity_sold,
    SUM(oi.total_amount) as revenue,
    AVG(oi.unit_price) as avg_selling_price,
    AVG(si.unit_cost) as avg_cost,
    AVG(oi.unit_price - si.unit_cost) as avg_margin,
    ROUND(AVG((oi.unit_price - si.unit_cost) / oi.unit_price * 100), 2) as margin_percentage,
    COUNT(DISTINCT o.customer_id) as unique_customers
FROM products p
JOIN product_categories pc ON pc.id = p.category_id
LEFT JOIN product_brands pb ON pb.id = p.brand_id
JOIN stock_items si ON si.product_id = p.id
JOIN order_items oi ON oi.product_id = p.id
JOIN orders o ON o.id = oi.order_id
WHERE p.deleted_at IS NULL 
    AND si.deleted_at IS NULL
    AND o.status = 'completed'
    AND o.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY p.id, p.name, p.sku, pc.name, pb.name
ORDER BY revenue DESC;

-- Supplier Performance
CREATE OR REPLACE VIEW supplier_performance AS
SELECT 
    s.name as supplier_name,
    s.supplier_number,
    s.status,
    COUNT(DISTINCT p.id) as products_supplied,
    AVG(s.quality_rating) as avg_quality_rating,
    AVG(s.delivery_rating) as avg_delivery_rating,
    AVG(s.cost_rating) as avg_cost_rating,
    AVG(s.overall_rating) as avg_overall_rating,
    COUNT(po.id) as total_orders,
    SUM(po.total_amount) as total_order_value,
    AVG(po.total_amount) as avg_order_value,
    AVG(EXTRACT(DAYS FROM po.delivered_date - po.order_date)) as avg_delivery_days
FROM suppliers s
LEFT JOIN products p ON p.supplier_id = s.id AND p.deleted_at IS NULL
LEFT JOIN purchase_orders po ON po.supplier_id = s.id AND po.status = 'completed'
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.name, s.supplier_number, s.status
ORDER BY avg_overall_rating DESC;

-- =====================================================
-- FINANCIAL ANALYTICS VIEWS
-- =====================================================

-- Revenue Analysis
CREATE OR REPLACE VIEW revenue_analysis AS
SELECT 
    DATE_TRUNC('month', o.created_at) as month,
    SUM(CASE WHEN o.status IN ('won', 'closed_won') THEN o.amount ELSE 0 END) as actual_revenue,
    SUM(CASE WHEN o.forecast_category = 'commit' THEN o.amount ELSE 0 END) as committed_revenue,
    SUM(CASE WHEN o.forecast_category = 'best_case' THEN o.amount ELSE 0 END) as best_case_revenue,
    SUM(CASE WHEN o.forecast_category = 'pipeline' THEN o.amount ELSE 0 END) as pipeline_revenue,
    COUNT(CASE WHEN o.status IN ('won', 'closed_won') THEN 1 END) as deals_won,
    COUNT(CASE WHEN o.status IN ('lost', 'closed_lost') THEN 1 END) as deals_lost,
    ROUND(
        COUNT(CASE WHEN o.status IN ('won', 'closed_won') THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN o.status IN ('won', 'closed_won', 'lost', 'closed_lost') THEN 1 END), 0), 2
    ) as win_rate
FROM opportunities o
WHERE o.deleted_at IS NULL
    AND o.created_at >= CURRENT_DATE - INTERVAL '24 months'
GROUP BY DATE_TRUNC('month', o.created_at)
ORDER BY month;

-- =====================================================
-- OPERATIONAL ANALYTICS VIEWS
-- =====================================================

-- Activity Summary
CREATE OR REPLACE VIEW activity_summary AS
SELECT 
    a.type as activity_type,
    a.status,
    COUNT(*) as activity_count,
    COUNT(DISTINCT a.assigned_to) as unique_assignees,
    AVG(EXTRACT(DAYS FROM a.completed_at - a.created_at)) as avg_completion_days,
    COUNT(CASE WHEN a.due_date < CURRENT_DATE AND a.status != 'completed' THEN 1 END) as overdue_count
FROM activities a
WHERE a.deleted_at IS NULL
    AND a.created_at >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY a.type, a.status
ORDER BY activity_count DESC;

-- User Performance
CREATE OR REPLACE VIEW user_performance AS
SELECT 
    u.name as user_name,
    u.role,
    COUNT(DISTINCT o.id) as opportunities_owned,
    SUM(CASE WHEN o.status IN ('won', 'closed_won') THEN o.amount ELSE 0 END) as revenue_generated,
    COUNT(CASE WHEN o.status IN ('won', 'closed_won') THEN 1 END) as deals_won,
    COUNT(CASE WHEN o.status IN ('lost', 'closed_lost') THEN 1 END) as deals_lost,
    ROUND(
        COUNT(CASE WHEN o.status IN ('won', 'closed_won') THEN 1 END) * 100.0 / 
        NULLIF(COUNT(CASE WHEN o.status IN ('won', 'closed_won', 'lost', 'closed_lost') THEN 1 END), 0), 2
    ) as win_rate,
    COUNT(DISTINCT a.id) as activities_completed
FROM users u
LEFT JOIN opportunities o ON o.owner_id = u.id AND o.deleted_at IS NULL
LEFT JOIN activities a ON a.assigned_to = u.id AND a.status = 'completed' AND a.deleted_at IS NULL
WHERE u.deleted_at IS NULL
    AND u.status = 'active'
GROUP BY u.id, u.name, u.role
ORDER BY revenue_generated DESC;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Opportunities indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_status_amount ON opportunities(status, amount) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_stage_created ON opportunities(stage, created_at) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_close_date ON opportunities(close_date) WHERE deleted_at IS NULL;

-- Leads indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_status_source ON leads(status, source) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_leads_created_score ON leads(created_at, score) WHERE deleted_at IS NULL;

-- Customers indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_segment_tier ON customers(segment, tier) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_customers_status_created ON customers(status, created_at) WHERE deleted_at IS NULL;

-- Stock items indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_items_product_warehouse ON stock_items(product_id, warehouse_id) WHERE deleted_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_stock_items_quantity_value ON stock_items(quantity_on_hand, total_value) WHERE deleted_at IS NULL;

