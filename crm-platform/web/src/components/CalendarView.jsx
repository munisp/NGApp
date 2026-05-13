import { useState, useContext } from 'react';
import { Calendar, Plus, Clock, Users, MapPin, Video, ChevronLeft, ChevronRight } from 'lucide-react';
import { TenantContext } from '../contexts/TenantContext';
import { LoadingState, ErrorState, EmptyState, FallbackBadge, ExportButton } from '@/components/ui/DataStates'
import { useTranslation } from '@/lib/i18n/useTranslation'
import { useApiData } from '@/hooks/useApiData'
import { apiClient } from '@/lib/apiClient'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SEED_EVENTS = [
  { id: 'ev-001', title: 'CBN Quarterly Filing Deadline', date: '2025-05-15', time: '17:00', type: 'compliance', color: 'bg-red-500', attendees: ['Compliance Officer', 'DPO'] },
  { id: 'ev-002', title: 'Agent Network Review — Lagos', date: '2025-05-08', time: '10:00', type: 'meeting', color: 'bg-blue-500', attendees: ['Operations Manager', 'Regional Lead'], location: 'Lagos HQ' },
  { id: 'ev-003', title: 'Q2 Campaign Launch', date: '2025-05-10', time: '09:00', type: 'campaign', color: 'bg-purple-500', attendees: ['Marketing Lead'] },
  { id: 'ev-004', title: 'Monthly KYC Audit', date: '2025-05-20', time: '14:00', type: 'audit', color: 'bg-green-500', attendees: ['Compliance Team', 'External Auditor'] },
  { id: 'ev-005', title: 'Board Meeting — Budget Review', date: '2025-05-25', time: '11:00', type: 'meeting', color: 'bg-blue-500', attendees: ['CEO', 'CFO', 'CTO', 'Board Members'], location: 'Virtual' },
  { id: 'ev-006', title: 'Security Pen Test Window', date: '2025-05-12', time: '08:00', type: 'security', color: 'bg-orange-500', attendees: ['Security Team', 'Pen Testers'] },
  { id: 'ev-007', title: 'NDPR Compliance Review', date: '2025-05-28', time: '10:00', type: 'compliance', color: 'bg-red-500', attendees: ['DPO', 'Legal'] },
  { id: 'ev-008', title: 'New Agent Onboarding Training', date: '2025-05-06', time: '09:00', type: 'training', color: 'bg-teal-500', attendees: ['Training Team', '25 New Agents'] },
];

export default function CalendarView() {
  const { data: _apiData, isLoading: _apiLoading, isUsingFallback } = useApiData('calendarview', () => apiClient.dashboard.metrics(), { fallback: MONTHS })
  const { t } = useTranslation()
  const { tenantId } = useContext(TenantContext);
  const [currentDate, setCurrentDate] = useState(new Date(2025, 4, 1)); // May 2025
  const [selectedDate, setSelectedDate] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [activeView, setActiveView] = useState('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getEventsForDay = (day) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return SEED_EVENTS.filter(e => e.date === dateStr);
  };

  const selectedEvents = selectedDate ? getEventsForDay(selectedDate) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  return (
    <div role="region" aria-label="CalendarView"  className="p-6 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Calendar</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Compliance deadlines, meetings, campaigns, and training schedules</p>
          </div>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
          <Plus className="w-4 h-4" /> New Event
        </button>
      </div>

      {showCreate && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border p-4 mb-6">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Create Event</h3>
          <div className="grid grid-cols-4 gap-3">
            <input type="text" placeholder="Event title" className="px-3 py-2 border rounded-lg text-sm col-span-2" />
            <input type="date" className="px-3 py-2 border rounded-lg text-sm" />
            <input type="time" className="px-3 py-2 border rounded-lg text-sm" />
            <select className="px-3 py-2 border rounded-lg text-sm">
              <option>Meeting</option><option>Compliance</option><option>Campaign</option><option>Training</option><option>Audit</option><option>Security</option>
            </select>
            <input type="text" placeholder="Attendees (comma separated)" className="px-3 py-2 border rounded-lg text-sm col-span-2" />
            <button className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Create</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="col-span-2 bg-white dark:bg-gray-900 rounded-xl border">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <button onClick={prevMonth} className="p-1 hover:bg-gray-100 dark:bg-gray-700 rounded"><ChevronLeft className="w-5 h-5" /></button>
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{MONTHS[month]} {year}</h3>
            <button onClick={nextMonth} className="p-1 hover:bg-gray-100 dark:bg-gray-700 rounded"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-7">
            {DAYS.map(d => <div key={d} className="px-2 py-2 text-center text-xs font-medium text-gray-400 border-b">{d}</div>)}
            {days.map((day, i) => {
              const events = getEventsForDay(day);
              const isSelected = selectedDate === day;
              const isToday = day === 4 && month === 4 && year === 2025;
              return (
                <div key={i} onClick={() => day && setSelectedDate(day)}
                  className={`min-h-[80px] p-1 border-b border-r cursor-pointer transition ${day ? 'hover:bg-blue-50' : ''} ${isSelected ? 'bg-blue-50' : ''}`}>
                  {day && (
                    <>
                      <span className={`text-xs font-medium inline-block w-6 h-6 text-center leading-6 rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'}`}>{day}</span>
                      <div className="space-y-0.5 mt-0.5">
                        {events.slice(0, 2).map(evt => (
                          <div key={evt.id} className={`${evt.color} text-white text-[10px] px-1 py-0.5 rounded truncate`}>{evt.title}</div>
                        ))}
                        {events.length > 2 && <div className="text-[10px] text-gray-400">+{events.length - 2} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — Selected Day or Upcoming */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
              {selectedDate ? `${MONTHS[month]} ${selectedDate}, ${year}` : 'Upcoming Events'}
            </h3>
            {(selectedDate ? selectedEvents : SEED_EVENTS.slice(0, 5)).map(event => (
              <div key={event.id} className="flex items-start gap-2 py-2 border-b last:border-0">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${event.color}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{event.title}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="flex items-center gap-0.5"><Clock className="w-3 h-3" /> {event.time}</span>
                    {event.location && <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {event.location}</span>}
                  </div>
                  {event.attendees && (
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-0.5">
                      <Users className="w-3 h-3" /> {event.attendees.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {selectedDate && selectedEvents.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No events on this day</p>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl border p-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Event Types</h3>
            {[
              { type: 'Meeting', color: 'bg-blue-500', count: SEED_EVENTS.filter(e => e.type === 'meeting').length },
              { type: 'Compliance', color: 'bg-red-500', count: SEED_EVENTS.filter(e => e.type === 'compliance').length },
              { type: 'Campaign', color: 'bg-purple-500', count: SEED_EVENTS.filter(e => e.type === 'campaign').length },
              { type: 'Audit', color: 'bg-green-500', count: SEED_EVENTS.filter(e => e.type === 'audit').length },
              { type: 'Security', color: 'bg-orange-500', count: SEED_EVENTS.filter(e => e.type === 'security').length },
              { type: 'Training', color: 'bg-teal-500', count: SEED_EVENTS.filter(e => e.type === 'training').length },
            ].map(t => (
              <div key={t.type} className="flex items-center justify-between py-1">
                <span className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400"><span className={`w-2 h-2 rounded-full ${t.color}`} /> {t.type}</span>
                <span className="text-xs text-gray-400">{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
