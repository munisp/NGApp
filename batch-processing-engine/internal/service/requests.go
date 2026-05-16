package service

type CreateJobRequest struct {
	JobName     string                 `json:"job_name"`
	JobType     string                 `json:"job_type"`
	Description string                 `json:"description"`
	Schedule    string                 `json:"schedule"`
	Priority    int                    `json:"priority"`
	MaxRetries  int                    `json:"max_retries"`
	TimeoutMins int                    `json:"timeout_mins"`
	Config      map[string]interface{} `json:"config"`
	CreatedBy   string                 `json:"created_by"`
}

type BatchItemInput struct {
	ItemRef   string                 `json:"item_ref"`
	ItemType  string                 `json:"item_type"`
	InputData map[string]interface{} `json:"input_data"`
}

type CreateScheduleRequest struct {
	Name        string                 `json:"name"`
	JobType     string                 `json:"job_type"`
	CronExpr    string                 `json:"cron_expr"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
}
