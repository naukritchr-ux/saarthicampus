import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';

const PRIORITY_COLOR = { high: '#EF4444', medium: '#F59E0B', low: '#10B981' };
const EVENT_COLOR = { drive: '#7C3AED', interview: '#06B6D4', gd: '#F59E0B', meeting: '#10B981', other: '#8B90A7' };
const EVENT_LABEL = { drive: 'Campus Drive', interview: 'Interview', gd: 'Group Discussion', meeting: 'Meeting', other: 'Other' };
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function CalendarTasks() {
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('tasks');
  const [loading, setLoading] = useState(true);

  const [newTask, setNewTask] = useState('');
  const [newTaskDate, setNewTaskDate] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', type: 'drive' });

  // Search / filter state
  const [taskSearch, setTaskSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [eventSearch, setEventSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Mini calendar state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [selectedDay, setSelectedDay] = useState(null); // 'YYYY-MM-DD' or null

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    let ignore = false;
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { if (!ignore) setLoading(false); return; }

      const [{ data: t }, { data: e }] = await Promise.all([
        supabase.from('tasks').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }),
        supabase.from('calendar_events').select('*').eq('user_id', session.user.id).order('event_date', { ascending: true }),
      ]);

      if (!ignore) {
        setTasks(t || []);
        setEvents(e || []);
        setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  async function addTask() {
    if (!newTask.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('tasks').insert([{
      user_id: session.user.id,
      title: newTask.trim(),
      due_date: newTaskDate || null,
      priority: newTaskPriority,
      completed: false,
    }]).select().single();
    if (error) { alert('Could not add task: ' + error.message); return; }
    if (data) setTasks((prev) => [data, ...prev]);
    setNewTask('');
    setNewTaskDate('');
    setNewTaskPriority('medium');
  }

  async function toggleTask(id, completed) {
    await supabase.from('tasks').update({ completed: !completed }).eq('id', id);
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed: !completed } : t)));
  }

  async function deleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  async function addEvent() {
    if (!newEvent.title.trim() || !newEvent.date) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.from('calendar_events').insert([{
      user_id: session.user.id,
      title: newEvent.title.trim(),
      event_date: newEvent.date,
      event_time: newEvent.time || null,
      type: newEvent.type,
    }]).select().single();
    if (error) { alert('Could not add event: ' + error.message); return; }
    if (data) {
      setEvents((prev) => [...prev, data].sort((a, b) => new Date(a.event_date) - new Date(b.event_date)));
    }
    setNewEvent({ title: '', date: '', time: '', type: 'drive' });
  }

  async function deleteEvent(id) {
    await supabase.from('calendar_events').delete().eq('id', id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  // ---- Filtering ----
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (priorityFilter !== 'all' && (t.priority || 'medium') !== priorityFilter) return false;
      if (taskSearch.trim() && !t.title.toLowerCase().includes(taskSearch.trim().toLowerCase())) return false;
      if (selectedDay && t.due_date !== selectedDay) return false;
      return true;
    });
  }, [tasks, priorityFilter, taskSearch, selectedDay]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (typeFilter !== 'all' && e.type !== typeFilter) return false;
      if (eventSearch.trim() && !e.title.toLowerCase().includes(eventSearch.trim().toLowerCase())) return false;
      if (selectedDay && e.event_date !== selectedDay) return false;
      return true;
    });
  }, [events, typeFilter, eventSearch, selectedDay]);

  const pendingTasks = filteredTasks.filter((t) => !t.completed);
  const doneTasks = filteredTasks.filter((t) => t.completed);
  const upcomingEvents = filteredEvents.filter((e) => e.event_date >= today);
  const pastEvents = filteredEvents.filter((e) => e.event_date < today);

  const dueTodayCount = tasks.filter((t) => !t.completed && t.due_date === today).length;
  const overdueCount = tasks.filter((t) => !t.completed && t.due_date && t.due_date < today).length;

  // ---- Mini calendar helpers ----
  const markedDates = useMemo(() => {
    const map = {};
    tasks.forEach((t) => {
      if (!t.due_date) return;
      map[t.due_date] = map[t.due_date] || { task: false, event: false };
      map[t.due_date].task = true;
    });
    events.forEach((e) => {
      map[e.event_date] = map[e.event_date] || { task: false, event: false };
      map[e.event_date].event = true;
    });
    return map;
  }, [tasks, events]);

  const calendarDays = useMemo(() => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1);
    const startWeekday = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(dateStr);
    }
    return cells;
  }, [calendarMonth]);

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  function changeMonth(delta) {
    setCalendarMonth((prev) => {
      let month = prev.month + delta;
      let year = prev.year;
      if (month < 0) { month = 11; year -= 1; }
      if (month > 11) { month = 0; year += 1; }
      return { year, month };
    });
  }

  if (loading) {
    return (
      <div className="page active">
        <div className="page-head"><div><h1>Calendar & Tasks</h1></div></div>
        <div className="panel" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div className="page active">
      <div className="page-head">
        <div>
          <h1>Calendar & Tasks</h1>
          <p>{pendingTasks.length} pending tasks · {upcomingEvents.length} upcoming events</p>
        </div>
      </div>

      {(dueTodayCount > 0 || overdueCount > 0) && (
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 20,
          }}
        >
          {overdueCount > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 700 }}>
              ⚠️ {overdueCount} overdue task{overdueCount > 1 ? 's' : ''}
            </div>
          )}
          {dueTodayCount > 0 && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', color: '#92400E', borderRadius: 12, padding: '10px 16px', fontSize: 13, fontWeight: 700 }}>
              📌 {dueTodayCount} task{dueTodayCount > 1 ? 's' : ''} due today
            </div>
          )}
        </div>
      )}

      <div className="mode-toggle" style={{ marginBottom: 24 }}>
        <button className={`mode-btn ${activeTab === 'tasks' ? 'active' : ''}`} onClick={() => setActiveTab('tasks')}>📝 To-Do List</button>
        <button className={`mode-btn ${activeTab === 'calendar' ? 'active' : ''}`} onClick={() => setActiveTab('calendar')}>📅 Calendar Events</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr minmax(0,300px)', gap: 20, alignItems: 'start' }}>
        {/* Mini calendar */}
        <div className="panel" style={{ order: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }}>‹</button>
            <div style={{ fontWeight: 700, fontSize: 13.5 }}>{monthLabel}</div>
            <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted)' }}>›</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
            {WEEKDAYS.map((w, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 700, color: 'var(--text-muted)' }}>{w}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {calendarDays.map((dateStr, i) => {
              if (!dateStr) return <div key={i} />;
              const marks = markedDates[dateStr];
              const isToday = dateStr === today;
              const isSelected = dateStr === selectedDay;
              const dayNum = parseInt(dateStr.split('-')[2], 10);
              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    border: isToday ? '1.5px solid #7C3AED' : '1px solid transparent',
                    background: isSelected ? '#7C3AED' : 'transparent',
                    color: isSelected ? '#fff' : 'var(--text-primary)',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: isToday ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {dayNum}
                  {marks && (
                    <div style={{ position: 'absolute', bottom: 3, display: 'flex', gap: 2 }}>
                      {marks.task && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : '#F59E0B' }} />}
                      {marks.event && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : '#7C3AED' }} />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <button
              onClick={() => setSelectedDay(null)}
              style={{ marginTop: 12, width: '100%', background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              Clear filter ({new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
            </button>
          )}

          <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} /> Task due</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#7C3AED', display: 'inline-block' }} /> Event</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ order: 1 }}>
          {activeTab === 'tasks' && (
            <>
              <div className="panel">
                <div className="panel-title">Add New Task</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 10, marginTop: 12, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Task</label>
                    <input className="search-box" style={{ width: '100%' }} placeholder="e.g. Follow up with SVCE TPO"
                      value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTask()} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Due Date</label>
                    <input type="date" className="search-box" style={{ width: '100%' }} value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Priority</label>
                    <select className="search-box" style={{ width: '100%' }} value={newTaskPriority} onChange={(e) => setNewTaskPriority(e.target.value)}>
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </div>
                  <button className="btn-gold" onClick={addTask}>+ Add</button>
                </div>
              </div>

              <div className="panel" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Search Tasks</label>
                  <input className="search-box" style={{ width: '100%' }} placeholder="Search by title..." value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 140px' }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Priority</label>
                  <select className="search-box" style={{ width: '100%' }} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="high">🔴 High</option>
                    <option value="medium">🟡 Medium</option>
                    <option value="low">🟢 Low</option>
                  </select>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">Pending Tasks ({pendingTasks.length})</div>
                {pendingTasks.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>🎉 No pending tasks!</div>}
                {pendingTasks.map((task) => {
                  const isOverdue = task.due_date && task.due_date < today;
                  const isDueToday = task.due_date === today;
                  return (
                    <div key={task.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '13px 12px', borderBottom: '1px solid var(--border-default)',
                      background: isOverdue ? '#FEF2F2' : isDueToday ? '#FFFBEB' : 'transparent',
                      borderRadius: (isOverdue || isDueToday) ? 8 : 0,
                      marginBottom: (isOverdue || isDueToday) ? 6 : 0,
                    }}>
                      <input type="checkbox" checked={false} onChange={() => toggleTask(task.id, task.completed)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{task.title}</div>
                        {task.due_date && (
                          <div style={{ fontSize: 11.5, color: isOverdue ? '#EF4444' : isDueToday ? '#B45309' : 'var(--text-muted)', marginTop: 3, fontWeight: (isOverdue || isDueToday) ? 700 : 400 }}>
                            {isOverdue ? '⚠️ Overdue — ' : isDueToday ? '📌 Due today — ' : '📅 Due — '}
                            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, color: PRIORITY_COLOR[task.priority], background: PRIORITY_COLOR[task.priority] + '18', border: `1px solid ${PRIORITY_COLOR[task.priority]}30`, flexShrink: 0 }}>
                        {(task.priority || 'medium').toUpperCase()}
                      </span>
                      <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: 4 }}>✕</button>
                    </div>
                  );
                })}
              </div>

              {doneTasks.length > 0 && (
                <div className="panel">
                  <div className="panel-title" style={{ color: 'var(--text-muted)' }}>Completed ({doneTasks.length})</div>
                  {doneTasks.map((task) => (
                    <div key={task.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderBottom: '1px solid var(--border-default)', opacity: 0.55 }}>
                      <input type="checkbox" checked onChange={() => toggleTask(task.id, task.completed)} style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }} />
                      <div style={{ flex: 1, textDecoration: 'line-through', fontSize: 13.5, color: 'var(--text-muted)' }}>{task.title}</div>
                      <button onClick={() => deleteTask(task.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: 4 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === 'calendar' && (
            <>
              <div className="panel">
                <div className="panel-title">Schedule New Event</div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr auto', gap: 10, marginTop: 12, alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Event Title</label>
                    <input className="search-box" style={{ width: '100%' }} placeholder="e.g. SVCE Campus Drive"
                      value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addEvent()} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Date</label>
                    <input type="date" className="search-box" style={{ width: '100%' }} value={newEvent.date} onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Time</label>
                    <input type="time" className="search-box" style={{ width: '100%' }} value={newEvent.time} onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Type</label>
                    <select className="search-box" style={{ width: '100%' }} value={newEvent.type} onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value })}>
                      <option value="drive">Campus Drive</option>
                      <option value="interview">Interview</option>
                      <option value="gd">Group Discussion</option>
                      <option value="meeting">Meeting</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <button className="btn-gold" onClick={addEvent}>+ Add</button>
                </div>
              </div>

              <div className="panel" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '2 1 200px' }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Search Events</label>
                  <input className="search-box" style={{ width: '100%' }} placeholder="Search by title..." value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} />
                </div>
                <div style={{ flex: '1 1 160px' }}>
                  <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'uppercase' }}>Type</label>
                  <select className="search-box" style={{ width: '100%' }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                    <option value="all">All</option>
                    <option value="drive">Campus Drive</option>
                    <option value="interview">Interview</option>
                    <option value="gd">Group Discussion</option>
                    <option value="meeting">Meeting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">Upcoming Events ({upcomingEvents.length})</div>
                {upcomingEvents.length === 0 && <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No upcoming events scheduled</div>}
                {upcomingEvents.map((event) => (
                  <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border-default)' }}>
                    <div style={{ width: 54, height: 54, borderRadius: 12, background: EVENT_COLOR[event.type] + '15', border: `2px solid ${EVENT_COLOR[event.type]}30`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: EVENT_COLOR[event.type], lineHeight: 1 }}>{new Date(event.event_date + 'T00:00:00').getDate()}</div>
                      <div style={{ fontSize: 9, color: EVENT_COLOR[event.type], fontWeight: 700, textTransform: 'uppercase', marginTop: 1 }}>{new Date(event.event_date + 'T00:00:00').toLocaleString('default', { month: 'short' })}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{event.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                        {event.event_time && `${event.event_time} · `}
                        <span style={{ color: EVENT_COLOR[event.type], fontWeight: 600 }}>{EVENT_LABEL[event.type]}</span>
                      </div>
                    </div>
                    {event.event_date === today && (
                      <span style={{ background: '#D1FAE5', color: '#059669', fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 20, border: '1px solid #6EE7B7' }}>TODAY</span>
                    )}
                    <button onClick={() => deleteEvent(event.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: 4 }}>✕</button>
                  </div>
                ))}
              </div>

              {pastEvents.length > 0 && (
                <div className="panel">
                  <div className="panel-title" style={{ color: 'var(--text-muted)' }}>Past Events ({pastEvents.length})</div>
                  {pastEvents.map((event) => (
                    <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 0', borderBottom: '1px solid var(--border-default)', opacity: 0.5 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{event.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                          {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {event.event_time && ` · ${event.event_time}`}
                        </div>
                      </div>
                      <button onClick={() => deleteEvent(event.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: 4 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}