/**
 * Illuszionz Media — booking -> Google Calendar sync (Google Apps Script)
 * Paste this whole file into a new Apps Script project (see supabase/CALENDAR_SYNC.md).
 *
 * Every time a booking is created, edited or deleted, Supabase calls this script (calendar-sync.sql).
 * - new / confirmed / completed bookings with a date  -> an event on your calendar
 * - cancelled or deleted bookings, or a date removed   -> the event is removed
 * - moving the date or time in the dashboard           -> the event moves
 */

// ---------- Settings you may want to change ----------
var CALENDAR_ID = 'primary';   // 'primary' = your main calendar, or paste another calendar's ID (Calendar settings -> Integrate calendar)
var DEFAULT_HOURS = 2;         // length of an event when the booking has a start time
var SHOW_NEW_AS_TENTATIVE = true; // unconfirmed ("new") bookings get a "? " prefix and a yellow colour
var REMINDER_MINUTES = [24 * 60, 60]; // pop-up reminders: 1 day and 1 hour before. Use [] for none.
var DASHBOARD_URL = 'https://illuszionzmedia.com/dashboard/#/bookings';
// ------------------------------------------------------

var COLORS = { new: CalendarApp.EventColor.YELLOW, confirmed: CalendarApp.EventColor.GREEN, completed: CalendarApp.EventColor.GRAY };

/** Supabase posts here. The ?key=... in the URL must match the SECRET you saved in Project Settings -> Script properties. */
function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  if (!e || !e.parameter || e.parameter.key !== props.getProperty('SECRET')) return reply({ ok: false, error: 'bad key' });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000); // several bookings arriving together are handled one at a time
  try {
    var p = JSON.parse(e.postData.contents);
    if (p.table !== 'bookings') return reply({ ok: true, skipped: 'not a booking' });
    if (p.type === 'DELETE') removeEvent(p.old_record && p.old_record.id);
    else syncBooking(p.record);
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Open the web app URL in a browser to check it is live: it should say "Booking calendar sync is running". */
function doGet() {
  return ContentService.createTextOutput('Booking calendar sync is running');
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function calendar() {
  var c = CALENDAR_ID === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(CALENDAR_ID);
  if (!c) throw new Error('Calendar not found: ' + CALENDAR_ID);
  return c;
}

function key(id) { return 'bk_' + id; }

function removeEvent(id) {
  if (!id) return;
  var props = PropertiesService.getScriptProperties();
  var evId = props.getProperty(key(id));
  if (!evId) return;
  try { var ev = calendar().getEventById(evId); if (ev) ev.deleteEvent(); } catch (err) { /* already gone */ }
  props.deleteProperty(key(id));
}

/** "14:30" or "2:30 pm" -> [14, 30]; anything else -> null (the booking becomes an all-day event). */
function parseTime(t) {
  var m = String(t || '').trim().toLowerCase().match(/^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/);
  if (!m) return null;
  var h = Number(m[1]), min = Number(m[2] || 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  return h > 23 || min > 59 ? null : [h, min];
}

function lookup(details, words) {
  var rows = details || [];
  for (var i = 0; i < rows.length; i++) {
    var label = String(rows[i][0] || '').toLowerCase();
    for (var j = 0; j < words.length; j++) if (label.indexOf(words[j]) >= 0 && rows[i][1]) return String(rows[i][1]);
  }
  return '';
}

function syncBooking(b) {
  if (!b || !b.id) return;
  var props = PropertiesService.getScriptProperties();
  if (b.status === 'cancelled' || !b.event_date) return removeEvent(b.id);

  var ymd = String(b.event_date).split('-').map(Number); // the script time zone must be Europe/London (see the guide)
  var time = parseTime(b.event_time);
  var title = (b.status === 'new' && SHOW_NEW_AS_TENTATIVE ? '? ' : b.status === 'completed' ? '✓ ' : '') + b.kind.replace(/ booking$/i, '') + ' — ' + b.name;
  var money = b.total ? '£' + Number(b.total).toFixed(0) + (Number(b.amount_paid) ? ' (paid £' + Number(b.amount_paid).toFixed(0) + ')' : ' (unpaid)') : 'Quote to follow';
  var lines = ['Ref: ' + b.ref + '   Status: ' + b.status, 'Client: ' + b.name + (b.phone ? ' · ' + b.phone : '') + (b.email ? ' · ' + b.email : '')];
  if (b.packages) lines.push('Package: ' + b.packages);
  lines.push('Price: ' + money + (b.payment_status ? ' · ' + b.payment_status : ''), '');
  (b.details || []).forEach(function (r) { if (r && r[1]) lines.push(r[0] + ': ' + r[1]); });
  if (b.notes) lines.push('', 'Notes: ' + b.notes);
  lines.push('', 'Open in dashboard: ' + DASHBOARD_URL);
  var opts = { description: lines.join('\n') };
  var where = lookup(b.details, ['location', 'venue', 'address', 'where']);
  if (where) opts.location = where;

  var cal = calendar();
  var evId = props.getProperty(key(b.id));
  var ev = null;
  if (evId) { try { ev = cal.getEventById(evId); } catch (err) { ev = null; } }

  // moving between a timed and an all-day event means starting again
  var wantAllDay = !time;
  if (ev && ev.isAllDayEvent() !== wantAllDay) { ev.deleteEvent(); ev = null; }

  if (wantAllDay) {
    var day = new Date(ymd[0], ymd[1] - 1, ymd[2]);
    if (ev) ev.setAllDayDate(day).setTitle(title); else ev = cal.createAllDayEvent(title, day, opts);
  } else {
    var start = new Date(ymd[0], ymd[1] - 1, ymd[2], time[0], time[1]);
    var end = new Date(start.getTime() + DEFAULT_HOURS * 3600 * 1000);
    if (ev) ev.setTime(start, end).setTitle(title); else ev = cal.createEvent(title, start, end, opts);
  }
  ev.setDescription(opts.description);
  if (opts.location) ev.setLocation(opts.location);
  if (COLORS[b.status]) ev.setColor(COLORS[b.status]);
  if (!evId) { ev.removeAllReminders(); REMINDER_MINUTES.forEach(function (m) { ev.addPopupReminder(m); }); }
  props.setProperty(key(b.id), ev.getId());
}

/** Run this once from the editor (Run button) to test: it adds a sample event 3 days from now, then removes it. */
function testSync() {
  var d = new Date(Date.now() + 3 * 86400000);
  var iso = Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var b = { id: 'test-' + Date.now(), ref: 'TEST01', kind: 'Portrait booking', name: 'Test Client', email: 't@example.com', phone: '07000 000000', packages: 'Signature', total: 250, amount_paid: 0, payment_status: 'Not Paid', event_date: iso, event_time: '14:00', status: 'confirmed', details: [['Location', 'Studio']], notes: '' };
  syncBooking(b);
  Logger.log('Created a test event for ' + iso + ' at 14:00 — check your calendar, then it is removed in 20 seconds.');
  Utilities.sleep(20000);
  removeEvent(b.id);
  Logger.log('Test event removed. Setup is good.');
}
