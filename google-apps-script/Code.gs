/**
 * PRIVATE PARTY DETAILS + RSVP RECEIVER FOR GOOGLE SHEETS
 * Deploy as a Google Apps Script Web App: Execute as ME; Who has access: ANYONE.
 * This public copy holds placeholders only. Put your real values in the Apps Script
 * editor and never commit them. See README.md for setup instructions.
 */

const SPREADSHEET_ID = 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'RSVPs';
const INVITE_CODE = 'PASTE_A_LONG_RANDOM_CODE_HERE'; // Lowercase. Goes in each guest's link.
const EVENT_ID = 'my-birthday';

// Optional: a 'data:image/jpeg;base64,...' string. Stays private, like the details below.
const PHOTO_DATA = '';
const ARTWORK_DATA = ''; // Optional illustration, stored the same way.

// Only sent to links with the right invite code.
const EVENT_DETAILS = {
  name: 'Your Name',
  age: 30,
  ageInWords: 'thirty', // Written on the cake.
  eventTitle: "Your Name's 30th Birthday Celebration",
  dateTime: '2030-01-01T19:00:00-07:00', // Include the UTC offset for the party's location.
  durationMinutes: 240,
  timeZone: 'America/Vancouver',
  venue: 'Street address and unit',
  address: 'City, region, postal code',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=YOUR%20ADDRESS',
  dressCode: 'Your dress code',
  subtitle: 'Thirty years in the making.',
  personalMessage: 'Your welcome message.',
  closingMessage: 'Until then.',
  photoAlt: 'Describe your photo here.',
  artworkAlt: 'Describe your illustration here.',
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  // A real calendar link for iPhones, which don't reliably open files created inside a page.
  if (p.action === 'calendar') {
    if (!isValidCode_(p.code)) return ContentService.createTextOutput('This invitation link is not valid.');
    return ContentService.createTextOutput(buildCalendar_()).setMimeType(ContentService.MimeType.ICAL);
  }
  const cb = String(p.callback || '');
  // JSONP callbacks must be valid, short JS identifiers to prevent code injection.
  if (!/^birthdayRSVP_[a-zA-Z0-9_]{8,70}$/.test(cb)) {
    return ContentService.createTextOutput('Invalid callback');
  }

  let result;
  try {
    if (!isValidCode_(p.code)) result = { ok: false, message: 'This invitation link is not valid.' };
    else if (p.action === 'details') result = { ok: true, details: Object.assign({ photo: PHOTO_DATA, artwork: ARTWORK_DATA }, EVENT_DETAILS) };
    else result = recordRsvp_(p);
  } catch (error) {
    console.error(error);
    result = { ok: false, message: 'Could not save your RSVP. Please try again.' };
  }
  // Only send a success result AFTER Sheet.appendRow has succeeded.
  return ContentService.createTextOutput(cb + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function isValidCode_(code) {
  return INVITE_CODE.indexOf('PASTE_') !== 0 && String(code || '').trim().toLowerCase() === INVITE_CODE;
}

function icsText_(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');
}

function icsTime_(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Calendar files must wrap lines at 75 bytes; a non-ASCII character is counted as 3 to stay safe.
function icsFold_(line) {
  let out = '', size = 0;
  for (const ch of line) {
    const bytes = ch.charCodeAt(0) > 127 ? 3 : 1;
    if (size + bytes > 73) { out += '\r\n '; size = 1; }
    out += ch; size += bytes;
  }
  return out;
}

function buildCalendar_() {
  const d = EVENT_DETAILS;
  const start = new Date(d.dateTime);
  const end = new Date(start.getTime() + d.durationMinutes * 60000);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Birthday Invitation//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', 'UID:' + EVENT_ID + '@birthday-invite', 'DTSTAMP:' + icsTime_(new Date()),
    'DTSTART:' + icsTime_(start), 'DTEND:' + icsTime_(end),
    'SUMMARY:' + icsText_(d.eventTitle),
    'LOCATION:' + icsText_(d.venue + ', ' + d.address),
    'DESCRIPTION:' + icsText_(d.personalMessage + '\nDress code: ' + d.dressCode),
    'END:VEVENT', 'END:VCALENDAR'].map(icsFold_).join('\r\n') + '\r\n';
}

function recordRsvp_(p) {
  const name = String(p.guestName || '').trim().replace(/\s+/g, ' ').slice(0, 80);
  const attendance = String(p.attendance || '');
  const plusOne = String(p.plusOne || '');
  const submissionId = String(p.submissionId || '').slice(0, 100);

  if (!name || !['yes', 'no'].includes(attendance) ||
      !['yes', 'no'].includes(plusOne) || !submissionId) {
    return { ok: false, message: 'Please check your RSVP fields.' };
  }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, message: 'The guest list is busy. Please try again.' };

  try {
    const cache = CacheService.getScriptCache();
    const cacheKey = 'rsvp-' + Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, submissionId)
    ).slice(0, 48);
    if (cache.get(cacheKey)) return { ok: true }; // prevent double taps/retries

    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) return { ok: false, message: 'The guest list is not configured.' };

    // Prefix formula-like text to prevent Google Sheets formula injection.
    const safeName = /^[=+\-@\t\r]/.test(name) ? "'" + name : name;
    sheet.appendRow([new Date(), EVENT_ID, safeName, attendance, attendance === 'yes' ? plusOne : 'no', submissionId]);
    SpreadsheetApp.flush();
    cache.put(cacheKey, 'saved', 21600); // 6 hours
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

// Run this once from the Apps Script editor to create/check the header row.
function setupSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Submitted At', 'Event ID', 'Guest Name', 'Attending', 'Plus One', 'Submission ID']);
    sheet.setFrozenRows(1);
  }
}
