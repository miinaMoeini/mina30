/* Birthday Invitation — zero-dependency, GitHub Pages–friendly application. */
(() => {
  'use strict';

  const publicConfig = window.BIRTHDAY_CONFIG;
  // Party details stay out of this public site. They arrive from the private script once the invite code checks out.
  let config = publicConfig;
  const CODE_KEY = 'birthday-invite-code';
  const $ = (id) => document.getElementById(id);
  const screenIds = ['welcome', 'reveal', 'details', 'rsvp', 'final'];
  const stepTitles = ['Welcome', 'The Reveal', 'The Details', 'RSVP', 'Finale'];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const state = { step: 0, busy: false, attendance: '', attendee: '', mode: 'demo', submitted: false, unlocked: false, code: '' };
  let countdownInterval = null;
  let confettiFrame = null;

  function announce(message) { $('srAnnounce').textContent = message; }
  function setText(id, value) { $(id).textContent = String(value ?? ''); }
  function cleanString(value, maxLength = 80) { return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength); }
  function safeUrl(value) {
    try { const u = new URL(value, window.location.href); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
    catch { return null; }
  }
  function showFatal(message) {
    // Replaces the placeholder markup so guests never see sample party details.
    const notice = document.createElement('p');
    notice.className = 'section-intro';
    notice.setAttribute('role', 'alert');
    notice.style.cssText = 'text-align:center;padding:64px 0';
    notice.textContent = message;
    $('mainContent').replaceChildren(notice);
    $('backButton').hidden = true;
  }
  function applyDetails(details) {
    config = { ...publicConfig, ...details };
    const eventDate = new Date(config.dateTime);
    if (!Number.isFinite(eventDate.getTime()) || !/(Z|[+-]\d{2}:\d{2})$/.test(String(config.dateTime))) { showFatal('This invitation could not load. (Host: dateTime needs a valid date with a UTC offset.)'); return false; }
    const params = new URLSearchParams(window.location.search);
    const namedGuest = cleanString(params.get('guest'), 80);
    const localeSettings = { timeZone: config.timeZone || 'UTC' };
    try {
      setText('eventDate', new Intl.DateTimeFormat('en-US', { ...localeSettings, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }).format(eventDate));
      setText('eventTime', new Intl.DateTimeFormat('en-US', { ...localeSettings, hour: 'numeric', minute: '2-digit', hour12: true }).format(eventDate));
    } catch {
      setText('eventDate', eventDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
      setText('eventTime', eventDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }));
    }
    setText('revealName', cleanString(config.name, 80).toUpperCase());
    setText('eventName', cleanString(config.name, 80));
    setText('revealAge', config.age ?? '');
    const hasPhoto = /^data:image\//.test(String(config.photo || ''));
    if (hasPhoto) { $('childPhoto').src = config.photo; $('childPhoto').alt = config.photoAlt || ''; }
    $('photoFrame').hidden = !hasPhoto;
    $('revealArt').classList.toggle('has-photo', hasPhoto);
    $('cakeAge').textContent = config.ageInWords || '';
    setText('eventTitle', config.eventTitle);
    setText('detailsIntro', config.subtitle || 'Here’s everything you need to know.');
    setText('eventVenue', config.venue);
    setText('eventAddress', config.address);
    setText('eventDress', config.dressCode);
    setText('eventTheme', config.theme);
    setText('personalMessage', config.personalMessage);
    setText('guestWelcome', namedGuest ? `${namedGuest}, your name is on the list.` : 'You are cordially invited.');
    if (namedGuest) $('guestName').value = namedGuest;
    $('mapsButton').href = safeUrl(config.mapsUrl) || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address || config.venue || '')}`;
    $('plusOneControl').hidden = !config.allowPlusOne;
    document.title = `You're Invited · ${cleanString(config.name)}'s Birthday`;
    $('googleCalendarLink').href = googleCalendarUrl();
    startCountdown(eventDate);
    state.unlocked = true;
    return true;
  }
  function readStoredCode() { try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; } }
  function storeCode(code) { try { if (code) localStorage.setItem(CODE_KEY, code); else localStorage.removeItem(CODE_KEY); } catch { /* Private browsing: the code just isn't remembered. */ } }
  function setUnlockLoading(loading) {
    $('unlockButton').disabled = loading;
    $('unlockSpinner').hidden = !loading;
    setText('unlockText', loading ? 'One moment…' : 'Unlock Your Invitation 🎁');
  }
  function showCodeForm(message) {
    $('unlockButton').hidden = true;
    $('codeForm').hidden = false;
    $('codeError').hidden = !message;
    setText('codeError', message || '');
  }
  async function loadDetails(code) {
    $('codeError').hidden = true;
    $('codeSubmit').disabled = true;
    $('codeSpinner').hidden = false;
    try {
      const response = await callScript({ action: 'details', code });
      if (response?.ok === true && response.details) {
        if (!applyDetails(response.details)) return;
        state.code = code;
        storeCode(code);
        $('codeForm').hidden = true;
        $('unlockButton').hidden = false;
        setUnlockLoading(false);
        return;
      }
      storeCode('');
      showCodeForm(code ? 'That code didn’t work. Please check your invitation link.' : '');
    } catch {
      $('inviteCode').value = code;
      showCodeForm('We couldn’t open your invitation. Check your connection and try again.');
    } finally {
      $('codeSubmit').disabled = false;
      $('codeSpinner').hidden = true;
    }
  }

  function showScreen(index, { fromHistory = false } = {}) {
    if (index < 0 || index >= screenIds.length || state.busy) return;
    if (index > 0 && !state.unlocked) return;
    if (index === 4 && !state.submitted) return;
    const movingForward = index > state.step;
    state.step = index;
    // History entries make the phone's back gesture step through screens instead of leaving the invitation.
    if (!fromHistory) history.pushState({ step: index }, '', `${location.pathname}${location.search}#${screenIds[index]}`);
    if (index === 0) { $('unlockButton').disabled = false; $('envelopeScene').classList.remove('is-opening'); }
    screenIds.forEach((id, n) => { $('screen-' + id).hidden = n !== index; });
    setText('progressLabel', `${String(index + 1).padStart(2, '0')} `);
    // DOM nodes are used here (rather than HTML strings) so no user data is interpreted as markup.
    const muted = document.createElement('span');
    muted.className = 'progress-muted';
    muted.textContent = '/ 05';
    $('progressLabel').appendChild(muted);
    setText('progressTitle', stepTitles[index]);
    $('progressFill').style.width = `${(index + 1) * 20}%`;
    $('backButton').hidden = index === 0 || index === 4;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const title = $('screen-' + screenIds[index]).querySelector('h1');
    if (title) { title.tabIndex = -1; title.focus({ preventScroll: true }); }
    announce(`Step ${index + 1} of 5: ${stepTitles[index].toLowerCase()}`);
    if (movingForward && (index === 1 || index === 4)) burstConfetti(index === 4 ? 170 : 140);
  }

  function startCountdown(date) {
    const target = date.getTime();
    function update() {
      const difference = target - Date.now();
      if (difference <= 0) {
        ['days', 'hours', 'minutes', 'seconds'].forEach((id) => setText(id, '00'));
        setText('countdownStatus', 'The celebration has begun! ✨');
        if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
        return;
      }
      const secs = Math.floor(difference / 1000);
      setText('days', String(Math.floor(secs / 86400)).padStart(2, '0'));
      setText('hours', String(Math.floor(secs % 86400 / 3600)).padStart(2, '0'));
      setText('minutes', String(Math.floor(secs % 3600 / 60)).padStart(2, '0'));
      setText('seconds', String(secs % 60).padStart(2, '0'));
    }
    update();
    if (target > Date.now()) countdownInterval = setInterval(update, 1000);
  }

  /* Confetti is canvas-based, decorative, and disabled for reduced-motion users. */
  function burstConfetti(count) {
    if (reducedMotion.matches) return;
    const canvas = $('confettiCanvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (confettiFrame) cancelAnimationFrame(confettiFrame);
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth; const h = window.innerHeight;
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const palette = ['#dcceb3', '#e7dfd9', '#cbc3bf', '#958578', '#635d56'];
    const pieces = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: -30 - Math.random() * h * 0.65,
      dx: (Math.random() - .5) * 2.5, dy: 1.4 + Math.random() * 3.7,
      width: 3 + Math.random() * 4, height: 6 + Math.random() * 9,
      angle: Math.random() * Math.PI * 2, turn: (Math.random() - .5) * .09,
      color: palette[Math.floor(Math.random() * palette.length)], opacity: .6 + Math.random() * .4
    }));
    const start = performance.now();
    function draw(now) {
      ctx.clearRect(0, 0, w, h);
      const elapsed = now - start;
      const fade = Math.min(1, Math.max(0, (5200 - elapsed) / 900));
      for (const p of pieces) {
        p.x += p.dx + Math.sin(elapsed / 400 + p.angle) * .3;
        p.y += p.dy; p.angle += p.turn;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
        ctx.scale(1, Math.cos(elapsed / 170 + p.angle * 3)); // Foil pieces flip as they fall.
        ctx.globalAlpha = p.opacity * fade; ctx.fillStyle = p.color;
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height); ctx.restore();
      }
      if (elapsed < 5200) confettiFrame = requestAnimationFrame(draw);
      else { ctx.clearRect(0, 0, w, h); confettiFrame = null; }
    }
    confettiFrame = requestAnimationFrame(draw);
  }

  /* "Happy Birthday" (public domain) as a soft synthesized music box; no audio files, subscriptions, or autoplay. */
  const music = { ctx: null, timer: null, note: 0, on: false };
  const BEAT_MS = 520;
  const melody = [[392, .75], [392, .25], [440, 1], [392, 1], [523.25, 1], [493.88, 2],
                  [392, .75], [392, .25], [440, 1], [392, 1], [587.33, 1], [523.25, 2],
                  [392, .75], [392, .25], [783.99, 1], [659.25, 1], [523.25, 1], [493.88, 1], [440, 1],
                  [698.46, .75], [698.46, .25], [659.25, 1], [523.25, 1], [587.33, 1], [523.25, 3]];
  function playNote() {
    if (!music.ctx || !music.on) return;
    const [frequency, beats] = melody[music.note % melody.length];
    const t = music.ctx.currentTime;
    const osc = music.ctx.createOscillator();
    const gain = music.ctx.createGain();
    osc.type = 'triangle'; osc.frequency.setValueAtTime(frequency, t);
    gain.gain.setValueAtTime(.0001, t);
    gain.gain.exponentialRampToValueAtTime(.07, t + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, t + 1.1);
    osc.connect(gain); gain.connect(music.ctx.destination);
    osc.start(t); osc.stop(t + 1.15);
    music.note++;
    // Rest for a bar before the melody repeats.
    const rest = music.note % melody.length === 0 ? 3 : 0;
    music.timer = setTimeout(playNote, (beats + rest) * BEAT_MS);
  }
  async function toggleMusic() {
    const btn = $('musicToggle');
    try {
      if (music.on) {
        music.on = false; clearTimeout(music.timer); music.timer = null;
        if (music.ctx) await music.ctx.suspend();
      } else {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) throw new Error('Audio is not supported by this browser.');
        if (!music.ctx) music.ctx = new AudioContextClass();
        await music.ctx.resume(); music.on = true;
        playNote();
      }
      btn.setAttribute('aria-pressed', String(music.on));
      btn.setAttribute('aria-label', music.on ? 'Mute background music' : 'Play background music');
      btn.title = music.on ? 'Mute music' : 'Play background music';
      announce(music.on ? 'Background music on.' : 'Background music muted.');
    } catch { btn.setAttribute('aria-label', 'Background music unavailable'); announce('Music is unavailable on this device.'); }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && music.on) { clearTimeout(music.timer); music.timer = null; music.ctx?.suspend(); }
    if (!document.hidden && music.on && music.ctx) { music.ctx.resume().then(() => { if (music.on) { clearTimeout(music.timer); playNote(); } }).catch(() => {}); }
  });

  function showFormError(message) { setText('formError', message); $('formError').hidden = false; announce(message); }
  function setSubmitting(submitting) {
    state.busy = submitting;
    $('submitButton').disabled = submitting;
    $('submitSpinner').hidden = !submitting;
    setText('submitText', submitting ? 'Sending…' : 'Send Reply');
  }
  function makeSubmissionId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  function savePreview(reply) {
    // This is a functional, explicitly labeled local preview, not a real multi-guest RSVP service.
    const key = 'birthday-preview-rsvps';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(existing)) throw new Error('Preview storage is unavailable.');
    existing.push({ ...reply, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(existing));
    return { ok: true };
  }
  function callScript(params) {
    // JSONP works from GitHub Pages without CORS. The Apps Script only answers AFTER appendRow succeeds.
    // Privacy note: guest fields travel in the URL. Use minimal fields and HTTPS.
    return new Promise((resolve, reject) => {
      const callbackName = `birthdayRSVP_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      const url = new URL(config.rsvpEndpoint);
      for (const [key, value] of Object.entries({ ...params, callback: callbackName })) url.searchParams.set(key, String(value));
      const script = document.createElement('script');
      script.async = true;
      script.referrerPolicy = 'no-referrer';
      let settled = false;
      let timeout;
      function cleanup() { clearTimeout(timeout); script.remove(); delete window[callbackName]; }
      window[callbackName] = (response) => {
        if (settled) return;
        settled = true; cleanup();
        resolve(response);
      };
      script.onerror = () => { if (settled) return; settled = true; cleanup(); reject(new Error('Could not reach the RSVP service. Check your connection.')); };
      timeout = setTimeout(() => { if (settled) return; settled = true; cleanup(); reject(new Error('The RSVP service timed out. Please try again.')); }, 16000);
      script.src = url.href;
      document.head.appendChild(script);
    });
  }
  async function handleRsvp(event) {
    event.preventDefault();
    if (state.busy) return;
    $('formError').hidden = true;
    const guestName = cleanString($('guestName').value, 80);
    const choice = document.querySelector('input[name="attendance"]:checked');
    if (!guestName) { showFormError('Please enter your name.'); $('guestName').focus(); return; }
    if (!choice) { showFormError('Please select whether you can attend.'); return; }
    if ($('website').value) { showFormError('We could not verify this submission.'); return; }
    const reply = {
      code: state.code,
      guestName, attendance: choice.value,
      plusOne: choice.value === 'yes' && config.allowPlusOne && $('plusOne').checked ? 'yes' : 'no'
    };
    // Retrying the same answers reuses the ID, so a timed-out request that did save isn't recorded twice.
    const answers = JSON.stringify(reply);
    if (state.lastAnswers !== answers) { state.lastAnswers = answers; state.submissionId = makeSubmissionId(); }
    reply.submissionId = state.submissionId;
    setSubmitting(true);
    try {
      const result = state.mode === 'live' ? await callScript(reply) : savePreview(reply);
      if (result?.ok !== true) throw new Error(result?.message || 'The guest list could not save your response.');
      state.attendee = guestName; state.attendance = choice.value; state.submitted = true;
      configureFinale();
      setSubmitting(false); showScreen(4);
    } catch (error) {
      setSubmitting(false);
      showFormError(`${error.message || 'Could not save your RSVP.'} Your response has not been confirmed.`);
    }
  }
  function configureFinale() {
    const coming = state.attendance === 'yes';
    setText('confirmationLabel', state.mode === 'demo' ? 'Saved to this device · Preview' : 'Reply received');
    $('finalTitle').replaceChildren();
    const firstLine = document.createTextNode(coming ? "Can't wait to" : "We'll miss you,");
    const breakLine = document.createElement('br');
    const emphasized = document.createElement('em');
    emphasized.textContent = coming ? 'celebrate with you!' : `${state.attendee}!`;
    const heart = document.createElement('span');
    heart.className = 'heart'; heart.textContent = coming ? ' ♥' : '';
    $('finalTitle').append(firstLine, breakLine, emphasized, heart);
    setText('finalPersonal', coming ? `${state.attendee}, I’m so looking forward to seeing you.` : `Thank you for letting me know, ${state.attendee}.`);
    setText('finalNote', state.mode === 'demo'
      ? 'Preview only: this RSVP is stored on your device, not sent to the host.'
      : (coming ? (config.closingMessage || 'See you there!') : 'You will be missed.'));
    $('calendarButton').hidden = !coming;
    $('googleCalendarLink').hidden = !coming;
  }
  function googleCalendarUrl() {
    const start = new Date(config.dateTime);
    const end = new Date(start.getTime() + Math.max(1, Number(config.durationMinutes) || 240) * 60000);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: config.eventTitle || `${config.name}'s Birthday`,
      dates: `${icsUtc(start)}/${icsUtc(end)}`,
      location: [config.venue, config.address].filter(Boolean).join(', '),
      details: [config.personalMessage, `Dress code: ${config.dressCode}`, `Theme: ${config.theme}`].filter(Boolean).join('\n'),
      ctz: config.timeZone || 'UTC'
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }

  function icsEscape(text) { return String(text ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
  function icsUtc(date) { return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function addToCalendar() {
    const start = new Date(config.dateTime);
    if (!Number.isFinite(start.getTime())) { announce('Unable to create a calendar event: invalid date.'); return; }
    const end = new Date(start.getTime() + Math.max(1, Number(config.durationMinutes) || 240) * 60000);
    const fields = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Birthday Invitation//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT', `UID:${icsEscape(config.eventId || 'birthday')}@birthday-invite`, `DTSTAMP:${icsUtc(new Date())}`,
      `DTSTART:${icsUtc(start)}`, `DTEND:${icsUtc(end)}`,
      `SUMMARY:${icsEscape(config.eventTitle || `${config.name}'s Birthday`)}`,
      `LOCATION:${icsEscape([config.venue, config.address].filter(Boolean).join(', '))}`,
      `DESCRIPTION:${icsEscape([config.personalMessage, `Dress code: ${config.dressCode}`, `Theme: ${config.theme}`].filter(Boolean).join('\n'))}`,
      'END:VEVENT', 'END:VCALENDAR'
    ];
    const blob = new Blob([fields.join('\r\n') + '\r\n'], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'birthday-party.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    announce('Calendar event created. Open the downloaded file to add it to your calendar.');
  }

  function init() {
    if (!publicConfig) { showFatal('This invitation could not load. Please refresh the page. (Host: check config.js for a typo.)'); return; }
    history.replaceState({ step: 0 }, '', `${location.pathname}${location.search}`);
    window.addEventListener('popstate', (event) => showScreen(event.state?.step ?? 0, { fromHistory: true }));
    $('unlockButton').addEventListener('click', () => {
      if (state.busy) return;
      state.busy = true;
      $('unlockButton').disabled = true;
      $('envelopeScene').classList.add('is-opening');
      const delay = reducedMotion.matches ? 30 : 920;
      window.setTimeout(() => { state.busy = false; showScreen(1); }, delay);
    });
    $('detailsButton').addEventListener('click', () => showScreen(2));
    $('rsvpGoButton').addEventListener('click', () => showScreen(3));
    $('backButton').addEventListener('click', () => showScreen(state.step - 1));
    document.querySelectorAll('input[name="attendance"]').forEach((input) => input.addEventListener('change', () => {
      $('plusOneControl').hidden = !config.allowPlusOne || input.value !== 'yes';
      if (input.value !== 'yes') $('plusOne').checked = false;
      $('formError').hidden = true;
    }));
    $('plusOneControl').hidden = true;
    $('rsvpForm').addEventListener('submit', handleRsvp);
    $('calendarButton').addEventListener('click', addToCalendar);
    $('musicToggle').addEventListener('click', toggleMusic);
    $('cakeButton').addEventListener('click', () => {
      if ($('cakeButton').classList.contains('is-out')) return;
      $('cakeButton').classList.add('is-out');
      setText('cakeHint', `Wish made for ${cleanString(config.name)} ✨`);
      burstConfetti(170);
    });
    $('codeForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const code = cleanString($('inviteCode').value, 40).toLowerCase();
      if (code) loadDetails(code).catch(() => {});
      else showCodeForm('Please enter your invitation code.');
    });
    // Must be absolute: an empty value means preview mode, using sample details from config.js.
    state.mode = /^https?:\/\//i.test(String(publicConfig.rsvpEndpoint || '')) ? 'live' : 'demo';
    $('rsvpModeNote').hidden = state.mode === 'live';
    setText('rsvpModeNote', 'Preview mode: responses save only in this browser. Connect Google Sheets before sharing your invitation.');
    if (state.mode === 'demo') {
      if (applyDetails(publicConfig.previewDetails)) setUnlockLoading(false);
      return;
    }
    const linkCode = cleanString(new URLSearchParams(location.search).get('code'), 40).toLowerCase();
    const code = linkCode || readStoredCode();
    if (code) loadDetails(code);
    else showCodeForm();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
