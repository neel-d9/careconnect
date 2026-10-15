-- =========================================================
-- CareConnect - Workflow 2
-- 7-Day Moving Average of Copay Revenue per Clinic
-- Ranked using DENSE_RANK()
-- =========================================================

DROP VIEW IF EXISTS clinic_window_analytics;
CREATE OR REPLACE VIEW clinic_window_analytics AS
WITH daily_clinic_revenue AS (
    SELECT
        clinic_id,
        DATE_TRUNC('day', created_at)::date AS rev_date,
        SUM(copay_amount) AS daily_copay_total
    FROM appointments
    WHERE status = 'DISCHARGED'
    GROUP BY
        clinic_id,
        DATE_TRUNC('day', created_at)::date
),

clinic_date_ranges AS (
    SELECT
        clinic_id,
        MIN(rev_date) AS min_date,
        MAX(rev_date) AS max_date
    FROM daily_clinic_revenue
    GROUP BY clinic_id
),

clinic_calendar AS (
    SELECT
        r.clinic_id,
        generate_series(
            r.min_date,
            r.max_date,
            INTERVAL '1 day'
        )::date AS rev_date
    FROM clinic_date_ranges r
),

calendar_revenue AS (
    SELECT
        cc.clinic_id,
        cc.rev_date,
        COALESCE(dcr.daily_copay_total, 0.00) AS daily_copay_total
    FROM clinic_calendar cc
    LEFT JOIN daily_clinic_revenue dcr
        ON dcr.clinic_id = cc.clinic_id
       AND dcr.rev_date = cc.rev_date
),

moving_averages AS (
    SELECT
        clinic_id,
        rev_date,
        daily_copay_total,

        AVG(daily_copay_total) OVER (
            PARTITION BY clinic_id
            ORDER BY rev_date
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ) AS moving_7day_avg,

        SUM(daily_copay_total) OVER (
            PARTITION BY clinic_id
        ) AS total_clinic_revenue

    FROM calendar_revenue
)

SELECT
    c.id AS clinic_id,
    c.name AS clinic_name,
    m.rev_date,
    m.daily_copay_total,
    ROUND(m.moving_7day_avg, 2) AS moving_7day_avg,
    ROUND(m.total_clinic_revenue, 2) AS total_clinic_revenue,
    DENSE_RANK() OVER (
        ORDER BY m.total_clinic_revenue DESC
    ) AS global_revenue_rank

FROM moving_averages m
JOIN clinics c
    ON m.clinic_id = c.id
	WHERE m.rev_date >= CURRENT_DATE - INTERVAL '20 days'

ORDER BY
    global_revenue_rank,
    m.rev_date;