(function () {
  'use strict';

  var KEY = 'harbor-checkups', MAX_DAYS = 90;
  var SERVICES = [
    { id: 's1', name: 'General health check-up', mins: 30, price: 60, prep: 'Bring a list of any medicines you take.' },
    { id: 's2', name: 'Comprehensive check-up', mins: 60, price: 150, prep: 'Fast for 8 hours before your visit. Water is fine.' },
    { id: 's3', name: 'Pre-employment medical', mins: 30, price: 70, prep: 'Bring a valid ID and your employer\u2019s request form.' },
    { id: 's4', name: 'Child wellness check-up', mins: 30, price: 55, prep: 'Bring your child\u2019s vaccination record.' }
  ];
  var DOCTORS = [
    { id: 'd1', name: 'Dr. Amara Lopez', role: 'Family medicine' },
    { id: 'd2', name: 'Dr. Ken Watanabe', role: 'Internal medicine' },
    { id: 'd3', name: 'Dr. Priya Nair', role: 'Preventive care' }
  ];
  var TIMES = [];
  for (var h = 9; h < 17; h++) { TIMES.push(pad(h) + ':00', pad(h) + ':30'); } /* 30-min blocks, closes 5 pm */

  var $ = function (id) { return document.getElementById(id); };
  var dlg = new bootstrap.Modal($('dlg'));
  var state = fresh(), appts = load(), pending = null;

  /* ---------- helpers ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }
  function fresh() { return { step: 1, service: null, doctor: null, date: '', time: '' }; }
  function find(list, id) { return list.filter(function (x) { return x.id === id; })[0]; }
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return iso(new Date()); }
  function maxISO() { var d = new Date(); d.setDate(d.getDate() + MAX_DAYS); return iso(d); }
  function parse(date, time) { return new Date(date + 'T' + (time || '00:00') + ':00'); }
  function fmtDate(s) { return parse(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }); }
  function fmtTime(t) { var p = t.split(':'), h = +p[0]; return ((h + 11) % 12 + 1) + ':' + p[1] + (h < 12 ? ' am' : ' pm'); }
  function money(n) { return '$' + n; }

  /* ---------- storage: ids only, validated on load ---------- */
  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(KEY));
      if (!Array.isArray(raw)) return [];
      return raw.map(function (r) {
        var s = find(SERVICES, r.service), d = find(DOCTORS, r.doctor);
        if (!s || !d || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || TIMES.indexOf(r.time) < 0) return null;
        var a = { id: r.id, service: s, doctor: d, date: r.date, time: r.time, name: String(r.name || '') };
        return parse(a.date, a.time).getTime() + s.mins * 6e4 > Date.now() ? a : null; /* drop past visits */
      }).filter(Boolean);
    } catch (e) { return []; }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(appts.map(function (a) {
        return { id: a.id, service: a.service.id, doctor: a.doctor.id, date: a.date, time: a.time, name: a.name };
      })));
    } catch (e) { warn('warning', 'Your browser blocked saving. This booking will be lost when you close the page.'); }
  }

  /* ---------- warnings and dialogs ---------- */
  function warn(type, msg) {
    var el = document.createElement('div'), box = $('alerts');
    el.className = 'alert alert-' + type + ' alert-dismissible shadow-sm fade show';
    el.setAttribute('role', 'alert');
    var span = document.createElement('span'); span.textContent = msg;
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'btn-close'; x.setAttribute('data-bs-dismiss', 'alert'); x.setAttribute('aria-label', 'Close');
    el.appendChild(span); el.appendChild(x);
    while (box.children.length > 2) box.removeChild(box.firstChild);
    box.appendChild(el);
    setTimeout(function () { if (el.parentNode) bootstrap.Alert.getOrCreateInstance(el).close(); }, 7000);
  }
  function ask(o) {
    $('dlgTitle').textContent = o.title;
    $('dlgBody').innerHTML = o.lines.map(function (l) { return '<p class="mb-2">' + esc(l) + '</p>'; }).join('');
    var ok = $('dlgOk');
    ok.textContent = o.ok; ok.className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-brand'); ok.disabled = false;
    $('dlgCancel').textContent = o.back;
    pending = o.onOk; dlg.show();
  }
  $('dlgOk').addEventListener('click', function () { /* disabled + cleared so a double-click cannot run it twice */
    this.disabled = true; dlg.hide();
    var f = pending; pending = null; if (f) f();
  });

  /* ---------- availability (duration-aware) ---------- */
  function taken(date, i) { /* simulated "already booked" slots; replace with a real API call */
    var key = date + TIMES[i] + state.doctor.id, n = 0;
    for (var j = 0; j < key.length; j++) n = (n * 31 + key.charCodeAt(j)) % 97;
    return n % 6 === 0;
  }
  function slotReason(date, i) { /* '' means the slot is free */
    var n = state.service.mins / 30;
    if (i < 0 || i + n > TIMES.length) return 'Not enough time before closing';
    if (parse(date, TIMES[i]) <= new Date()) return 'Time has passed';
    for (var k = 0; k < n; k++) if (taken(date, i + k)) return 'Already taken';
    var clash = appts.some(function (a) {
      var s = TIMES.indexOf(a.time), e = s + a.service.mins / 30;
      return a.date === date && i < e && s < i + n;
    });
    return clash ? 'You have another appointment at this time' : '';
  }
  function checkDate() {
    var v = $('date').value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Enter a valid date to see open times.';
    if (v < todayISO()) return 'That date has passed. Choose today or a later date.';
    if (v > maxISO()) return 'We take bookings up to ' + MAX_DAYS + ' days ahead. Choose an earlier date.';
    var d = parse(v).getDay();
    return d === 0 || d === 6 ? 'The clinic is closed on weekends. Choose a weekday.' : '';
  }
  function renderSlots() {
    var msg = checkDate(), box = $('slots'), inp = $('date');
    box.innerHTML = ''; state.date = ''; state.time = '';
    inp.classList.toggle('is-invalid', !!msg && inp.value !== '');
    $('dateFb').textContent = msg;
    if (msg) {
      $('slotHint').textContent = 'Select a valid date to see open times.';
      if (inp.value) warn('warning', msg);
      return updateSummary();
    }
    state.date = inp.value;
    var open = 0;
    TIMES.forEach(function (t, i) {
      var why = slotReason(state.date, i), b = document.createElement('button');
      b.type = 'button'; b.className = 'btn btn-outline-secondary slot'; b.textContent = fmtTime(t); b.dataset.time = t;
      if (why) { b.disabled = true; b.title = why; } else open++;
      box.appendChild(b);
    });
    $('slotHint').textContent = open ? open + ' times open. Crossed-out times are unavailable.' : 'No times left on this date. Try another day.';
    if (!open) warn('info', 'No times are open for this check-up and doctor on that day. Try another date or doctor.');
    updateSummary();
  }

  /* ---------- rendering ---------- */
  function renderChoices() {
    function card(name, item, sub) {
      return '<div class="' + (name === 'service' ? 'col-sm-6' : 'col-sm-6 col-md-4') + '"><label class="choice"><input type="radio" name="' + name + '" value="' + item.id +
        '"><div class="box"><div class="fw-bold">' + esc(item.name) + '</div><div class="small text-secondary">' + sub + '</div></div></label></div>';
    }
    $('services').innerHTML = SERVICES.map(function (s) { return card('service', s, s.mins + ' min · ' + money(s.price)); }).join('');
    $('doctors').innerHTML = DOCTORS.map(function (d) { return card('doctor', d, esc(d.role)); }).join('');
  }
  function setDD(id, text, filled) { var e = $(id); e.textContent = text; e.classList.toggle('empty', !filled); }
  function updateSummary() {
    var s = state.service, d = state.doctor, ready = state.date && state.time;
    setDD('sService', s ? s.name + ' (' + s.mins + ' min)' : 'Not chosen yet', !!s);
    setDD('sDoctor', d ? d.name : 'Not chosen yet', !!d);
    setDD('sWhen', ready ? fmtDate(state.date) + ', ' + fmtTime(state.time) : 'Not chosen yet', !!ready);
    setDD('sPrice', s ? money(s.price) : '–', !!s);
    setDD('sPrep', s ? s.prep : '–', !!s);
  }
  function renderAppts() {
    var box = $('myAppts');
    if (!appts.length) { box.innerHTML = '<p class="text-secondary small mb-0">No appointments yet. Confirmed bookings will appear here.</p>'; return; }
    box.innerHTML = appts.slice().sort(function (a, b) { return (a.date + a.time).localeCompare(b.date + b.time); }).map(function (a) {
      return '<div class="appt shadow-sm"><div class="fw-bold small">' + esc(a.service.name) + '</div>' +
        '<div class="small text-secondary">' + fmtDate(a.date) + ', ' + fmtTime(a.time) + '<br>' + esc(a.doctor.name) + ' · ' + esc(a.name) + '</div>' +
        '<button class="btn btn-sm btn-outline-danger mt-2" data-cancel="' + a.id + '">Cancel</button></div>';
    }).join('');
  }
  function showStep(n, quiet) {
    state.step = n;
    [1, 2, 3].forEach(function (i) { $('step' + i).classList.toggle('d-none', i !== n); });
    Array.prototype.forEach.call($('stepper').children, function (el, i) {
      el.className = 's' + (i + 1 === n ? ' active' : i + 1 < n ? ' done' : '');
      if (i + 1 === n) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current');
    });
    $('backBtn').disabled = n === 1;
    $('nextBtn').textContent = n === 3 ? 'Review booking' : 'Continue';
    if (quiet) return;
    var hd = $('step' + n).querySelector('h2'); hd.tabIndex = -1; hd.focus({ preventScroll: true });
    $('stepper').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  /* ---------- validation ---------- */
  var V = {
    name: function (v) { return /^\p{L}[\p{L} .'\-]{1,59}$/u.test(v.trim()); },
    dob: function (v) { return /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '1900-01-01' && v <= todayISO(); },
    phone: function (v) { var d = v.replace(/\D/g, ''); return /^\+?[0-9\s\-()]+$/.test(v.trim()) && d.length >= 7 && d.length <= 15; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()); },
    notes: function (v) { return v.length <= 200; }
  };
  var FIELDS = ['name', 'dob', 'phone', 'email', 'notes', 'terms'];
  function checkField(id) {
    var el = $(id), v = el.value || '', ok = id === 'terms' ? el.checked : V[id](v);
    el.classList.toggle('is-invalid', !ok);
    el.classList.toggle('is-valid', ok && id !== 'terms' && id !== 'notes' && v.trim() !== '');
    return ok;
  }
  function validateAll() {
    var bad = FIELDS.filter(function (id) { return !checkField(id); });
    if (bad.length) $(bad[0]).focus();
    return !bad.length;
  }

  /* ---------- flow ---------- */
  function next() {
    if (state.step === 1) {
      if (!state.service && !state.doctor) return warn('warning', 'Choose a check-up and a doctor before continuing.');
      if (!state.service) return warn('warning', 'Choose a check-up before continuing.');
      if (!state.doctor) return warn('warning', 'Choose a doctor before continuing.');
      showStep(2); renderSlots();
    } else if (state.step === 2) {
      var msg = checkDate();
      if (msg) { $('date').classList.add('is-invalid'); $('dateFb').textContent = msg; return warn('danger', msg); }
      if (!state.time) return warn('warning', 'Select a time slot to continue.');
      var why = slotReason(state.date, TIMES.indexOf(state.time));
      if (why) { renderSlots(); return warn('danger', 'That time is no longer available (' + why.toLowerCase() + '). Choose another.'); }
      showStep(3);
    } else {
      if (!validateAll()) return warn('danger', 'Some details are missing or incorrect. Fix the fields marked in red.');
      var s = state.service;
      ask({
        title: 'Confirm your check-up', ok: 'Confirm booking', back: 'Go back', onOk: book,
        lines: [s.name + ' with ' + state.doctor.name, fmtDate(state.date) + ' at ' + fmtTime(state.time) + ' · ' + money(s.price),
          'Patient: ' + $('name').value.trim(), 'Before your visit: ' + s.prep]
      });
    }
  }
  function book() {
    var why = slotReason(state.date, TIMES.indexOf(state.time));
    if (why) { showStep(2); renderSlots(); return warn('danger', 'That time is no longer available (' + why.toLowerCase() + '). Choose another.'); }
    var a = { id: Date.now(), service: state.service, doctor: state.doctor, date: state.date, time: state.time, name: $('name').value.trim() };
    appts.push(a); save(); renderAppts(); resetAll();
    warn('success', 'Booked for ' + fmtDate(a.date) + ' at ' + fmtTime(a.time) + '. ' + a.service.prep);
  }
  function resetAll() {
    state = fresh();
    document.querySelectorAll('input[name=service],input[name=doctor]').forEach(function (r) { r.checked = false; });
    $('date').value = ''; $('date').classList.remove('is-invalid'); $('slots').innerHTML = '';
    $('detailsForm').reset(); $('count').textContent = '0';
    document.querySelectorAll('#detailsForm .is-valid,#detailsForm .is-invalid').forEach(function (e) { e.classList.remove('is-valid', 'is-invalid'); });
    updateSummary(); showStep(1);
  }

  /* ---------- events ---------- */
  document.addEventListener('change', function (e) {
    var n = e.target.name;
    if (n === 'service') state.service = find(SERVICES, e.target.value);
    if (n === 'doctor') state.doctor = find(DOCTORS, e.target.value);
    if (n === 'service' || n === 'doctor') updateSummary();
  });
  $('date').addEventListener('change', renderSlots);
  $('slots').addEventListener('click', function (e) {
    var b = e.target.closest('.slot'); if (!b || b.disabled) return;
    Array.prototype.forEach.call($('slots').children, function (x) { x.classList.remove('active'); });
    b.classList.add('active'); state.time = b.dataset.time; updateSummary();
  });
  FIELDS.forEach(function (id) {
    var el = $(id);
    el.addEventListener(id === 'terms' ? 'change' : 'blur', function () { if (id === 'terms' || el.value !== '') checkField(id); });
    el.addEventListener('input', function () { if (el.classList.contains('is-invalid')) checkField(id); });
  });
  $('notes').addEventListener('input', function () { $('count').textContent = this.value.length; });
  $('detailsForm').addEventListener('submit', function (e) { e.preventDefault(); next(); });
  $('nextBtn').addEventListener('click', next);
  $('backBtn').addEventListener('click', function () { if (state.step > 1) showStep(state.step - 1); });
  $('resetBtn').addEventListener('click', function () {
    if (!state.service && !state.doctor && !state.date) return warn('info', 'There is nothing to clear yet.');
    ask({ title: 'Start over?', lines: ['This clears everything you have entered so far.'], ok: 'Clear form', back: 'Keep editing', danger: true,
      onOk: function () { resetAll(); warn('info', 'Form cleared. You can start a new booking.'); } });
  });
  $('myAppts').addEventListener('click', function (e) {
    var id = e.target.getAttribute('data-cancel'); if (!id) return;
    var a = appts.filter(function (x) { return String(x.id) === id; })[0]; if (!a) return;
    var lines = [a.service.name + ' on ' + fmtDate(a.date) + ' at ' + fmtTime(a.time) + ' will be released.'];
    if ((parse(a.date, a.time) - new Date()) / 36e5 < 24) lines.push('This is less than 24 hours away, so a late-cancellation fee may apply.');
    ask({ title: 'Cancel this appointment?', lines: lines, ok: 'Cancel appointment', back: 'Keep it', danger: true,
      onOk: function () {
        appts = appts.filter(function (x) { return x.id !== a.id; });
        save(); renderAppts(); warn('success', 'Appointment cancelled.');
        if (state.step === 2) renderSlots();
      } });
  });
  window.addEventListener('storage', function (e) { /* keep tabs in sync */
    if (e.key !== KEY) return;
    appts = load(); renderAppts(); if (state.step === 2) renderSlots();
  });

  /* ---------- init ---------- */
  $('date').min = todayISO(); $('date').max = maxISO();
  $('dob').min = '1900-01-01'; $('dob').max = todayISO();
  renderChoices(); renderAppts(); updateSummary(); showStep(1, true);
})();
