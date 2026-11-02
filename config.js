/**
 * PUBLIC settings. Everything in this file can be read by anyone, so party
 * details do NOT go here. Your name, date, and address live in the private
 * Google Apps Script (see README.md) and are only sent to valid invite links.
 */
window.BIRTHDAY_CONFIG = Object.freeze({
  // Your deployed Google Apps Script /exec URL. Leave empty for local preview mode.
  rsvpEndpoint: 'https://script.google.com/macros/s/AKfycbyjkYp5sKbZHFoT4IhA0uvKa_giQgufNz2oPQktf5oXIfREc1GmTSUh3qi66t_u6RLvag/exec',
  // Made-up details, shown only in preview mode. Never put real details here.
  previewDetails: {
    name: 'Alex',
    age: 30,
    ageInWords: 'thirty',
    eventTitle: "Alex's 30th Birthday Celebration",
    dateTime: '2030-06-15T19:00:00-07:00',
    durationMinutes: 240,
    timeZone: 'America/Vancouver',
    venue: '123 Sample Street',
    address: 'Sample City',
    mapsUrl: 'https://www.google.com/maps',
    dressCode: 'Sample dress code',
    subtitle: 'Thirty years in the making.',
    personalMessage: 'This is a preview with made-up details.',
    closingMessage: 'Until then.',
  },
});
