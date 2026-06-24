/**
 * SVA Referral — Frontend
 * Paste your deployed Apps Script Web App URL into API_URL below.
 */
const API_URL = 'https://script.google.com/macros/s/AKfycbzmYSXHGF6WhQJxvU8b8havA80g9slONmjYd5RQ7FfTqWIYdxmkm0chpLKJvOxEwzCnQA/exec';

const els = {
  yearSpan: document.getElementById('year'),
  toast: document.getElementById('toast'),
  tabs: document.querySelectorAll('.tab'),
  panels: { family: document.getElementById('panel-family'), teacher: document.getElementById('panel-teacher') },
  familyForm: document.getElementById('family-form'),
  teacherForm: document.getElementById('teacher-form'),
  positionsList: document.getElementById('positions-list'),
  currentGradeSelect: document.querySelector('#family-form select[name="currentStudentGrade"]'),
  prospectiveGradeSelect: document.querySelector('#family-form select[name="prospectiveGrade"]'),
  candidatePositionSelect: document.querySelector('#teacher-form select[name="candidatePosition"]')
};

els.yearSpan.textContent = new Date().getFullYear();

/* ---------- Tabs ---------- */
els.tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    els.tabs.forEach(t => {
      const on = t === tab;
      t.classList.toggle('active', on);
      t.setAttribute('aria-selected', on);
    });
    Object.entries(els.panels).forEach(([k, panel]) => {
      const on = k === target;
      panel.classList.toggle('active', on);
      panel.hidden = !on;
    });
  });
});

/* ---------- Toast ---------- */
function toast(message, isError) {
  els.toast.textContent = message;
  els.toast.classList.toggle('error', !!isError);
  els.toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { els.toast.hidden = true; }, 5500);
}

/* ---------- Load config from backend ---------- */
async function loadConfig() {
  if (!API_URL || API_URL.startsWith('PASTE_')) {
    els.positionsList.innerHTML = '<span class="empty">Backend not yet configured. Paste your Apps Script Web App URL into <code>app.js</code> to load grades and positions.</span>';
    return;
  }
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Could not load configuration.');
    const allGrades = data.allGrades || data.grades || [];
    const openGrades = data.grades || [];
    fillSelect(els.currentGradeSelect, allGrades, 'Select a grade…');
    fillSelect(els.prospectiveGradeSelect, openGrades, openGrades.length ? 'Select a grade…' : 'No grades with open spots');
    fillSelect(els.candidatePositionSelect, data.positions, 'Select a position…');
    renderPositions(data.positions);
  } catch (err) {
    els.positionsList.innerHTML = `<span class="empty">Could not load open positions right now. Please try again later.</span>`;
    [els.currentGradeSelect, els.prospectiveGradeSelect, els.candidatePositionSelect].forEach(sel => {
      sel.innerHTML = '<option value="">Unavailable — refresh to retry</option>';
    });
    console.error(err);
  }
}

function fillSelect(select, items, placeholder) {
  select.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = placeholder;
  select.appendChild(opt);
  (items || []).forEach(item => {
    const o = document.createElement('option');
    o.value = item; o.textContent = item;
    select.appendChild(o);
  });
}

function renderPositions(positions) {
  if (!positions || !positions.length) {
    els.positionsList.innerHTML = '<span class="empty">There are no open positions at this time, but we always welcome referrals of exceptional educators.</span>';
    return;
  }
  const ul = document.createElement('ul');
  positions.forEach(p => { const li = document.createElement('li'); li.textContent = p; ul.appendChild(li); });
  els.positionsList.innerHTML = '<strong>Currently seeking:</strong>';
  els.positionsList.appendChild(ul);
}

/* ---------- File → base64 ---------- */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.substring(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- Form helpers ---------- */
function formToObject(form) {
  const obj = {};
  new FormData(form).forEach((v, k) => { if (typeof v === 'string') obj[k] = v.trim(); });
  form.querySelectorAll('input[type="checkbox"]').forEach(cb => { obj[cb.name] = cb.checked; });
  return obj;
}

function setStatus(form, message, type) {
  const status = form.querySelector('.status');
  status.textContent = message;
  status.className = 'status' + (type ? ' ' + type : '');
}

async function submitForm(form, type, extras) {
  const submitBtn = form.querySelector('button[type="submit"]');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  if (!API_URL || API_URL.startsWith('PASTE_')) {
    setStatus(form, 'Backend URL is not configured yet. Paste your Apps Script Web App URL into app.js.', 'error');
    return;
  }
  submitBtn.disabled = true;
  setStatus(form, 'Submitting…');
  try {
    const payload = Object.assign({ type }, formToObject(form), extras || {});
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
      // Apps Script web apps reject custom JSON content-types in CORS preflight;
      // sending as text/plain avoids the preflight while the server still JSON.parses the body.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Submission failed.');
    setStatus(form, 'Thank you — your referral has been submitted. A confirmation email is on its way.', 'success');
    toast('Referral submitted. Thank you!');
    form.reset();
  } catch (err) {
    setStatus(form, 'Something went wrong: ' + err.message, 'error');
    toast('Submission failed — please try again.', true);
  } finally {
    submitBtn.disabled = false;
  }
}

/* ---------- Wire forms ---------- */
els.familyForm.addEventListener('submit', e => {
  e.preventDefault();
  submitForm(els.familyForm, 'family');
});

els.teacherForm.addEventListener('submit', async e => {
  e.preventDefault();
  const fileInput = els.teacherForm.querySelector('input[name="resume"]');
  const extras = {};
  const file = fileInput && fileInput.files && fileInput.files[0];
  if (file) {
    if (file.size > 8 * 1024 * 1024) {
      setStatus(els.teacherForm, 'Resume is larger than 8 MB — please upload a smaller file.', 'error');
      return;
    }
    try {
      extras.resumeBase64 = await readFileAsBase64(file);
      extras.resumeName = file.name;
      extras.resumeMimeType = file.type || 'application/octet-stream';
    } catch {
      setStatus(els.teacherForm, 'Could not read the resume file. Please try again.', 'error');
      return;
    }
  }
  submitForm(els.teacherForm, 'teacher', extras);
});

loadConfig();
