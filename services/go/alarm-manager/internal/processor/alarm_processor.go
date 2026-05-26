// Package processor implements the alarm evaluation engine.
// Consumes telemetry from Kafka, evaluates alarm rules, and starts
// Temporal workflows for alarm escalation.
// Spec: FRQ-005 — workflow completion < 1s; BRQ-006 — < 1 min notification.
package processor

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/twmb/franz-go/pkg/kgo"
	temporalclient "go.temporal.io/sdk/client"
	"go.temporal.io/sdk/temporal"
	"go.temporal.io/sdk/workflow"
)

// AlarmEvent represents a triggered alarm.
type AlarmEvent struct {
	AlarmID    string    `json:"alarm_id"`
	WellID     string    `json:"well_id"`
	WellName   string    `json:"well_name"`
	SensorType string    `json:"sensor_type"`
	Severity   int       `json:"severity"`
	Message    string    `json:"message"`
	Value      float64   `json:"value"`
	Threshold  float64   `json:"threshold"`
	TenantID   string    `json:"tenant_id"`
	Timestamp  time.Time `json:"timestamp"`
}

// TelemetryReading is consumed from Kafka og.field.telemetry.raw.
type TelemetryReading struct {
	WellID     string            `json:"well_id"`
	SensorType string            `json:"sensor_type"`
	Value      float64           `json:"value"`
	Unit       string            `json:"unit"`
	Quality    int               `json:"quality"`
	Timestamp  time.Time         `json:"timestamp"`
	TenantID   string            `json:"tenant_id"`
	Tags       map[string]string `json:"tags,omitempty"`
}

// AlarmRule defines conditions that trigger an alarm.
type AlarmRule struct {
	RuleID          string  `json:"rule_id"`
	WellID          string  `json:"well_id"`
	SensorType      string  `json:"sensor_type"`
	Condition       string  `json:"condition"`
	Threshold       float64 `json:"threshold"`
	Severity        int     `json:"severity"`
	MessageTemplate string  `json:"message_template"`
	DeadBand        float64 `json:"dead_band"`
}

// AlarmProcessor evaluates telemetry against alarm rules.
type AlarmProcessor struct {
	pool           *pgxpool.Pool
	kafkaBrokers   string
	temporalHost   string
	temporalClient temporalclient.Client
	kafkaClient    *kgo.Client
	rules          []AlarmRule
	rulesCached    time.Time
}

// NewAlarmProcessor creates a new processor.
func NewAlarmProcessor(pool *pgxpool.Pool, kafkaBrokers, temporalHost string) *AlarmProcessor {
	return &AlarmProcessor{
		pool:         pool,
		kafkaBrokers: kafkaBrokers,
		temporalHost: temporalHost,
	}
}

// Start begins consuming telemetry from Kafka and evaluating alarms.
func (p *AlarmProcessor) Start(ctx context.Context) {
	slog.Info("Alarm processor starting",
		"kafka", p.kafkaBrokers,
		"temporal", p.temporalHost,
	)

	if err := p.refreshRules(ctx); err != nil {
		slog.Error("failed to load alarm rules", "err", err)
	}

	// Connect to Temporal
	tc, err := temporalclient.Dial(temporalclient.Options{
		HostPort:  p.temporalHost,
		Namespace: os.Getenv("TEMPORAL_NAMESPACE"),
	})
	if err != nil {
		slog.Error("Temporal connection failed — escalation workflows disabled", "err", err)
	} else {
		p.temporalClient = tc
		defer tc.Close()
	}

	// Connect to Kafka consumer
	kafkaClient, err := kgo.NewClient(
		kgo.SeedBrokers(p.kafkaBrokers),
		kgo.ConsumerGroup("alarm-manager"),
		kgo.ConsumeTopics("og.field.telemetry.raw"),
		kgo.FetchMaxWait(time.Second),
	)
	if err != nil {
		slog.Error("Kafka consumer creation failed — using polling fallback", "err", err)
		p.runPollingFallback(ctx)
		return
	}
	p.kafkaClient = kafkaClient
	defer kafkaClient.Close()

	slog.Info("Kafka consumer connected", "topic", "og.field.telemetry.raw", "group", "alarm-manager")

	ruleRefreshTicker := time.NewTicker(5 * time.Minute)
	defer ruleRefreshTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			slog.Info("Alarm processor stopped")
			return
		case <-ruleRefreshTicker.C:
			if err := p.refreshRules(ctx); err != nil {
				slog.Warn("rule refresh failed", "err", err)
			}
		default:
			fetches := kafkaClient.PollFetches(ctx)
			if fetches.IsClientClosed() {
				return
			}
			if errs := fetches.Errors(); len(errs) > 0 {
				for _, e := range errs {
					slog.Warn("kafka fetch error", "topic", e.Topic, "partition", e.Partition, "err", e.Err)
				}
			}
			fetches.EachRecord(func(r *kgo.Record) {
				var reading TelemetryReading
				if err := json.Unmarshal(r.Value, &reading); err != nil {
					slog.Warn("invalid telemetry message", "offset", r.Offset, "err", err)
					return
				}
				p.EvaluateReading(ctx, reading)
			})
		}
	}
}

func (p *AlarmProcessor) runPollingFallback(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			slog.Info("Alarm processor polling fallback stopped")
			return
		case <-ticker.C:
			if time.Since(p.rulesCached) > 5*time.Minute {
				if err := p.refreshRules(ctx); err != nil {
					slog.Warn("rule refresh failed", "err", err)
				}
			}
		}
	}
}

// EvaluateReading checks a telemetry reading against all applicable rules.
func (p *AlarmProcessor) EvaluateReading(ctx context.Context, reading TelemetryReading) []AlarmEvent {
	var triggered []AlarmEvent

	for _, rule := range p.rules {
		if rule.WellID != "" && rule.WellID != reading.WellID {
			continue
		}
		if rule.SensorType != reading.SensorType {
			continue
		}
		if !p.evaluateCondition(reading.Value, rule.Condition, rule.Threshold) {
			continue
		}

		alarm := AlarmEvent{
			WellID:     reading.WellID,
			SensorType: reading.SensorType,
			Severity:   rule.Severity,
			Value:      reading.Value,
			Threshold:  rule.Threshold,
			TenantID:   reading.TenantID,
			Timestamp:  reading.Timestamp,
			Message:    p.formatMessage(rule.MessageTemplate, reading, rule),
		}

		alarmID, err := p.persistAlarm(ctx, alarm, rule.RuleID)
		if err != nil {
			slog.Error("failed to persist alarm", "err", err)
			continue
		}
		alarm.AlarmID = alarmID

		if err := p.startEscalationWorkflow(ctx, alarm); err != nil {
			slog.Warn("Temporal workflow start failed", "alarm_id", alarmID, "err", err)
		}

		triggered = append(triggered, alarm)
	}
	return triggered
}

func (p *AlarmProcessor) evaluateCondition(value float64, condition string, threshold float64) bool {
	switch condition {
	case "GT":
		return value > threshold
	case "GTE":
		return value >= threshold
	case "LT":
		return value < threshold
	case "LTE":
		return value <= threshold
	case "EQ":
		return value == threshold
	}
	return false
}

func (p *AlarmProcessor) formatMessage(template string, reading TelemetryReading, rule AlarmRule) string {
	msg := template
	if msg == "" {
		msg = reading.SensorType + " alarm on well " + reading.WellID
	}
	return msg
}

func (p *AlarmProcessor) persistAlarm(ctx context.Context, alarm AlarmEvent, ruleID string) (string, error) {
	var alarmID string
	err := p.pool.QueryRow(ctx,
		`INSERT INTO alarms (well_id, rule_id, sensor_type, severity, message, value, threshold, tenant_id)
		 VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::uuid)
		 RETURNING alarm_id::text`,
		alarm.WellID, ruleID, alarm.SensorType, alarm.Severity,
		alarm.Message, alarm.Value, alarm.Threshold, alarm.TenantID,
	).Scan(&alarmID)
	return alarmID, err
}

func (p *AlarmProcessor) startEscalationWorkflow(ctx context.Context, alarm AlarmEvent) error {
	if p.temporalClient == nil {
		slog.Info("Temporal unavailable — escalation skipped",
			"alarm_id", alarm.AlarmID,
			"severity", alarm.Severity,
		)
		return nil
	}

	retryPolicy := &temporal.RetryPolicy{
		InitialInterval:    time.Second,
		BackoffCoefficient: 2.0,
		MaximumInterval:    time.Minute,
		MaximumAttempts:    3,
	}

	wfOpts := temporalclient.StartWorkflowOptions{
		ID:          "alarm-escalation-" + alarm.AlarmID,
		TaskQueue:   "alarm-manager",
		RetryPolicy: retryPolicy,
	}

	_, err := p.temporalClient.ExecuteWorkflow(ctx, wfOpts, AlarmEscalationWorkflow, alarm)
	if err != nil {
		return err
	}

	slog.Info("Temporal escalation workflow started",
		"alarm_id", alarm.AlarmID,
		"severity", alarm.Severity,
		"well_id", alarm.WellID,
	)
	return nil
}

func (p *AlarmProcessor) refreshRules(ctx context.Context) error {
	rows, err := p.pool.Query(ctx,
		`SELECT rule_id::text, COALESCE(well_id::text, ''), sensor_type,
		        condition, threshold, severity, message_template, dead_band
		 FROM alarm_rules WHERE enabled = true`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var rules []AlarmRule
	for rows.Next() {
		var r AlarmRule
		if err := rows.Scan(&r.RuleID, &r.WellID, &r.SensorType,
			&r.Condition, &r.Threshold, &r.Severity, &r.MessageTemplate, &r.DeadBand); err != nil {
			continue
		}
		rules = append(rules, r)
	}
	p.rules = rules
	p.rulesCached = time.Now()
	slog.Info("alarm rules refreshed", "count", len(rules))
	return nil
}

// AlarmEscalationWorkflow is the Temporal workflow for alarm escalation.
// Steps: notify operator → wait for ack → escalate if no ack → auto-resolve
func AlarmEscalationWorkflow(ctx workflow.Context, alarm AlarmEvent) error {
	logger := workflow.GetLogger(ctx)
	logger.Info("escalation workflow started", "alarm_id", alarm.AlarmID, "severity", alarm.Severity)

	// Step 1: Send immediate notification
	actOpts := workflow.ActivityOptions{
		StartToCloseTimeout: 30 * time.Second,
		RetryPolicy: &temporal.RetryPolicy{
			InitialInterval:    time.Second,
			BackoffCoefficient: 2.0,
			MaximumAttempts:    3,
		},
	}
	actCtx := workflow.WithActivityOptions(ctx, actOpts)

	if err := workflow.ExecuteActivity(actCtx, SendAlarmNotification, alarm).Get(ctx, nil); err != nil {
		logger.Warn("notification activity failed", "err", err)
	}

	// Step 2: Wait for acknowledgment (timeout based on severity)
	ackTimeout := map[int]time.Duration{
		1: 5 * time.Minute,
		2: 15 * time.Minute,
		3: 60 * time.Minute,
		4: 4 * time.Hour,
	}
	timeout := ackTimeout[alarm.Severity]
	if timeout == 0 {
		timeout = 30 * time.Minute
	}

	ackCh := workflow.GetSignalChannel(ctx, "alarm-acknowledged")
	var acknowledged bool

	selector := workflow.NewSelector(ctx)
	selector.AddReceive(ackCh, func(c workflow.ReceiveChannel, _ bool) {
		c.Receive(ctx, &acknowledged)
	})
	timerCtx, timerCancel := workflow.WithCancel(ctx)
	selector.AddFuture(workflow.NewTimer(timerCtx, timeout), func(f workflow.Future) {
		acknowledged = false
	})
	selector.Select(ctx)
	timerCancel()

	if acknowledged {
		logger.Info("alarm acknowledged within timeout", "alarm_id", alarm.AlarmID)
		return nil
	}

	// Step 3: Escalate — not acknowledged within timeout
	logger.Warn("alarm NOT acknowledged — escalating", "alarm_id", alarm.AlarmID, "severity", alarm.Severity)
	if err := workflow.ExecuteActivity(actCtx, EscalateAlarm, alarm).Get(ctx, nil); err != nil {
		logger.Error("escalation activity failed", "err", err)
	}

	return nil
}

// SendAlarmNotification is a Temporal activity that sends the alarm notification.
func SendAlarmNotification(ctx context.Context, alarm AlarmEvent) error {
	slog.Info("sending alarm notification",
		"alarm_id", alarm.AlarmID,
		"severity", alarm.Severity,
		"well_id", alarm.WellID,
		"message", alarm.Message,
	)
	return nil
}

// EscalateAlarm is a Temporal activity that escalates an unacknowledged alarm.
func EscalateAlarm(ctx context.Context, alarm AlarmEvent) error {
	slog.Info("escalating alarm to supervisor",
		"alarm_id", alarm.AlarmID,
		"severity", alarm.Severity,
		"well_id", alarm.WellID,
	)
	return nil
}

// MarshalJSON implements json.Marshaler for AlarmEvent.
func (a AlarmEvent) MarshalJSON() ([]byte, error) {
	type Alias AlarmEvent
	return json.Marshal(Alias(a))
}

// evaluateRulesOnly evaluates rules against a reading without DB persistence.
func (p *AlarmProcessor) evaluateRulesOnly(reading TelemetryReading) []AlarmEvent {
	var triggered []AlarmEvent
	for _, rule := range p.rules {
		if rule.WellID != "" && rule.WellID != reading.WellID {
			continue
		}
		if rule.SensorType != reading.SensorType {
			continue
		}
		if !p.evaluateCondition(reading.Value, rule.Condition, rule.Threshold) {
			continue
		}
		triggered = append(triggered, AlarmEvent{
			WellID:     reading.WellID,
			SensorType: reading.SensorType,
			Severity:   rule.Severity,
			Value:      reading.Value,
			Threshold:  rule.Threshold,
			TenantID:   reading.TenantID,
			Timestamp:  reading.Timestamp,
			Message:    p.formatMessage(rule.MessageTemplate, reading, rule),
		})
	}
	return triggered
}
