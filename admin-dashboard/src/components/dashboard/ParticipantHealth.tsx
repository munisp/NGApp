import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../common/Card';
import { Badge, StatusDot } from '../common/Badge';
import { cn, formatNumber } from '@/lib/utils';
import type { ParticipantHealth as ParticipantHealthType } from '@/types';

interface ParticipantHealthGridProps {
  participants: ParticipantHealthType[];
  onParticipantClick?: (fspId: string) => void;
}

export function ParticipantHealthGrid({
  participants,
  onParticipantClick,
}: ParticipantHealthGridProps) {
  const getHealthStatus = (p: ParticipantHealthType): 'healthy' | 'degraded' | 'down' => {
    if (p.status === 'DOWN') return 'down';
    if (p.status === 'DEGRADED') return 'degraded';
    return 'healthy';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Participant Health</CardTitle>
        <div className="flex items-center space-x-4 text-sm">
          <div className="flex items-center">
            <StatusDot status="healthy" className="mr-2" />
            <span className="text-gray-600">Healthy</span>
          </div>
          <div className="flex items-center">
            <StatusDot status="degraded" className="mr-2" />
            <span className="text-gray-600">Degraded</span>
          </div>
          <div className="flex items-center">
            <StatusDot status="down" className="mr-2" />
            <span className="text-gray-600">Down</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {participants.map((participant) => (
            <ParticipantHealthCard
              key={participant.fspId}
              participant={participant}
              status={getHealthStatus(participant)}
              onClick={() => onParticipantClick?.(participant.fspId)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface ParticipantHealthCardProps {
  participant: ParticipantHealthType;
  status: 'healthy' | 'degraded' | 'down';
  onClick?: () => void;
}

function ParticipantHealthCard({
  participant,
  status,
  onClick,
}: ParticipantHealthCardProps) {
  const statusColors = {
    healthy: 'border-green-200 bg-green-50',
    degraded: 'border-yellow-200 bg-yellow-50',
    down: 'border-red-200 bg-red-50',
  };

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-3 cursor-pointer transition-all hover:shadow-md',
        statusColors[status]
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-gray-900 text-sm truncate">
          {participant.name}
        </span>
        <StatusDot status={status} />
      </div>
      <div className="space-y-1 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>TPS:</span>
          <span className="font-medium">{participant.tps.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span>Success:</span>
          <span className="font-medium">{participant.successRate.toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Latency:</span>
          <span className="font-medium">{participant.avgLatencyMs}ms</span>
        </div>
      </div>
    </div>
  );
}

interface ParticipantHealthTableProps {
  participants: ParticipantHealthType[];
  onParticipantClick?: (fspId: string) => void;
}

export function ParticipantHealthTable({
  participants,
  onParticipantClick,
}: ParticipantHealthTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Participant Status</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Participant
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  TPS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg Latency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Error Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {participants.map((participant) => (
                <tr
                  key={participant.fspId}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onParticipantClick?.(participant.fspId)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <StatusDot
                        status={
                          participant.status === 'HEALTHY'
                            ? 'healthy'
                            : participant.status === 'DEGRADED'
                            ? 'degraded'
                            : 'down'
                        }
                        className="mr-3"
                      />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {participant.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {participant.fspId}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge status={participant.status}>{participant.status}</Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {participant.tps.toFixed(1)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className={cn(
                            'h-2 rounded-full',
                            participant.successRate >= 99
                              ? 'bg-green-500'
                              : participant.successRate >= 95
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          )}
                          style={{ width: `${participant.successRate}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">
                        {participant.successRate.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {participant.avgLatencyMs}ms
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={cn(
                        'text-sm font-medium',
                        participant.errorRate < 1
                          ? 'text-green-600'
                          : participant.errorRate < 5
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      )}
                    >
                      {participant.errorRate.toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
