{{/*
Expand the name of the chart.
*/}}
{{- define "escrow-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "escrow-platform.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "escrow-platform.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "escrow-platform.labels" -}}
helm.sh/chart: {{ include "escrow-platform.chart" . }}
{{ include "escrow-platform.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "escrow-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "escrow-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "escrow-platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "escrow-platform.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL host
*/}}
{{- define "escrow-platform.postgresql.host" -}}
{{- if .Values.postgresql.enabled }}
{{- printf "%s-postgresql" (include "escrow-platform.fullname" .) }}
{{- else }}
{{- .Values.externalPostgresql.host }}
{{- end }}
{{- end }}

{{/*
Redis host
*/}}
{{- define "escrow-platform.redis.host" -}}
{{- if .Values.redis.enabled }}
{{- printf "%s-redis-master" (include "escrow-platform.fullname" .) }}
{{- else }}
{{- .Values.externalRedis.host }}
{{- end }}
{{- end }}

{{/*
Kafka bootstrap servers
*/}}
{{- define "escrow-platform.kafka.bootstrapServers" -}}
{{- if .Values.kafka.enabled }}
{{- printf "%s-kafka:9092" (include "escrow-platform.fullname" .) }}
{{- else }}
{{- .Values.externalKafka.bootstrapServers }}
{{- end }}
{{- end }}

{{/*
TigerBeetle addresses
*/}}
{{- define "escrow-platform.tigerbeetle.addresses" -}}
{{- if .Values.tigerbeetle.enabled }}
{{- printf "%s-tigerbeetle:3000" (include "escrow-platform.fullname" .) }}
{{- else }}
{{- .Values.externalTigerbeetle.addresses }}
{{- end }}
{{- end }}
