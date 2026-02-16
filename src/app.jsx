const { useState, useEffect, useMemo, useRef } = React;

// =====================================================================
// LOCAL CACHE CONFIG
// =====================================================================

const METRICS_CACHE_KEY = 'nsh-strategy-metrics-cache-v1';
const SNAPSHOTS_CACHE_KEY = 'nsh-strategy-sections-cache-v1';
const QUARTERLY_CACHE_KEY = 'nsh-strategy-quarterly-cache-v1';
const MAJOR_TODOS_CACHE_KEY = 'nsh-strategy-major-todos-v1';

// ============================================================================
// GOOGLE SHEETS CONFIGURATION
// ============================================================================

const USE_SHEETS = true;
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbydaZEpixA_RWAQ42HPsrFe6gCrf5bDYhWbj7COlNwmq-tQOOJaBiivRQfahnGq3WIDeQ/exec';
const DRIVE_SCRIPT_URL = GOOGLE_SCRIPT_URL;
const HONEYBOOK_MESSAGES_URL = 'https://docs.google.com/spreadsheets/d/1l-FsSLYELMM5pMwWS92UgKlwPmsrCmNEe7kmrEaQB6M/edit?gid=0#gid=0';
const HONEYBOOK_MESSAGES_EMBED_URL = 'https://docs.google.com/spreadsheets/d/1l-FsSLYELMM5pMwWS92UgKlwPmsrCmNEe7kmrEaQB6M/preview';
const VOICEMAILS_EMBED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSTge4UtsTFma1Y4ppSeC5nVORQiTtVLXXysbHUNdf3sOBb372QR9YG3Q9AfUNbGFD3K2Y0FeP4V5P2/pubhtml?gid=0&single=true&widget=false&headers=false&chrome=false';
const HONEYBOOK_SHEET_ID = '1l-FsSLYELMM5pMwWS92UgKlwPmsrCmNEe7kmrEaQB6M';
const VOICEMAILS_SHEET_ID = '1kqVXngOaf_X1lrB6Nbi5U_3NJ4_P_fGMqxhyqdfuDT0';
const SHEET_LAST_SEEN_KEY = 'nsh-sheet-last-seen-v1';

const isValidScriptUrl = (url) =>
  /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/i.test(String(url || '').trim());

const getScriptConfigWarning = () => {
  if (!USE_SHEETS) return '';
  if (!GOOGLE_SCRIPT_URL) return 'Google Sheets URL is missing.';
  const raw = String(GOOGLE_SCRIPT_URL).trim();
  if (raw.includes('/macros/library/')) {
    return 'Google Sheets URL is a library link. Use the Web App /exec URL instead.';
  }
  if (!isValidScriptUrl(raw)) {
    return 'Google Sheets URL must be the Web App /exec link.';
  }
  return '';
};

// ============================================================================
// DROPDOWN OPTIONS
// ============================================================================

const FOCUS_AREAS = [
  'Fund Development',
  'House and Grounds Development',
  'Programs and Events',
  'Organizational Development'
];

const SECTION_PAGES = [
  { key: 'construction', label: 'Construction', sheet: 'Construction' },
  { key: 'grounds', label: 'Grounds', sheet: 'Grounds' },
  { key: 'interiors', label: 'Interiors', sheet: 'Interiors' },
  { key: 'docents', label: 'Docents', sheet: 'Docents' },
  { key: 'fund', label: 'Fundraising', sheet: 'Fundraising' },
  { key: 'events', label: 'Events', sheet: 'Events' },
  { key: 'marketing-ops', label: 'Marketing', sheet: 'Marketing' },
  { key: 'venue', label: 'Venue', sheet: 'Venue' }
];

const STATUSES = [
  'Not started',
  'On track',
  'At risk',
  'Behind',
  'Complete'
];

const REVIEW_STATUSES = [
  'Pending',
  'Reviewed',
  'Needs info'
];

const PROGRESS_OPTIONS = Array.from({ length: 11 }, (_, idx) => idx * 10);

// ============================================================================
// FALLBACK SAMPLE DATA
// ============================================================================

// ============================================================================
// GOOGLE SHEETS API FUNCTIONS
// ============================================================================

const SheetsAPI = {
  isConfigured: () => USE_SHEETS && isValidScriptUrl(GOOGLE_SCRIPT_URL),

  postJson: async (url, payload) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Request failed (${response.status}). ${body || 'No response body.'}`);
    }
    return response.json();
  },

  uploadFile: async ({ filename, mimeType, data }) => {
    if (!DRIVE_SCRIPT_URL) {
      throw new Error('Drive upload not configured');
    }

    const payload = {
      action: 'uploadImage',
      filename,
      mimeType,
      data
    };

    const response = await SheetsAPI.postJson(DRIVE_SCRIPT_URL, payload);
    if (!response.success) throw new Error(response.error || 'Upload failed');
    return response.result;
  },

  fetchMetrics: async () => {
    if (!SheetsAPI.isConfigured()) {
      return null;
    }
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getMetrics`);
      if (!response.ok) throw new Error('Failed to fetch metrics');
      const data = await response.json();
      return data.metrics || null;
    } catch (error) {
      console.error('Error fetching metrics:', error);
      return null;
    }
  },

  submitQuarterlyUpdate: async (form) => {
    if (!SheetsAPI.isConfigured()) {
      throw new Error('Google Sheets not configured');
    }
    const data = await SheetsAPI.postJson(GOOGLE_SCRIPT_URL, { action: 'submitQuarterlyUpdate', form });
    if (!data.success) throw new Error(data.error || 'Submission failed');
    return data.result;
  },

  submitReviewUpdate: async (review) => {
    if (!SheetsAPI.isConfigured()) {
      throw new Error('Google Sheets not configured');
    }
    const data = await SheetsAPI.postJson(GOOGLE_SCRIPT_URL, { action: 'submitReviewUpdate', review });
    if (!data.success) throw new Error(data.error || 'Submission failed');
    return data.result;
  },

  fetchQuarterlyUpdates: async () => {
    if (!SheetsAPI.isConfigured()) {
      return [];
    }
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getQuarterlyUpdates`);
      if (!response.ok) throw new Error('Failed to fetch quarterly updates');
      const data = await response.json();
      return data.updates || [];
    } catch (error) {
      console.error('Error fetching quarterly updates:', error);
      return [];
    }
  },

  fetchSectionSnapshots: async () => {
    if (!SheetsAPI.isConfigured()) {
      return null;
    }
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getSectionSnapshots`);
      if (!response.ok) throw new Error('Failed to fetch section snapshots');
      const data = await response.json();
      return data.sections || null;
    } catch (error) {
      console.error('Error fetching section snapshots:', error);
      return null;
    }
  },

  fetchMajorTodos: async () => {
    if (!SheetsAPI.isConfigured()) return [];
    try {
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getMajorTodos`);
      if (!response.ok) throw new Error('Failed to fetch major todos');
      const data = await response.json();
      return data.todos || [];
    } catch (error) {
      console.error('Error fetching major todos:', error);
      return [];
    }
  },

  saveMajorTodo: async (todo) => {
    if (!SheetsAPI.isConfigured()) return todo;
    try {
      const data = await SheetsAPI.postJson(GOOGLE_SCRIPT_URL, { action: 'saveMajorTodo', todo });
      if (!data.success) throw new Error(data.error || 'Save failed');
      return data.result;
    } catch (error) {
      console.error('Error saving major todo:', error);
      return todo;
    }
  },

  deleteMajorTodo: async (id) => {
    if (!SheetsAPI.isConfigured()) return { deleted: true };
    try {
      const data = await SheetsAPI.postJson(GOOGLE_SCRIPT_URL, { action: 'deleteMajorTodo', id });
      if (!data.success) throw new Error(data.error || 'Delete failed');
      return data.result;
    } catch (error) {
      console.error('Error deleting major todo:', error);
      return { deleted: false };
    }
  }
};

const readSimpleCache = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to read cache:', error);
    return null;
  }
};

const writeSimpleCache = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to write cache:', error);
  }
};

// ============================================================================
// HELPERS
// ============================================================================

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

const formatDate = (value) => {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    return value;
  }
};

const formatDateNumeric = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}`;
};

const getNextQuarter = (quarter) => {
  switch (quarter) {
    case 'Q1':
      return 'Q2';
    case 'Q2':
      return 'Q3';
    case 'Q3':
      return 'Q4';
    case 'Q4':
      return 'Final';
    default:
      return null;
  }
};

const formatCount = (value) => {
  if (value === null || value === undefined) return 'N/A';
  return new Intl.NumberFormat('en-US').format(Number(value) || 0);
};

const formatCurrency = (value) => {
  if (value === null || value === undefined) return 'N/A';
  const amount = Number(value) || 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(amount);
};

const normalizeDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const parseActionRows = (value, count = 3) => {
  const rows = [];
  const lines = String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  lines.forEach((line) => {
    const parts = line.split('|').map((part) => part.trim());
    const [action = '', owner = '', deadline = ''] = parts;
    rows.push({ action, owner, deadline });
  });
  while (rows.length < count) {
    rows.push({ action: '', owner: '', deadline: '' });
  }
  return rows.slice(0, count);
};

const serializeActionRows = (rows) =>
  rows
    .map((row) => [row.action, row.owner, row.deadline].map((value) => value.trim()).join(' | '))
    .filter((line) => line.replace(/\|/g, '').trim() !== '')
    .join('\n');

const normalizeInitiative = (item) => ({
  ...item,
  focusArea: item.focusArea || item.pillar || '',
  progress: Number(item.progress) || 0,
  updates: Array.isArray(item.updates) ? item.updates : []
});

const sortUpdates = (updates) =>
  updates.slice().sort((a, b) => new Date(b.date) - new Date(a.date));

const statusClass = (status) => {
  switch (status) {
    case 'On track':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    case 'At risk':
      return 'bg-amber-100 text-amber-700 border-amber-200';
    case 'Behind':
      return 'bg-rose-100 text-rose-700 border-rose-200';
    case 'Complete':
      return 'bg-gold text-white border-gold';
    default:
      return 'bg-stone-100 text-stone-600 border-stone-200';
  }
};

const reviewClass = (status) => {
  switch (status) {
    case 'Reviewed':
      return 'text-emerald-700';
    case 'Needs info':
      return 'text-rose-700';
    default:
      return 'text-amber-700';
  }
};

// ============================================================================
// ICONS
// ============================================================================

const IconSpark = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6L3.5 10.5 9.5 8z"></path>
  </svg>
);

const IconTarget = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"></circle>
    <circle cx="12" cy="12" r="5"></circle>
    <circle cx="12" cy="12" r="1"></circle>
  </svg>
);

const IconStar = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2.8l2.7 5.7 6.3.9-4.5 4.4 1.1 6.2L12 17.8 6.4 20l1.1-6.2-4.5-4.4 6.3-.9L12 2.8z"></path>
  </svg>
);

const IconPlus = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14"></path>
    <path d="M5 12h14"></path>
  </svg>
);

const IconArrow = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"></path>
    <path d="M13 5l7 7-7 7"></path>
  </svg>
);

const IconBack = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5"></path>
    <path d="M11 5l-7 7 7 7"></path>
  </svg>
);

const IconRefresh = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 15.3-6.3"></path>
    <path d="M21 12a9 9 0 0 1-15.3 6.3"></path>
    <path d="M18 6v4h-4"></path>
    <path d="M6 18v-4h4"></path>
  </svg>
);

const IconCheck = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6L9 17l-5-5"></path>
  </svg>
);

const IconTrash = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18"></path>
    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"></path>
    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"></path>
  </svg>
);

// ============================================================================
// UI COMPONENTS
// ============================================================================

const ProgressBar = ({ value }) => (
  <div className="w-full bg-stone-100 rounded-full h-3 overflow-hidden">
    <div
      className="h-full bg-clay transition-all"
      style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
    ></div>
  </div>
);

const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${statusClass(status)}`}>
    {status}
  </span>
);

const KpiCard = ({ label, value, helper }) => (
  <div className="glass rounded-2xl p-4 md:p-5 card-shadow">
    <div className="text-xs uppercase tracking-wide text-steel">{label}</div>
    <div className="text-2xl font-display text-ink mt-2">{value}</div>
    {helper && <div className="text-xs text-steel mt-1">{helper}</div>}
  </div>
);

const InitiativeCard = ({ initiative, onSelect }) => (
  <button
    onClick={onSelect}
    className="text-left bg-white rounded-2xl border border-stone-100 p-5 card-shadow hover:-translate-y-0.5 transition-transform"
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wide text-steel">{initiative.focusArea}</div>
        <h3 className="font-display text-xl text-ink mt-1">{initiative.title}</h3>
      </div>
      <StatusPill status={initiative.status} />
    </div>
    <p className="text-sm text-stone-600 mt-3">{initiative.description}</p>
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-steel mb-2">
        <span>{Math.round(initiative.progress)}% complete</span>
        <span>Target: {initiative.targetDate || 'TBD'}</span>
      </div>
      <ProgressBar value={initiative.progress} />
    </div>
    <div className="flex items-center justify-between text-xs text-steel mt-4">
      <span>Goal lead: {initiative.owner || 'Unassigned'}</span>
      <span>Last update: {formatDate(initiative.lastUpdateAt)}</span>
    </div>
  </button>
);

const UpdateCard = ({ update, onReviewSave }) => {
  const [reviewStatus, setReviewStatus] = useState(update.reviewStatus || 'Pending');
  const [reviewNotes, setReviewNotes] = useState(update.reviewNotes || '');

  return (
    <div className="bg-white rounded-2xl border border-stone-100 p-5 card-shadow">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-steel">{formatDate(update.date)}</div>
          <h4 className="font-display text-lg text-ink mt-1">{update.summary || 'Update'}</h4>
          <p className="text-sm text-stone-600">Submitted by {update.author || 'Team member'}</p>
        </div>
        <div className={`text-xs font-semibold ${reviewClass(reviewStatus)}`}>
          {reviewStatus}
        </div>
      </div>
      {update.details && <p className="text-sm text-stone-700 mt-3 whitespace-pre-wrap">{update.details}</p>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-stone-600 mt-4">
        <div>
          <div className="uppercase tracking-wide text-steel">Blockers</div>
          <div>{update.blockers || 'None noted'}</div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-steel">Next steps</div>
          <div>{update.nextSteps || 'No next steps yet'}</div>
        </div>
        <div>
          <div className="uppercase tracking-wide text-steel">Progress</div>
          <div>{typeof update.progress === 'number' ? `${Math.round(update.progress)}%` : 'Not shared'}</div>
        </div>
      </div>
      {update.links && (
        <div className="mt-3 text-xs text-gold">
          <a href={update.links} target="_blank" rel="noreferrer" className="underline">
            View supporting link
          </a>
        </div>
      )}
      <div className="mt-4 pt-4 border-t border-stone-100">
        <div className="text-xs uppercase tracking-wide text-steel">Co-champion review</div>
        <div className="flex flex-col md:flex-row md:items-center gap-3 mt-2">
          <select
            value={reviewStatus}
            onChange={(event) => setReviewStatus(event.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg bg-white text-sm"
          >
            {REVIEW_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input
            type="text"
            value={reviewNotes}
            onChange={(event) => setReviewNotes(event.target.value)}
            placeholder="Review notes"
            className="flex-1 px-3 py-2 border border-stone-200 rounded-lg text-sm"
          />
          <button
            onClick={() => onReviewSave(update.id, reviewStatus, reviewNotes)}
            className="px-4 py-2 bg-gold text-white rounded-lg text-sm"
          >
            Save review
          </button>
        </div>
      </div>
    </div>
  );
};

const UpdateForm = ({ initiative, onSubmit }) => {
  const [author, setAuthor] = useState('');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [blockers, setBlockers] = useState('');
  const [nextSteps, setNextSteps] = useState('');
  const [progress, setProgress] = useState(initiative.progress || 0);
  const [links, setLinks] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const update = {
      id: makeId(),
      date: new Date().toISOString(),
      author,
      summary,
      details,
      blockers,
      nextSteps,
      progress: Number(progress) || 0,
      links,
      reviewStatus: 'Pending',
      reviewNotes: ''
    };
    onSubmit(update);
    setAuthor('');
    setSummary('');
    setDetails('');
    setBlockers('');
    setNextSteps('');
    setProgress(initiative.progress || 0);
    setLinks('');
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-100 p-5 card-shadow">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl">Submit progress update</h3>
        <span className="text-xs text-steel">Visible to board members</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Your name</label>
          <input
            type="text"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Name or team"
            required
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Update headline</label>
          <input
            type="text"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Short summary"
            required
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Details</label>
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
            placeholder="What changed? What decisions were made?"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Blockers</label>
          <input
            type="text"
            value={blockers}
            onChange={(event) => setBlockers(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Risks or constraints"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Next steps</label>
          <input
            type="text"
            value={nextSteps}
            onChange={(event) => setNextSteps(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Immediate actions"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Updated progress</label>
          <select
            value={progress}
            onChange={(event) => setProgress(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            {PROGRESS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}%</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Supporting link</label>
          <input
            type="url"
            value={links}
            onChange={(event) => setLinks(event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="https://"
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end">
        <button type="submit" className="px-5 py-2 bg-clay text-white rounded-lg">Submit update</button>
      </div>
    </form>
  );
};

const InitiativeForm = ({ initiative, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(() => ({
    title: initiative?.title || '',
    focusArea: initiative?.focusArea || '',
    description: initiative?.description || '',
    owner: initiative?.owner || '',
    coChampions: initiative?.coChampions || '',
    status: initiative?.status || STATUSES[0],
    progress: initiative?.progress || 0,
    targetDate: initiative?.targetDate || '',
    successMetrics: initiative?.successMetrics || '',
    threeYearVision: initiative?.threeYearVision || '',
    annualGoals: initiative?.annualGoals || '',
    notes: initiative?.notes || ''
  }));

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const next = {
      ...initiative,
      ...form,
      progress: Number(form.progress) || 0,
      updates: initiative?.updates || []
    };
    onSave(next);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-stone-100 p-6 card-shadow">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl">{initiative ? 'Edit initiative' : 'Add initiative'}</h2>
        <span className="text-xs text-steel">Visible to board leaders</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Initiative title</label>
          <input
            type="text"
            value={form.title}
            onChange={(event) => updateField('title', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Focus area</label>
          <select
            value={form.focusArea}
            onChange={(event) => updateField('focusArea', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            <option value="">Select focus area</option>
            {FOCUS_AREAS.map((focusArea) => (
              <option key={focusArea} value={focusArea}>{focusArea}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Goal lead</label>
          <input
            type="text"
            value={form.owner}
            onChange={(event) => updateField('owner', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Lead or team"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Description</label>
          <textarea
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Co-champions</label>
          <input
            type="text"
            value={form.coChampions}
            onChange={(event) => updateField('coChampions', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="Names or roles"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Status</label>
          <select
            value={form.status}
            onChange={(event) => updateField('status', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Progress</label>
          <select
            value={form.progress}
            onChange={(event) => updateField('progress', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            {PROGRESS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}%</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Target date</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(event) => updateField('targetDate', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Success metrics</label>
          <input
            type="text"
            value={form.successMetrics}
            onChange={(event) => updateField('successMetrics', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            placeholder="What does success look like?"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Three-year vision for success</label>
          <textarea
            value={form.threeYearVision}
            onChange={(event) => updateField('threeYearVision', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
            placeholder="Describe what success looks like in three years."
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Annual goals</label>
          <textarea
            value={form.annualGoals}
            onChange={(event) => updateField('annualGoals', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
            placeholder="List the annual goals that move this forward."
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Notes</label>
          <textarea
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
          />
        </div>
      </div>
      <div className="mt-6 flex items-center justify-end gap-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-stone-200 rounded-lg">
          Cancel
        </button>
        <button type="submit" disabled={isSaving} className="px-5 py-2 bg-gold text-white rounded-lg">
          {isSaving ? 'Saving...' : 'Save initiative'}
        </button>
      </div>
    </form>
  );
};

// ============================================================================
// QUARTERLY UPDATE FORM
// ============================================================================

const buildQuarterlyForm = () => ({
    focusArea: '',
    quarter: '',
    year: new Date().getFullYear().toString(),
    submittedDate: new Date().toISOString().slice(0, 10),
    primaryFocus: '',
    goals: [
      { goal: '', status: 'On Track', summary: '' },
      { goal: '', status: 'On Track', summary: '' },
      { goal: '', status: 'On Track', summary: '' }
    ],
    wins: '',
    challenges: {
      capacity: false,
      budget: false,
      scheduling: false,
      coordination: false,
      external: false,
      other: false,
      otherText: '',
      details: ''
    },
    supportNeeded: '',
    supportTypes: {
      staff: false,
      marketing: false,
      board: false,
      funding: false,
      facilities: false,
      other: false,
      otherText: ''
    },
    decisionsNeeded: '',
    nextQuarterFocus: '',
    nextPriorities: ['', '', ''],
    finalTallyOverview: ''
  });

const QuarterlyUpdateForm = ({
  onSubmitted,
  initialData,
  hidePrimaryGoals = false,
  defaultFocusArea = '',
  lockFocusArea = false
}) => {
  const [form, setForm] = useState(() => ({
    ...buildQuarterlyForm(),
    focusArea: defaultFocusArea || ''
  }));
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const suggestionKey = `nsh-quarterly-next-${form.focusArea || 'area'}-${form.quarter || 'quarter'}`;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateGoal = (index, field, value) => {
    setForm((prev) => {
      const goals = prev.goals.map((goal, idx) =>
        idx === index ? { ...goal, [field]: value } : goal
      );
      return { ...prev, goals };
    });
  };

  const updateChallenge = (field, value) => {
    setForm((prev) => ({
      ...prev,
      challenges: { ...prev.challenges, [field]: value }
    }));
  };

  const updateSupportType = (field, value) => {
    setForm((prev) => ({
      ...prev,
      supportTypes: { ...prev.supportTypes, [field]: value }
    }));
  };

  const updatePriority = (index, value) => {
    setForm((prev) => {
      const nextPriorities = prev.nextPriorities.map((item, idx) =>
        idx === index ? value : item
      );
      return { ...prev, nextPriorities };
    });
  };

  useEffect(() => {
    if (!initialData) return;
    setForm((prev) => ({
      ...buildQuarterlyForm(),
      ...initialData,
      challenges: { ...prev.challenges, ...(initialData.challenges || {}) },
      supportTypes: { ...prev.supportTypes, ...(initialData.supportTypes || {}) }
    }));
    setUploadedFiles(initialData.uploadedFiles || []);
  }, [initialData]);

  useEffect(() => {
    if (initialData) return;
    if (!form.focusArea || !form.quarter) return;
    if (form.primaryFocus || form.goals?.some((goal) => goal.goal)) return;
    const raw = localStorage.getItem(suggestionKey);
    if (!raw) return;
    try {
      const suggestion = JSON.parse(raw);
      if (!suggestion) return;
      setForm((prev) => ({
        ...prev,
        primaryFocus: suggestion.primaryFocus || prev.primaryFocus,
        goals: suggestion.goals?.length ? suggestion.goals : prev.goals
      }));
    } catch (error) {
      console.warn('Failed to read quarterly suggestion:', error);
    }
  }, [initialData, form.focusArea, form.quarter, form.primaryFocus, form.goals, suggestionKey]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      const normalizeNone = (value) => (String(value || '').trim() ? value : 'None noted');
      const challengeKeys = ['capacity', 'budget', 'scheduling', 'coordination', 'external', 'other'];
      const supportKeys = ['staff', 'marketing', 'board', 'funding', 'facilities', 'other'];
      const hasChallengesChecked = challengeKeys.some((key) => form.challenges?.[key]);
      const hasSupportChecked = supportKeys.some((key) => form.supportTypes?.[key]);
      const normalizedForm = {
        ...form,
        wins: normalizeNone(form.wins),
        challenges: {
          ...form.challenges,
          details: normalizeNone(form.challenges?.details)
        },
        supportNeeded: normalizeNone(form.supportNeeded),
        decisionsNeeded: normalizeNone(form.decisionsNeeded),
        nextQuarterFocus: normalizeNone(form.nextQuarterFocus),
        challengesCheckedOverride: hasChallengesChecked ? '' : 'None noted',
        supportTypesCheckedOverride: hasSupportChecked ? '' : 'None noted'
      };
      await SheetsAPI.submitQuarterlyUpdate({ ...normalizedForm, uploadedFiles });
      const nextQuarter = getNextQuarter(form.quarter);
      if (nextQuarter && form.focusArea) {
        const nextKey = `nsh-quarterly-next-${form.focusArea}-${nextQuarter}`;
        const nextPriorities = form.nextPriorities || [];
        const suggestion = {
          primaryFocus: form.nextQuarterFocus || nextPriorities[0] || '',
          goals: [
            { goal: nextPriorities[0] || '', status: 'On Track', summary: '' },
            { goal: nextPriorities[1] || '', status: 'On Track', summary: '' },
            { goal: nextPriorities[2] || '', status: 'On Track', summary: '' }
          ]
        };
        localStorage.setItem(nextKey, JSON.stringify(suggestion));
      }
      await onSubmitted?.();
    } catch (error) {
      console.error('Quarterly update submit failed:', error);
      alert('Submission failed. Please try again.');
    }
    setIsSubmitting(false);
  };

  const handleFilesUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setIsUploading(true);
    try {
      const uploads = await Promise.all(
        files.map((file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = String(reader.result || '').split(',')[1] || '';
            try {
              const result = await SheetsAPI.uploadFile({
                filename: file.name,
                mimeType: file.type,
                data: base64
              });
              resolve(result);
            } catch (error) {
              reject(error);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        }))
      );
      setUploadedFiles((prev) => [...prev, ...uploads]);
    } catch (error) {
      console.error('Failed to upload files:', error);
      alert('Failed to upload files. Please try again.');
    }
    setIsUploading(false);
    event.target.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto fade-up">
      <div className="bg-white rounded-3xl border border-stone-100 p-6 md:p-8 card-shadow">
        <h1 className="font-display text-3xl text-ink">Quarterly Update Form</h1>
        <p className="text-stone-600 mt-2">
          Share quarterly progress, challenges, and support needs for each focus area.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Organizational area</label>
              <select
                value={form.focusArea}
                onChange={(event) => updateField('focusArea', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
                required
                disabled={lockFocusArea}
              >
                <option value="">Select area</option>
                {SECTION_PAGES.map((area) => (
                  <option key={area.label} value={area.label}>{area.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Quarter</label>
              <select
                value={form.quarter}
                onChange={(event) => updateField('quarter', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
                required
              >
                <option value="">Select quarter</option>
                {['Q1', 'Q2', 'Q3', 'Q4', 'Final'].map((quarter) => (
                  <option key={quarter} value={quarter}>
                    {quarter === 'Q1' ? 'Q1 (Jan 1 - Mar 31)' :
                      quarter === 'Q2' ? 'Q2 (Apr 1 - Jun 30)' :
                        quarter === 'Q3' ? 'Q3 (Jul 1 - Sep 30)' :
                          quarter === 'Q4' ? 'Q4 (Oct 1 - Dec 31)' : quarter}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Year</label>
              <input
                type="text"
                value={form.year}
                onChange={(event) => updateField('year', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Date submitted</label>
              <input
                type="date"
                value={form.submittedDate}
                onChange={(event) => updateField('submittedDate', event.target.value)}
                className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
              />
            </div>
          </div>

          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
            <div className="text-xs uppercase tracking-wide text-steel">Quarterly reflection</div>
            <label className="text-xs uppercase tracking-wide text-steel mt-4 block">What went well</label>
            <textarea
              value={form.wins}
              onChange={(event) => updateField('wins', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[120px]"
              placeholder="Milestones, events, completed projects."
            />

            <div className="mt-4 text-xs uppercase tracking-wide text-steel">Challenges encountered</div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-stone-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.capacity} onChange={(event) => updateChallenge('capacity', event.target.checked)} />
                Capacity or volunteer limitations
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.budget} onChange={(event) => updateChallenge('budget', event.target.checked)} />
                Budget or funding constraints
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.scheduling} onChange={(event) => updateChallenge('scheduling', event.target.checked)} />
                Scheduling or timing issues
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.coordination} onChange={(event) => updateChallenge('coordination', event.target.checked)} />
                Cross-area coordination gaps
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.external} onChange={(event) => updateChallenge('external', event.target.checked)} />
                External factors
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.challenges.other} onChange={(event) => updateChallenge('other', event.target.checked)} />
                Other
              </label>
            </div>
            {form.challenges.other && (
              <input
                type="text"
                value={form.challenges.otherText}
                onChange={(event) => updateChallenge('otherText', event.target.value)}
                className="mt-3 w-full px-3 py-2 border border-stone-200 rounded-lg"
                placeholder="Other challenges"
              />
            )}
            <textarea
              value={form.challenges.details}
              onChange={(event) => updateChallenge('details', event.target.value)}
              className="mt-3 w-full px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
              placeholder="Details"
            />

            <div className="mt-4 text-xs uppercase tracking-wide text-steel">Support needed to stay on track</div>
            <div className="mt-2 space-y-2 text-sm text-stone-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supportTypes.staff} onChange={(event) => updateSupportType('staff', event.target.checked)} />
                Staff or volunteer help
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supportTypes.marketing} onChange={(event) => updateSupportType('marketing', event.target.checked)} />
                Marketing or communications
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supportTypes.board} onChange={(event) => updateSupportType('board', event.target.checked)} />
                Board guidance or decision
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supportTypes.funding} onChange={(event) => updateSupportType('funding', event.target.checked)} />
                Funding or fundraising support
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supportTypes.facilities} onChange={(event) => updateSupportType('facilities', event.target.checked)} />
                Facilities or logistics
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.supportTypes.other} onChange={(event) => updateSupportType('other', event.target.checked)} />
                Other
              </label>
            </div>
            {form.supportTypes.other && (
              <input
                type="text"
                value={form.supportTypes.otherText}
                onChange={(event) => updateSupportType('otherText', event.target.value)}
                className="mt-3 w-full px-3 py-2 border border-stone-200 rounded-lg"
                placeholder="Other support type"
              />
            )}

            <label className="text-xs uppercase tracking-wide text-steel mt-4 block">Other notes</label>
            <textarea
              value={form.decisionsNeeded}
              onChange={(event) => updateField('decisionsNeeded', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
              placeholder="Decisions or approvals needed."
            />

            <label className="text-xs uppercase tracking-wide text-steel mt-4 block">Next quarter focus area and goals</label>
            <input
              type="text"
              value={form.nextQuarterFocus}
              onChange={(event) => updateField('nextQuarterFocus', event.target.value)}
              className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg"
              placeholder="Primary focus for next quarter"
            />
            <div className="mt-3 space-y-2">
              {form.nextPriorities.map((item, index) => (
                <input
                  key={index}
                  type="text"
                  value={item}
                  onChange={(event) => updatePriority(index, event.target.value)}
                  className="w-full px-3 py-2 border border-stone-200 rounded-lg"
                  placeholder={`${index + 1}.`}
                />
              ))}
            </div>
          </div>

          {form.quarter === 'Final' && (
            <div>
              <label className="text-xs uppercase tracking-wide text-steel">Final tally overview</label>
              <textarea
                value={form.finalTallyOverview}
                onChange={(event) => updateField('finalTallyOverview', event.target.value)}
                className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[140px]"
                placeholder="End-of-year summary and tally overview."
              />
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" className="px-6 py-3 bg-gold text-white rounded-lg" disabled={isSubmitting}>
              {isSubmitting ? 'Submitting...' : 'Submit quarterly update'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// REVIEW EDITOR
// ============================================================================

const ReviewEditor = ({ areaLabel, quarter, review, onSave }) => {
  const buildState = (source) => ({
    statusAfterReview: source?.statusAfterReview || '',
    actionsRows: parseActionRows(source?.actionsAssigned),
    crossAreaImpacts: source?.crossAreaImpacts || '',
    areasImpacted: source?.areasImpacted || '',
    coordinationNeeded: source?.coordinationNeeded || '',
    priorityConfirmation: source?.priorityConfirmation || '',
    escalationFlag: source?.escalationFlag || '',
    reviewCompletedOn: normalizeDateInput(source?.reviewCompletedOn),
    nextCheckInDate: normalizeDateInput(source?.nextCheckInDate)
  });

  const [form, setForm] = useState(() => buildState(review));
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setForm(buildState(review));
  }, [review, areaLabel, quarter]);

  useEffect(() => {
    setIsEditing(false);
  }, [areaLabel, quarter]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateActionRow = (index, field, value) => {
    setForm((prev) => {
      const actionsRows = prev.actionsRows.map((row, idx) =>
        idx === index ? { ...row, [field]: value } : row
      );
      return { ...prev, actionsRows };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    const crossArea = form.crossAreaImpacts === 'Affects another area';
    const payload = {
      focusArea: areaLabel,
      quarter,
      statusAfterReview: form.statusAfterReview,
      actionsAssigned: serializeActionRows(form.actionsRows),
      crossAreaImpacts: form.crossAreaImpacts,
      areasImpacted: crossArea ? form.areasImpacted : '',
      coordinationNeeded: crossArea ? form.coordinationNeeded : '',
      priorityConfirmation: form.priorityConfirmation,
      escalationFlag: form.escalationFlag,
      reviewCompletedOn: form.reviewCompletedOn,
      nextCheckInDate: form.nextCheckInDate
    };

    try {
      await onSave(payload);
    } catch (error) {
      console.error('Failed to save review:', error);
      alert('Failed to save review. Please try again.');
    }
    setIsSaving(false);
  };

  const statusOptions = [
    'On track',
    'Minor adjustments needed',
    'Off track - intervention required'
  ];
  const crossAreaOptions = ['None', 'Affects another area'];
  const priorityOptions = ['Approved', 'Adjusted', 'Replaced'];
  const escalationOptions = [
    'No escalation needed',
    'Requires board attention',
    'Requires budget review',
    'Requires policy clarification'
  ];

  if (!isEditing) {
    const reviewItems = [
      { label: 'Status After Review', value: form.statusAfterReview },
      { label: 'Actions Assigned', value: serializeActionRows(form.actionsRows) },
      { label: 'Cross-Area Impacts', value: form.crossAreaImpacts },
      { label: 'Area(s) impacted', value: form.areasImpacted },
      { label: 'Coordination needed', value: form.coordinationNeeded },
      { label: 'Priority Confirmation (Next Quarter)', value: form.priorityConfirmation },
      { label: 'Escalation Flag', value: form.escalationFlag },
      { label: 'Review completed on', value: form.reviewCompletedOn },
      { label: 'Next check-in date', value: form.nextCheckInDate }
    ];
    const filledItems = reviewItems.filter((item) => item.value);

    return (
      <div className="bg-white rounded-3xl border border-stone-100 p-5 card-shadow quarter-card">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-steel">{quarter} review</div>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs text-ink"
          >
            Edit review
          </button>
        </div>
        {filledItems.length === 0 ? (
          <div className="mt-4 text-sm text-stone-600">No review submitted yet.</div>
        ) : (
          <div className="mt-4 space-y-2 text-sm text-stone-700">
            {filledItems.map((item) => (
              <div key={item.label}>
                <div className="text-xs uppercase tracking-wide text-steel">{item.label}</div>
                <div className="whitespace-pre-wrap">{item.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-stone-100 p-5 card-shadow quarter-card">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-steel">{quarter} review</div>
        <button
          type="button"
          onClick={() => setIsEditing(false)}
          className="px-3 py-1.5 border border-stone-200 rounded-lg text-xs text-ink"
        >
          Close
        </button>
      </div>
      <div className="mt-3 space-y-5 text-sm text-stone-700">
        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Status After Review</div>
          <div className="mt-2 space-y-2">
            {statusOptions.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${areaLabel}-${quarter}-status`}
                  value={option}
                  checked={form.statusAfterReview === option}
                  onChange={(event) => updateField('statusAfterReview', event.target.value)}
                  className="accent-clay"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Actions Assigned</div>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs uppercase tracking-wide text-steel">
            <span>Action</span>
            <span>Owner</span>
            <span>Deadline</span>
          </div>
          <div className="mt-2 space-y-2">
            {form.actionsRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={row.action}
                  onChange={(event) => updateActionRow(idx, 'action', event.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-lg"
                />
                <input
                  type="text"
                  value={row.owner}
                  onChange={(event) => updateActionRow(idx, 'owner', event.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-lg"
                />
                <input
                  type="text"
                  value={row.deadline}
                  onChange={(event) => updateActionRow(idx, 'deadline', event.target.value)}
                  className="px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Cross-Area Impacts</div>
          <div className="mt-2 space-y-2">
            {crossAreaOptions.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${areaLabel}-${quarter}-impact`}
                  value={option}
                  checked={form.crossAreaImpacts === option}
                  onChange={(event) => updateField('crossAreaImpacts', event.target.value)}
                  className="accent-clay"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
          {form.crossAreaImpacts === 'Affects another area' && (
            <div className="mt-3 grid grid-cols-1 gap-3">
              <div>
                <label className="text-xs uppercase tracking-wide text-steel">Area(s) impacted</label>
                <input
                  type="text"
                  value={form.areasImpacted}
                  onChange={(event) => updateField('areasImpacted', event.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wide text-steel">Coordination needed</label>
                <textarea
                  value={form.coordinationNeeded}
                  onChange={(event) => updateField('coordinationNeeded', event.target.value)}
                  className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg min-h-[90px]"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Priority Confirmation (Next Quarter)</div>
          <div className="mt-2 space-y-2">
            {priorityOptions.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${areaLabel}-${quarter}-priority`}
                  value={option}
                  checked={form.priorityConfirmation === option}
                  onChange={(event) => updateField('priorityConfirmation', event.target.value)}
                  className="accent-clay"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-steel">Escalation Flag</div>
          <div className="mt-2 space-y-2">
            {escalationOptions.map((option) => (
              <label key={option} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${areaLabel}-${quarter}-escalation`}
                  value={option}
                  checked={form.escalationFlag === option}
                  onChange={(event) => updateField('escalationFlag', event.target.value)}
                  className="accent-clay"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-steel">Review completed on</label>
            <input
              type="date"
              value={form.reviewCompletedOn}
              onChange={(event) => updateField('reviewCompletedOn', event.target.value)}
              className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-steel">Next check-in date</label>
            <input
              type="date"
              value={form.nextCheckInDate}
              onChange={(event) => updateField('nextCheckInDate', event.target.value)}
              className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            />
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-4 py-2 bg-clay text-white rounded-lg text-sm"
        >
          {isSaving ? 'Saving...' : 'Save review'}
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// VIEWS
// ============================================================================

const VisionCard = ({
  focusArea,
  vision,
  onSave,
  isSaving,
  hideLabel = false,
  containerClass = '',
  forceEditing,
  onEditToggle,
  hideEditButton = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(vision || '');
  const editing = typeof forceEditing === 'boolean' ? forceEditing : isEditing;

  useEffect(() => {
    if (!editing) {
      setDraft(vision || '');
    }
  }, [vision, editing]);

  const handleSave = () => {
    onSave(focusArea, draft);
    if (typeof forceEditing === 'boolean') {
      onEditToggle?.(false);
    } else {
      setIsEditing(false);
    }
  };

  return (
    <div className={`bg-white rounded-2xl p-5 border border-stone-100 card-shadow ${containerClass}`.trim()}>
      <div className="flex items-start justify-between gap-3">
        {!hideLabel && (
          <div className="text-xs uppercase tracking-wide text-steel">{focusArea}</div>
        )}
        <div className="flex items-center gap-2 text-xs">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (typeof forceEditing === 'boolean') {
                    onEditToggle?.(false);
                  } else {
                    setIsEditing(false);
                  }
                  setDraft(vision || '');
                }}
                className="px-2 py-1 border border-stone-200 rounded-lg"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-2 py-1 bg-gold text-white rounded-lg"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            !hideEditButton && (
              <button
                type="button"
                onClick={() => {
                  if (typeof forceEditing === 'boolean') {
                    onEditToggle?.(true);
                  } else {
                    setIsEditing(true);
                  }
                }}
                className="px-2 py-1 border border-stone-200 rounded-lg"
              >
                Edit
              </button>
            )
          )}
        </div>
      </div>
      {editing ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="w-full mt-3 px-3 py-2 border border-stone-200 rounded-lg text-sm min-h-[120px]"
          placeholder="Describe what success looks like in three years."
        />
      ) : (
        <div className="text-sm text-stone-700 mt-2 space-y-1">
          {vision
            ? String(vision)
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, idx) => (
                  <div key={`${focusArea}-vision-${idx}`} className="flex items-start gap-2">
                    <span className="text-gold mt-0.5">
                      <IconStar size={12} />
                    </span>
                    <span className="whitespace-pre-wrap">{line}</span>
                  </div>
                ))
            : <span>Add a three-year vision for this focus area.</span>}
        </div>
      )}
    </div>
  );
};

const FocusGoalForm = ({ focusArea, initialGoal, presetCategory, onSave, onCancel, isSaving }) => {
  const [form, setForm] = useState(() => ({
    id: initialGoal?.id || '',
    focusArea,
    goalTopic: 'Annual goal',
    annualGoals: initialGoal?.annualGoals || '',
    startDate: initialGoal?.startDate || '',
    dueDate: initialGoal?.dueDate || '',
    progress: initialGoal?.progress || STATUSES[0],
    category: initialGoal?.category || presetCategory || 'Annual goals',
    goalDetails: initialGoal?.goalDetails || '',
    goalLead: initialGoal?.goalLead || '',
    futureGoals: initialGoal?.futureGoals || ''
  }));

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSave({
      ...form,
      goalTopic: 'Annual goal',
      annualGoalsItems: []
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 bg-stone-50 rounded-2xl p-4 border border-stone-100">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-steel">Annual goal</label>
          <input
            type="text"
            value={form.annualGoals}
            onChange={(event) => updateField('annualGoals', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
            required
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Goal lead</label>
          <input
            type="text"
            value={form.goalLead}
            onChange={(event) => updateField('goalLead', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
          />
        </div>
        <div className="md:col-span-2">
          <textarea
            value={form.goalDetails}
            onChange={(event) => updateField('goalDetails', event.target.value)}
            className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[60px]"
            placeholder="Add details, notes, or key steps."
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Start date</label>
          <input
            type="date"
            value={normalizeDateInput(form.startDate)}
            onChange={(event) => updateField('startDate', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Due date</label>
          <input
            type="date"
            value={normalizeDateInput(form.dueDate)}
            onChange={(event) => updateField('dueDate', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-steel">Progress</label>
          <select
            value={form.progress}
            onChange={(event) => updateField('progress', event.target.value)}
            className="w-full mt-1 px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            {STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-stone-200 rounded-lg text-sm"
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-gold text-white rounded-lg text-sm"
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save goal'}
        </button>
      </div>
    </form>
  );
};

const FocusAreaCard = ({ focusArea, goals, vision, onSaveVision, isSavingVision, onSaveGoal, onDeleteGoal, isSaving, hideTitle }) => {
  const [editingGoal, setEditingGoal] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [pendingCategory, setPendingCategory] = useState('Annual goals');
  const [isVisionEditing, setIsVisionEditing] = useState(false);
  const annualGoals = useMemo(
    () => goals.filter((goal) => !goal.category || goal.category === 'Annual goals' || goal.category === 'Goals'),
    [goals]
  );
  const futureGoals = useMemo(
    () => goals.filter((goal) => goal.category === 'Future Goals'),
    [goals]
  );

  const startEdit = (goal) => {
    setIsAdding(false);
    setEditingGoal(goal);
    setPendingCategory(goal.category || 'Annual goals');
  };

  const startAdd = (category) => {
    setEditingGoal(null);
    setIsAdding(true);
    setPendingCategory(category);
  };

  const handleSave = (goal) => {
    onSaveGoal(goal);
    setEditingGoal(null);
    setIsAdding(false);
  };
  const handleSectionEdit = (section) => {
    const targets = section === 'annual' ? annualGoals : futureGoals;
    if (targets.length) {
      startEdit(targets[0]);
      return;
    }
    startAdd(section === 'annual' ? 'Annual goals' : 'Future Goals');
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-stone-100 card-shadow">
      {!hideTitle && (
        <div className="font-display text-xl text-ink">{focusArea}</div>
      )}
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-steel font-semibold">
          <span>Annual goals</span>
        </div>
        {annualGoals.length === 0 ? (
          <div className="mt-3 text-sm text-stone-600">No annual goals yet.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {annualGoals.map((goal) => (
              <div key={goal.id} className="border border-stone-100 rounded-xl p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="text-gold mt-0.5">
                        <IconStar size={12} />
                      </span>
                      <div className="font-semibold text-ink">{goal.annualGoals || 'Untitled goal'}</div>
                    </div>
                    {goal.goalDetails && (
                      <div className="text-xs text-stone-500 mt-2 whitespace-pre-wrap">
                        {goal.goalDetails}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                  <div className="space-x-2">
                    {goal.startDate ? <span>{`Start: ${formatDate(goal.startDate)}`}</span> : null}
                    {goal.dueDate ? <span>{`Due: ${formatDate(goal.dueDate)}`}</span> : null}
                  </div>
                  <div className="text-stone-600">{goal.progress || STATUSES[0]}</div>
                </div>
                {editingGoal?.id === goal.id && (
                  <FocusGoalForm
                    focusArea={focusArea}
                    initialGoal={editingGoal}
                    presetCategory={pendingCategory}
                    onSave={handleSave}
                    onCancel={() => { setIsAdding(false); setEditingGoal(null); }}
                    isSaving={isSaving}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-start">
          <button
            type="button"
            onClick={() => handleSectionEdit('annual')}
            className="px-2 py-1 border border-stone-200 rounded-lg text-xs"
          >
            Edit
          </button>
        </div>
      </div>
      <div className="mt-6 border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-steel font-semibold">
          <span>Future goals</span>
        </div>
        {futureGoals.length === 0 ? (
          <div className="mt-3 text-sm text-stone-600">No future goals yet.</div>
        ) : (
          <div className="mt-3 space-y-3">
            {futureGoals.map((goal) => (
              <div key={goal.id} className="border border-stone-100 rounded-xl p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="text-gold mt-0.5">
                        <IconStar size={12} />
                      </span>
                      <div className="font-semibold text-ink">{goal.annualGoals || 'Untitled goal'}</div>
                    </div>
                    {goal.goalDetails && (
                      <div className="text-xs text-stone-500 mt-2 whitespace-pre-wrap">
                        {goal.goalDetails}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-stone-500">
                  <div className="space-x-2">
                    {goal.startDate ? <span>{`Start: ${formatDate(goal.startDate)}`}</span> : null}
                    {goal.dueDate ? <span>{`Due: ${formatDate(goal.dueDate)}`}</span> : null}
                  </div>
                  <div className="text-stone-600">{goal.progress || STATUSES[0]}</div>
                </div>
                {editingGoal?.id === goal.id && (
                  <FocusGoalForm
                    focusArea={focusArea}
                    initialGoal={editingGoal}
                    presetCategory={pendingCategory}
                    onSave={handleSave}
                    onCancel={() => { setIsAdding(false); setEditingGoal(null); }}
                    isSaving={isSaving}
                  />
                )}
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 flex items-center justify-start">
          <button
            type="button"
            onClick={() => handleSectionEdit('future')}
            className="px-2 py-1 border border-stone-200 rounded-lg text-xs"
          >
            Edit
          </button>
        </div>
      </div>
      <div className="mt-6 border-t border-stone-200 pt-4">
        <div className="flex items-center justify-between text-xs uppercase tracking-wide text-steel font-semibold">
          <span>Three-year vision</span>
        </div>
        <div className="mt-3">
          <VisionCard
            focusArea={focusArea}
            vision={vision || ''}
            onSave={onSaveVision}
            isSaving={isSavingVision}
            hideLabel
            hideEditButton
            forceEditing={isVisionEditing}
            onEditToggle={setIsVisionEditing}
            containerClass="bg-stone-50 border border-stone-100 rounded-xl p-4 shadow-none"
          />
        </div>
        <div className="mt-3 flex items-center justify-start">
          <button
            type="button"
            onClick={() => setIsVisionEditing(true)}
            className="px-2 py-1 border border-stone-200 rounded-lg text-xs"
          >
            Edit
          </button>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-2">
        <select
          value={pendingCategory}
          onChange={(event) => setPendingCategory(event.target.value)}
          className="px-2 py-1 border border-stone-200 rounded-lg text-xs bg-white"
        >
          <option value="Annual goals">Annual goals</option>
          <option value="Future Goals">Future goals</option>
        </select>
        <button
          type="button"
          onClick={() => startAdd(pendingCategory)}
          className="px-2 py-1 border border-stone-200 rounded-lg text-xs"
        >
          Add goal
        </button>
      </div>
      {isAdding && !editingGoal && (
        <FocusGoalForm
          focusArea={focusArea}
          initialGoal={editingGoal}
          presetCategory={pendingCategory}
          onSave={handleSave}
          onCancel={() => { setIsAdding(false); setEditingGoal(null); }}
          isSaving={isSaving}
        />
      )}
    </div>
  );
};

const FocusAreasView = ({ goals, visionStatements, onSaveVision, isSavingVision, onSaveGoal, onDeleteGoal, isSaving, focusFilter }) => {
  const areas = focusFilter ? FOCUS_AREAS.filter((area) => area === focusFilter) : FOCUS_AREAS;
  return (
    <div className="max-w-6xl mx-auto fade-up">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-3xl text-ink">Track goals by strategic focus areas</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {areas.map((focusArea) => (
          <FocusAreaCard
            key={focusArea}
            focusArea={focusArea}
            goals={goals.filter((goal) => goal.focusArea === focusArea)}
            vision={visionStatements?.find((item) => item.focusArea === focusArea)?.threeYearVision || ''}
            onSaveVision={onSaveVision}
            isSavingVision={isSavingVision}
            onSaveGoal={onSaveGoal}
            onDeleteGoal={onDeleteGoal}
            isSaving={isSaving}
          />
        ))}
      </div>
    </div>
  );
};

const HoneybookMessagesView = ({ onBack }) => (
  <div className="max-w-6xl mx-auto fade-up">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-steel">Voicemails</div>
        <h2 className="font-display text-3xl text-ink">Honeybook Messages</h2>
        <p className="text-sm text-stone-500 mt-2">Live Google Sheet with a cleaner workspace.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl border border-stone-200 text-sm text-ink bg-white hover:border-gold/60 transition"
        >
          <span className="inline-flex items-center gap-2">
            <IconBack size={16} />
            Back to Dashboard
          </span>
        </button>
        <a
          href={HONEYBOOK_MESSAGES_URL}
          target="_blank"
          rel="noreferrer"
          className="px-4 py-2 rounded-xl bg-gold text-white text-sm shadow hover:opacity-90 transition"
        >
          Open in Google Sheets
        </a>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6">
      <div className="glass rounded-3xl border border-stone-100 card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-white/80">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Live sheet</div>
            <div className="text-sm text-stone-500">Updates as you edit the spreadsheet.</div>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-steel bg-stone-100 px-3 py-1 rounded-full">
            Public
          </span>
        </div>
        <div className="h-[72vh] md:h-[84vh]">
          <iframe
            title="Honeybook Messages"
            src={HONEYBOOK_MESSAGES_EMBED_URL}
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  </div>
);

const VoicemailsView = ({ onBack }) => (
  <div className="max-w-6xl mx-auto fade-up">
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <div className="text-xs uppercase tracking-[0.3em] text-steel">Voicemails</div>
        <h2 className="font-display text-3xl text-ink">Voicemail Log</h2>
        <p className="text-sm text-stone-500 mt-2">Live sheet in a calmer layout.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl border border-stone-200 text-sm text-ink bg-white hover:border-gold/60 transition"
        >
          <span className="inline-flex items-center gap-2">
            <IconBack size={16} />
            Back to Dashboard
          </span>
        </button>
      </div>
    </div>

    <div className="grid grid-cols-1 gap-6">
      <div className="glass rounded-3xl border border-stone-100 card-shadow overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-white/80">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Live sheet</div>
            <div className="text-sm text-stone-500">Updates as you edit the spreadsheet.</div>
          </div>
          <span className="text-[10px] uppercase tracking-wide text-steel bg-stone-100 px-3 py-1 rounded-full">
            Public
          </span>
        </div>
        <div className="h-[72vh] md:h-[84vh]">
          <iframe
            title="Voicemails"
            src={VOICEMAILS_EMBED_URL}
            className="w-full h-full border-0 bg-white"
          />
        </div>
      </div>
    </div>
  </div>
);

const Calendar = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);
const Upload = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
    <polyline points="17 8 12 3 7 8"></polyline>
    <line x1="12" y1="3" x2="12" y2="15"></line>
  </svg>
);
const Plus = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="5" x2="12" y2="19"></line>
    <line x1="5" y1="12" x2="19" y2="12"></line>
  </svg>
);
const Clock = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);
const CheckCircle2 = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9 12l2 2 4-4"></path>
  </svg>
);

const EventManagementApp = () => {
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(null);
  const [activeTab, setActiveTab] = useState('marketing');
  const touchStartX = useRef(null);
  const [newsletterData, setNewsletterData] = useState({});
  const [showNewsletterModal, setShowNewsletterModal] = useState(false);
  const [newsletterMonth, setNewsletterMonth] = useState(new Date().getMonth());
  const [postingData, setPostingData] = useState({});
  const [showPostingModal, setShowPostingModal] = useState(false);
  const [postingMonth, setPostingMonth] = useState(new Date().getMonth());
  const [pressReleaseData, setPressReleaseData] = useState({});
  const [showPressReleaseModal, setShowPressReleaseModal] = useState(false);
  const [pressReleaseMonth, setPressReleaseMonth] = useState(new Date().getMonth());
  const [bookingsData, setBookingsData] = useState([]);
  const [bookingsCount, setBookingsCount] = useState(0);
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbzcuMhZ1h15zP7IgYhyCBChgkx_mbe23G6756V2_lHNT1grfgKR-AuZxbHt3t806h8-/exec';
  const STORAGE_KEY = 'nsh-events-cache-v1';
  const FLYER_KEY = 'nsh-event-flyers-v1';
  const NEWSLETTER_STORAGE_KEY = 'nsh-newsletter-cache-v1';
  const POSTING_STORAGE_KEY = 'nsh-posting-schedule-v1';
  const PRESS_RELEASE_STORAGE_KEY = 'nsh-press-release-cache-v1';
  const BOOKINGS_STORAGE_KEY = 'nsh-bookings-cache-v1';

  const monthLabels = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
  ];

  const newsletterFields = [
    { id: 'mainFeature', label: 'Main Feature' },
    { id: 'mainUpcomingEvent', label: 'Main Upcoming Event' },
    { id: 'eventRecaps', label: 'Event Recaps / Blogs' },
    { id: 'volunteerHours', label: 'Volunteer Monthly Hours' },
    { id: 'donationNeeds', label: 'Donation Needs' },
    { id: 'other', label: 'Other' }
  ];

  const pressReleaseFields = [
    { id: 'headline', label: 'Headline' },
    { id: 'summary', label: 'Summary / Angle' },
    { id: 'keyDetails', label: 'Key Details' },
    { id: 'outlets', label: 'Target Outlets' },
    { id: 'link', label: 'Link' },
    { id: 'notes', label: 'Notes' }
  ];

  const postingSchedule = [
    {
      week: 'First Week',
      items: [
        { id: 'w1-mon', day: 'Monday', prompt: 'Wedding posting + scheduling for the month' },
        { id: 'w1-tue', day: 'Tuesday', prompt: 'Testimonial or small history' },
        { id: 'w1-wed', day: 'Wednesday', prompt: 'OPEN' },
        { id: 'w1-thu', day: 'Thursday', prompt: 'Monthly email send out' },
        { id: 'w1-fri', day: 'Friday', prompt: 'Volunteer outreach - events' },
        { id: 'w1-other', day: 'Other', prompt: 'Other' }
      ]
    },
    {
      week: 'Second Week',
      items: [
        { id: 'w2-mon', day: 'Monday', prompt: 'Sponsor spotlight' },
        { id: 'w2-tue', day: 'Tuesday', prompt: 'Upcoming event / tours' },
        { id: 'w2-thu', day: 'Thursday', prompt: 'Planning update' },
        { id: 'w2-fri', day: 'Friday', prompt: 'Volunteer outreach - restoration' },
        { id: 'w2-other', day: 'Other', prompt: 'Other' }
      ]
    },
    {
      week: 'Third Week',
      items: [
        { id: 'w3-mon', day: 'Monday', prompt: 'Upcoming event or wedding' },
        { id: 'w3-tue', day: 'Tuesday', prompt: 'OPEN' },
        { id: 'w3-thu', day: 'Thursday', prompt: 'History update' },
        { id: 'w3-fri', day: 'Friday', prompt: 'Volunteer outreach - garden' },
        { id: 'w3-other', day: 'Other', prompt: 'Other' }
      ]
    },
    {
      week: 'Fourth Week',
      items: [
        { id: 'w4-mon', day: 'Monday', prompt: 'OPEN' },
        { id: 'w4-tue', day: 'Tuesday', prompt: 'Restoration video' },
        { id: 'w4-thu', day: 'Thursday', prompt: 'Development / board update' },
        { id: 'w4-fri', day: 'Friday', prompt: 'Volunteer outreach - docents' },
        { id: 'w4-other', day: 'Other', prompt: 'Other' }
      ]
    }
  ];

  const postingFields = postingSchedule.flatMap(section => section.items);
  const postingLabelMap = postingFields.reduce((acc, field) => {
    acc[`${field.day} - ${field.prompt}`] = field.id;
    return acc;
  }, {});
  const postingWeekMaps = postingSchedule.map(section =>
    section.items.reduce((acc, item) => {
      acc[`${item.day} - ${item.prompt}`] = item.id;
      return acc;
    }, {})
  );

  const buildPostingEntriesText = (entries) => {
    const lines = [];
    postingSchedule.forEach(section => {
      const filled = section.items
        .map(item => {
          const value = (entries?.[item.id] || '').trim();
          if (!value) return null;
          return `${item.day} - ${item.prompt}: ${value}`;
        })
        .filter(Boolean);
      if (filled.length) {
        lines.push(section.week, ...filled, '');
      }
    });
    return lines.join('\n').trim();
  };

  const buildPostingWeekText = (section, entries) => {
    const lines = section.items
      .map(item => {
        const value = (entries?.[item.id] || '').trim();
        if (!value) return null;
        return `${item.day} - ${item.prompt}: ${value}`;
      })
      .filter(Boolean);
    return lines.join('\n').trim();
  };

  const parsePostingWeekText = (raw, weekIndex) => {
    if (!raw) return {};
    const lines = String(raw).split('\n');
    const labelMap = postingWeekMaps[weekIndex] || {};
    return lines.reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed) return acc;
      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) return acc;
      const label = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      const mappedId = labelMap[label];
      if (mappedId) {
        acc[mappedId] = value;
      }
      return acc;
    }, {});
  };

  const parsePostingEntriesText = (raw) => {
    if (!raw) return {};
    const lines = String(raw).split('\n');
    return lines.reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed) return acc;
      if (/week$/i.test(trimmed)) return acc;
      if (trimmed.includes('|')) {
        const parts = trimmed.split('|');
        const id = parts[0]?.trim();
        if (id && postingFields.some(field => field.id === id)) {
          const value = parts.slice(2).join('|').trim();
          acc[id] = value;
          return acc;
        }
      }
      const separatorIndex = trimmed.indexOf(':');
      if (separatorIndex === -1) return acc;
      const label = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      const mappedId = postingLabelMap[label];
      if (mappedId) {
        acc[mappedId] = value;
      }
      return acc;
    }, {});
  };

  const marketingChecklist = [
    { id: 'press-release', label: 'Create Press Release' },
    { id: 'flyer', label: 'Create Flyer' },
    { id: 'website', label: 'Make Event Page on Website' },
    { id: 'email', label: 'Send Email Blast' },
    { id: 'yubanet', label: 'YubaNet (Press Release Only - if worthy)', special: true, optional: true },
    { id: 'go-nv', label: 'Go Nevada County Calendar' },
    { id: 'arts', label: 'Arts Council Calendar' },
    { id: 'chamber', label: 'Grass Valley Chamber Newsletter (2 weeks prior)', special: true, optional: true },
    { id: 'kvmr', label: 'KVMR Calendar' },
    { id: 'fb-event', label: 'Facebook Event Page' },
    { id: 'fb-nsh', label: 'NSH Facebook Page' },
    { id: 'ig-nsh', label: 'NSH Instagram Page' },
    { id: 'nv-peeps', label: 'Nevada County Peeps' },
    { id: 'gv-peeps', label: 'Grass Valley Peeps' },
    { id: 'lake-wildwood', label: 'Lake Wildwood Page' },
    { id: 'nextdoor', label: 'NextDoor' },
    { id: 'union-cal', label: 'Union Event Calendar' },
    { id: 'union-ad', label: 'Union Advertisement ($270 - rare)', special: true, optional: true },
    { id: 'other', label: 'Other', optional: true }
  ];

  const planningChecklist = [
    { id: 'event-type', label: 'Event type' },
    { id: 'budget-confirmed', label: 'Budget confirmed' },
    { id: 'layout-finalized', label: 'Layout finalized' },
    { id: 'av-needs', label: 'AV needs' },
    { id: 'power-checked', label: 'Power checked' },
    { id: 'rentals-ordered', label: 'Rentals ordered' },
    { id: 'food-plan', label: 'Food plan' },
    { id: 'alcohol-license', label: 'Alcohol license (if applicable)' },
    { id: 'volunteer-roles', label: 'Volunteer roles assigned' },
    { id: 'staff-lead', label: 'Staff lead assigned' },
    { id: 'checkin-ready', label: 'Check-in system ready' },
    { id: 'program-ready', label: 'Program / agenda printed or shared' },
    { id: 'signage-ready', label: 'Signage ready' }
  ];

  const [newEvent, setNewEvent] = useState({
    name: '',
    date: '',
    time: '',
    isTBD: false,
    goals: '',
    outcomes: '',
    advertising: '',
    totalSpent: '',
    totalEarned: '',
    volunteers: '',
    targetAttendance: '',
    currentRSVPs: '',
    flyerImage: null,
    checklist: {},
    planningChecklist: {},
    planningNotes: '',
    notes: '',
    postEventAttendance: '',
    postEventNotes: ''
  });

  const loadEvents = async () => {
    if (!SHEETS_API_URL) return;
    try {
      const response = await fetch(`${SHEETS_API_URL}?action=list`);
      if (!response.ok) {
        throw new Error(`Sheets load failed: ${response.status}`);
      }
      const data = await response.json();
      const loadedEvents = Array.isArray(data.events) ? data.events : [];
      const storedFlyers = JSON.parse(localStorage.getItem(FLYER_KEY) || '{}');
      const cached = localStorage.getItem(STORAGE_KEY);
      const cachedEvents = cached ? JSON.parse(cached) : [];
      const cachedMap = Array.isArray(cachedEvents)
        ? cachedEvents.reduce((acc, event) => {
            if (event && event.id) acc[event.id] = event;
            return acc;
          }, {})
        : {};
      const normalizedEvents = loadedEvents.map(event => {
        const cachedEvent = cachedMap[event.id];
        const parsedChecklist = typeof event.checklist === 'string'
          ? JSON.parse(event.checklist || '{}')
          : (event.checklist || {});
        const parsedPlanning = typeof event.planningChecklist === 'string'
          ? JSON.parse(event.planningChecklist || '{}')
          : (event.planningChecklist || {});
        const cachedPlanning = cachedEvent && cachedEvent.planningChecklist ? cachedEvent.planningChecklist : null;
        const planningChecklist = Object.keys(parsedPlanning || {}).length === 0 && cachedPlanning
          ? cachedPlanning
          : parsedPlanning;
        const planningNotes = event.planningNotes || (cachedEvent ? cachedEvent.planningNotes || '' : '');
        const mergedEvent = {
          ...event,
          date: normalizeDateForInput(event.date),
          time: normalizeTimeForInput(event.time),
          checklist: parsedChecklist,
          planningChecklist,
          planningNotes,
          flyerImage: storedFlyers[event.id] || null
        };
        if (cachedPlanning && Object.keys(parsedPlanning || {}).length === 0) {
          saveEvent(mergedEvent);
        }
        return mergedEvent;
      });
      const filteredEvents = normalizedEvents.filter(event => {
        if (!event) return false;
        const hasName = String(event.name || '').trim().length > 0;
        const hasDate = String(event.date || '').trim().length > 0;
        const hasCreated = String(event.createdAt || '').trim().length > 0;
        const hasCounts = String(event.targetAttendance || '').trim().length > 0
          || String(event.currentRSVPs || '').trim().length > 0;
        const hasNotes = String(event.notes || '').trim().length > 0
          || String(event.planningNotes || '').trim().length > 0;
        const hasChecklist = event.checklist && Object.keys(event.checklist).length > 0;
        const hasPlanning = event.planningChecklist && Object.keys(event.planningChecklist).length > 0;
        return hasName || hasDate || hasCreated || hasCounts || hasNotes || hasChecklist || hasPlanning;
      });
      setEvents(filteredEvents);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredEvents));
    } catch (error) {
      console.error('Failed to load events from Sheets', error);
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        try {
          const cachedEvents = JSON.parse(cached);
          if (Array.isArray(cachedEvents)) {
            setEvents(cachedEvents);
          }
        } catch (parseError) {
          console.error('Failed to parse cached events', parseError);
        }
      }
    }
  };

  const normalizeNewsletterEntry = (entry, monthIndex) => ({
    month: monthIndex + 1,
    published: Boolean(entry?.published),
    mainFeature: entry?.mainFeature || '',
    mainUpcomingEvent: entry?.mainUpcomingEvent || '',
    eventRecaps: entry?.eventRecaps || '',
    volunteerHours: entry?.volunteerHours || '',
    donationNeeds: entry?.donationNeeds || '',
    other: entry?.other || ''
  });

  const normalizePressReleaseEntry = (entry, monthIndex) => ({
    month: monthIndex + 1,
    published: Boolean(entry?.published),
    headline: entry?.headline || '',
    summary: entry?.summary || '',
    keyDetails: entry?.keyDetails || '',
    outlets: entry?.outlets || '',
    link: entry?.link || '',
    notes: entry?.notes || ''
  });

  const normalizePostingEntry = (entry, monthIndex) => {
    let parsedEntries = {};
    if (entry) {
      [entry.week1, entry.week2, entry.week3, entry.week4].forEach((raw, index) => {
        parsedEntries = { ...parsedEntries, ...parsePostingWeekText(raw, index) };
      });
      if (entry.entries) {
        let legacyEntries = {};
        if (typeof entry.entries === 'string') {
          try {
            legacyEntries = JSON.parse(entry.entries || '{}');
          } catch (error) {
            legacyEntries = parsePostingEntriesText(entry.entries);
          }
        } else {
          legacyEntries = entry.entries;
        }
        Object.keys(legacyEntries || {}).forEach((key) => {
          if (!parsedEntries[key]) {
            parsedEntries[key] = legacyEntries[key];
          }
        });
      }
    }
    const entries = postingFields.reduce((acc, field) => {
      acc[field.id] = parsedEntries[field.id] || '';
      return acc;
    }, {});
    return {
      month: monthIndex + 1,
      completed: Boolean(entry?.completed),
      entries
    };
  };

  const persistNewsletter = (nextData) => {
    localStorage.setItem(NEWSLETTER_STORAGE_KEY, JSON.stringify(nextData));
  };

  const persistPosting = (nextData) => {
    localStorage.setItem(POSTING_STORAGE_KEY, JSON.stringify(nextData));
  };

  const persistPressReleases = (nextData) => {
    localStorage.setItem(PRESS_RELEASE_STORAGE_KEY, JSON.stringify(nextData));
  };

  const persistBookings = (nextData) => {
    localStorage.setItem(BOOKINGS_STORAGE_KEY, JSON.stringify(nextData));
  };

  const loadNewsletter = async () => {
    if (!SHEETS_API_URL) return;
    try {
      const response = await fetch(`${SHEETS_API_URL}?action=newsletter_list`);
      if (!response.ok) {
        throw new Error(`Newsletter load failed: ${response.status}`);
      }
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const mapped = entries.reduce((acc, entry) => {
        const monthValue = parseInt(entry.month, 10);
        if (!Number.isNaN(monthValue) && monthValue >= 1 && monthValue <= 12) {
          acc[monthValue - 1] = normalizeNewsletterEntry(entry, monthValue - 1);
        }
        return acc;
      }, {});
      setNewsletterData(mapped);
      persistNewsletter(mapped);
    } catch (error) {
      console.error('Failed to load newsletter data', error);
      const cached = localStorage.getItem(NEWSLETTER_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setNewsletterData(parsed);
          }
        } catch (parseError) {
          console.error('Failed to parse cached newsletter data', parseError);
        }
      }
    }
  };

  const loadPosting = async () => {
    if (!SHEETS_API_URL) return;
    try {
      const response = await fetch(`${SHEETS_API_URL}?action=posting_list`);
      if (!response.ok) {
        throw new Error(`Posting load failed: ${response.status}`);
      }
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const mapped = entries.reduce((acc, entry) => {
        const monthValue = parseInt(entry.month, 10);
        if (!Number.isNaN(monthValue) && monthValue >= 1 && monthValue <= 12) {
          acc[monthValue - 1] = normalizePostingEntry(entry, monthValue - 1);
        }
        return acc;
      }, {});
      setPostingData(mapped);
      persistPosting(mapped);
    } catch (error) {
      console.error('Failed to load posting schedule', error);
      const cached = localStorage.getItem(POSTING_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setPostingData(parsed);
          }
        } catch (parseError) {
          console.error('Failed to parse cached posting schedule', parseError);
        }
      }
    }
  };

  const loadPressReleases = async () => {
    if (!SHEETS_API_URL) return;
    try {
      const response = await fetch(`${SHEETS_API_URL}?action=press_release_list`);
      if (!response.ok) {
        throw new Error(`Press release load failed: ${response.status}`);
      }
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const mapped = entries.reduce((acc, entry) => {
        const monthValue = parseInt(entry.month, 10);
        if (!Number.isNaN(monthValue) && monthValue >= 1 && monthValue <= 12) {
          acc[monthValue - 1] = normalizePressReleaseEntry(entry, monthValue - 1);
        }
        return acc;
      }, {});
      setPressReleaseData(mapped);
      persistPressReleases(mapped);
    } catch (error) {
      console.error('Failed to load press release data', error);
      const cached = localStorage.getItem(PRESS_RELEASE_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setPressReleaseData(parsed);
          }
        } catch (parseError) {
          console.error('Failed to parse cached press release data', parseError);
        }
      }
    }
  };

  const loadBookings = async () => {
    if (!SHEETS_API_URL) return;
    try {
      const response = await fetch(`${SHEETS_API_URL}?action=bookings_list`);
      if (!response.ok) {
        throw new Error(`Bookings load failed: ${response.status}`);
      }
      const data = await response.json();
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const count = Number.isFinite(data.count) ? data.count : entries.length;
      setBookingsData(entries);
      setBookingsCount(count);
      persistBookings(entries);
    } catch (error) {
      console.error('Failed to load bookings data', error);
      const cached = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            setBookingsData(parsed);
            setBookingsCount(parsed.length);
          }
        } catch (parseError) {
          console.error('Failed to parse cached bookings data', parseError);
        }
      }
    }
  };

  const saveNewsletterEntry = async (monthIndex, entry) => {
    if (!SHEETS_API_URL) return;
    const payload = normalizeNewsletterEntry(entry, monthIndex);
    try {
      await fetch(SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'newsletter_upsert', entry: payload })
      });
    } catch (error) {
      console.error('Failed to save newsletter entry', error);
    }
  };

  const savePostingEntry = async (monthIndex, entry) => {
    if (!SHEETS_API_URL) return;
    const normalized = normalizePostingEntry(entry, monthIndex);
    const payload = {
      month: normalized.month,
      completed: normalized.completed,
      week1: buildPostingWeekText(postingSchedule[0], normalized.entries),
      week2: buildPostingWeekText(postingSchedule[1], normalized.entries),
      week3: buildPostingWeekText(postingSchedule[2], normalized.entries),
      week4: buildPostingWeekText(postingSchedule[3], normalized.entries),
      entries: buildPostingEntriesText(normalized.entries)
    };
    try {
      await fetch(SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'posting_upsert', entry: payload })
      });
    } catch (error) {
      console.error('Failed to save posting schedule', error);
    }
  };

  const savePressReleaseEntry = async (monthIndex, entry) => {
    if (!SHEETS_API_URL) return;
    const payload = normalizePressReleaseEntry(entry, monthIndex);
    try {
      await fetch(SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'press_release_upsert', entry: payload })
      });
    } catch (error) {
      console.error('Failed to save press release entry', error);
    }
  };

  const saveBookingEntry = async (entry) => {
    if (!SHEETS_API_URL) return;
    try {
      await fetch(SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'bookings_update', entry: entry })
      });
    } catch (error) {
      console.error('Failed to save booking update', error);
    }
  };

  const updateNewsletterField = (monthIndex, field, value) => {
    setNewsletterData(prev => {
      const nextEntry = {
        ...normalizeNewsletterEntry(prev[monthIndex], monthIndex),
        [field]: value
      };
      const nextData = { ...prev, [monthIndex]: nextEntry };
      persistNewsletter(nextData);
      saveNewsletterEntry(monthIndex, nextEntry);
      return nextData;
    });
  };

  const updatePostingEntry = (monthIndex, fieldId, value) => {
    setPostingData(prev => {
      const current = normalizePostingEntry(prev[monthIndex], monthIndex);
      const nextEntry = {
        ...current,
        entries: {
          ...current.entries,
          [fieldId]: value
        }
      };
      const nextData = { ...prev, [monthIndex]: nextEntry };
      persistPosting(nextData);
      savePostingEntry(monthIndex, nextEntry);
      return nextData;
    });
  };

  const updatePressReleaseField = (monthIndex, field, value) => {
    setPressReleaseData(prev => {
      const nextEntry = {
        ...normalizePressReleaseEntry(prev[monthIndex], monthIndex),
        [field]: value
      };
      const nextData = { ...prev, [monthIndex]: nextEntry };
      persistPressReleases(nextData);
      savePressReleaseEntry(monthIndex, nextEntry);
      return nextData;
    });
  };

  const toggleNewsletterPublished = (monthIndex) => {
    setNewsletterData(prev => {
      const current = normalizeNewsletterEntry(prev[monthIndex], monthIndex);
      const nextEntry = { ...current, published: !current.published };
      const nextData = { ...prev, [monthIndex]: nextEntry };
      persistNewsletter(nextData);
      saveNewsletterEntry(monthIndex, nextEntry);
      return nextData;
    });
  };

  const togglePressReleasePublished = (monthIndex) => {
    setPressReleaseData(prev => {
      const current = normalizePressReleaseEntry(prev[monthIndex], monthIndex);
      const nextEntry = { ...current, published: !current.published };
      const nextData = { ...prev, [monthIndex]: nextEntry };
      persistPressReleases(nextData);
      savePressReleaseEntry(monthIndex, nextEntry);
      return nextData;
    });
  };

  const togglePostingComplete = (monthIndex) => {
    setPostingData(prev => {
      const current = normalizePostingEntry(prev[monthIndex], monthIndex);
      const nextEntry = { ...current, completed: !current.completed };
      const nextData = { ...prev, [monthIndex]: nextEntry };
      persistPosting(nextData);
      savePostingEntry(monthIndex, nextEntry);
      return nextData;
    });
  };

  const updateBookingField = (rowIndex, field, value) => {
    setBookingsData(prev => {
      const nextData = prev.map(entry => {
        if (entry.rowIndex !== rowIndex) return entry;
        return { ...entry, [field]: value };
      });
      persistBookings(nextData);
      const updated = nextData.find(entry => entry.rowIndex === rowIndex);
      if (updated) {
        saveBookingEntry({
          rowIndex: updated.rowIndex,
          photoPermission: Boolean(updated.photoPermission),
          link: updated.link || '',
          posted: Boolean(updated.posted)
        });
      }
      return nextData;
    });
  };

  const persistEvents = (nextEvents) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEvents));
  };

  const persistFlyerImage = (eventId, flyerImage) => {
    if (!eventId || !flyerImage) return;
    const stored = JSON.parse(localStorage.getItem(FLYER_KEY) || '{}');
    stored[eventId] = flyerImage;
    localStorage.setItem(FLYER_KEY, JSON.stringify(stored));
  };

  const removeFlyerImage = (eventId) => {
    const stored = JSON.parse(localStorage.getItem(FLYER_KEY) || '{}');
    if (stored[eventId]) {
      delete stored[eventId];
      localStorage.setItem(FLYER_KEY, JSON.stringify(stored));
    }
  };

  const saveEvent = async (event) => {
    if (!SHEETS_API_URL) return;
    const payloadEvent = {
      ...event,
      checklist: typeof event.checklist === 'string' ? event.checklist : JSON.stringify(event.checklist || {}),
      planningChecklist: typeof event.planningChecklist === 'string'
        ? event.planningChecklist
        : JSON.stringify(event.planningChecklist || {}),
      planningNotes: event.planningNotes || ''
    };
    try {
      await fetch(SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'upsert', event: payloadEvent })
      });
    } catch (error) {
      console.error('Failed to save event to Sheets', error);
    }
  };

  const deleteEvent = async (eventId) => {
    const nextEvents = events.filter(event => event.id !== eventId);
    setEvents(nextEvents);
    persistEvents(nextEvents);
    setSelectedEvent(null);
    removeFlyerImage(eventId);
    if (!SHEETS_API_URL) return;
    try {
      await fetch(SHEETS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete', id: eventId })
      });
    } catch (error) {
      console.error('Failed to delete event from Sheets', error);
    }
  };

  useEffect(() => {
    // Cache-first: show cached data instantly, then refresh from network
    try {
      const cachedEvents = localStorage.getItem(STORAGE_KEY);
      if (cachedEvents) {
        const parsed = JSON.parse(cachedEvents);
        if (Array.isArray(parsed)) setEvents(parsed);
      }
    } catch (e) {}
    try {
      const cachedNewsletter = localStorage.getItem(NEWSLETTER_STORAGE_KEY);
      if (cachedNewsletter) {
        const parsed = JSON.parse(cachedNewsletter);
        if (parsed && typeof parsed === 'object') setNewsletterData(parsed);
      }
    } catch (e) {}
    try {
      const cachedPosting = localStorage.getItem(POSTING_STORAGE_KEY);
      if (cachedPosting) {
        const parsed = JSON.parse(cachedPosting);
        if (parsed && typeof parsed === 'object') setPostingData(parsed);
      }
    } catch (e) {}
    try {
      const cachedPressReleases = localStorage.getItem(PRESS_RELEASE_STORAGE_KEY);
      if (cachedPressReleases) {
        const parsed = JSON.parse(cachedPressReleases);
        if (parsed && typeof parsed === 'object') setPressReleaseData(parsed);
      }
    } catch (e) {}
    try {
      const cachedBookings = localStorage.getItem(BOOKINGS_STORAGE_KEY);
      if (cachedBookings) {
        const parsed = JSON.parse(cachedBookings);
        if (Array.isArray(parsed)) {
          setBookingsData(parsed);
          setBookingsCount(parsed.length);
        }
      }
    } catch (e) {}

    // Then refresh from network in background
    loadEvents();
    loadNewsletter();
    loadPosting();
    loadPressReleases();
    loadBookings();
  }, []);

  const calculateDaysUntil = (dateString) => {
    if (!dateString) return null;
    const eventDate = new Date(dateString);
    const today = new Date();
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getProgressPercentage = (current, target) => {
    if (!target || target === 0) return 0;
    return Math.round((current / target) * 100);
  };

  const getChecklistProgress = (checklist) => {
    const requiredItems = marketingChecklist.filter(item => !item.optional);
    if (!requiredItems.length) return 0;
    const completed = requiredItems.filter(item => checklist?.[item.id]).length;
    return Math.round((completed / requiredItems.length) * 100);
  };

  const getPlanningProgress = (planning) => {
    const completed = Object.values(planning || {}).filter(item => item && item.done).length;
    if (!planningChecklist.length) return 0;
    return Math.round((completed / planningChecklist.length) * 100);
  };

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'text-emerald-600';
    if (percentage >= 70) return 'text-stone-600';
    return 'text-stone-700';
  };

  const getStatusLabel = (percentage) => {
    if (percentage >= 90) return 'On track';
    if (percentage >= 70) return 'Slightly behind';
    return 'Needs attention';
  };

  const getChecklistCompletion = (checklist) => {
    const requiredItems = marketingChecklist.filter(item => !item.optional);
    const completed = requiredItems.filter(item => checklist?.[item.id]).length;
    return `${completed}/${requiredItems.length}`;
  };

  const getPlanningCompletion = (planning) => {
    const completed = Object.values(planning || {}).filter(item => item && item.done).length;
    return `${completed}/${planningChecklist.length}`;
  };

  const getPostingCompletedCount = (entries) =>
    postingFields.filter(field => (entries?.[field.id] || '').trim()).length;

  const normalizeDateForInput = (value) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

  const normalizeTimeForInput = (value) => {
    if (!value) return '';
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    const hhmmss = value.match(/^(\d{1,2}):(\d{2}):\d{2}$/);
    if (hhmmss) {
      return `${hhmmss[1].padStart(2, '0')}:${hhmmss[2]}`;
    }
    const ampm = value.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
    if (ampm) {
      let hours = parseInt(ampm[1], 10);
      const minutes = ampm[2];
      const isPm = ampm[3].toLowerCase() === 'pm';
      if (isPm && hours < 12) hours += 12;
      if (!isPm && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }
    return '';
  };

  const formatTimeDisplay = (value) => {
    if (!value) return '';
    const normalized = normalizeTimeForInput(value);
    if (!normalized) return value;
    const [hoursStr, minutes] = normalized.split(':');
    const hours = parseInt(hoursStr, 10);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 === 0 ? 12 : hours % 12;
    return `${displayHours}:${minutes}${period}`;
  };

  const formatDateDisplay = (value) => {
    if (!value) return '';
    const normalized = normalizeDateForInput(value);
    if (!normalized) return value;
    const [year, month, day] = normalized.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const currentMonthIndex = new Date().getMonth();
  const currentNewsletter = newsletterData[currentMonthIndex];
  const previewMonthIndex = currentNewsletter && currentNewsletter.published
    ? (currentMonthIndex + 1) % 12
    : currentMonthIndex;
  const previewEntry = newsletterData[previewMonthIndex] || normalizeNewsletterEntry(null, previewMonthIndex);
  const currentPosting = postingData[currentMonthIndex];
  const postingPreviewMonthIndex = currentPosting && currentPosting.completed
    ? (currentMonthIndex + 1) % 12
    : currentMonthIndex;
  const postingPreviewEntry = normalizePostingEntry(postingData[postingPreviewMonthIndex], postingPreviewMonthIndex);
  const postingPreviewCount = getPostingCompletedCount(postingPreviewEntry.entries);
  const currentPressRelease = pressReleaseData[currentMonthIndex];
  const pressReleasePreviewMonthIndex = currentPressRelease && currentPressRelease.published
    ? (currentMonthIndex + 1) % 12
    : currentMonthIndex;
  const pressReleasePreviewEntry = pressReleaseData[pressReleasePreviewMonthIndex]
    || normalizePressReleaseEntry(null, pressReleasePreviewMonthIndex);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewEvent({ ...newEvent, flyerImage: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateEvent = () => {
    const event = {
      ...newEvent,
      id: Date.now(),
      createdAt: new Date().toISOString()
    };
    const nextEvents = [...events, event];
    setEvents(nextEvents);
    persistEvents(nextEvents);
    if (event.flyerImage) {
      persistFlyerImage(event.id, event.flyerImage);
    }
    saveEvent(event);
    setShowNewEventForm(false);
    setNewEvent({
      name: '',
      date: '',
      time: '',
      isTBD: false,
      goals: '',
      outcomes: '',
      advertising: '',
      totalSpent: '',
      totalEarned: '',
      volunteers: '',
      targetAttendance: '',
      currentRSVPs: '',
      flyerImage: null,
      checklist: {},
      planningChecklist: {},
      planningNotes: '',
      notes: '',
      postEventAttendance: '',
      postEventNotes: ''
    });
  };

  const toggleChecklistItem = (eventId, itemId) => {
    let updatedEvent = null;
    const nextEvents = events.map(event => {
      if (event.id === eventId) {
        updatedEvent = {
          ...event,
          checklist: {
            ...event.checklist,
            [itemId]: !event.checklist[itemId]
          }
        };
        return updatedEvent;
      }
      return event;
    });
    setEvents(nextEvents);
    persistEvents(nextEvents);
    if (selectedEvent && selectedEvent.id === eventId && updatedEvent) {
      setSelectedEvent(updatedEvent);
    }
    if (updatedEvent) {
      saveEvent(updatedEvent);
    }
  };

  const togglePlanningItem = (eventId, itemId) => {
    let updatedEvent = null;
    const nextEvents = events.map(event => {
      if (event.id === eventId) {
        const current = event.planningChecklist || {};
        const entry = current[itemId] || { done: false, note: '' };
        const nextChecklist = {
          ...current,
          [itemId]: { ...entry, done: !entry.done }
        };
        updatedEvent = { ...event, planningChecklist: nextChecklist };
        return updatedEvent;
      }
      return event;
    });
    setEvents(nextEvents);
    persistEvents(nextEvents);
    if (selectedEvent && selectedEvent.id === eventId && updatedEvent) {
      setSelectedEvent(updatedEvent);
    }
    if (updatedEvent) {
      saveEvent(updatedEvent);
    }
  };

  const updatePlanningNote = (eventId, itemId, note) => {
    let updatedEvent = null;
    const nextEvents = events.map(event => {
      if (event.id === eventId) {
        const current = event.planningChecklist || {};
        const entry = current[itemId] || { done: false, note: '' };
        const nextChecklist = {
          ...current,
          [itemId]: { ...entry, note }
        };
        updatedEvent = { ...event, planningChecklist: nextChecklist };
        return updatedEvent;
      }
      return event;
    });
    setEvents(nextEvents);
    persistEvents(nextEvents);
    if (selectedEvent && selectedEvent.id === eventId && updatedEvent) {
      setSelectedEvent(updatedEvent);
    }
    if (updatedEvent) {
      saveEvent(updatedEvent);
    }
  };

  const updateEventField = (eventId, field, value) => {
    let updatedEvent = null;
    const nextEvents = events.map(event => {
      if (event.id === eventId) {
        updatedEvent = { ...event, [field]: value };
        return updatedEvent;
      }
      return event;
    });
    setEvents(nextEvents);
    persistEvents(nextEvents);
    if (selectedEvent && selectedEvent.id === eventId && updatedEvent) {
      setSelectedEvent(updatedEvent);
    }
    if (updatedEvent) {
      saveEvent(updatedEvent);
    }
  };

  if (selectedEvent) {
    const daysUntil = calculateDaysUntil(selectedEvent.date);
    const marketingProgress = getChecklistProgress(selectedEvent.checklist);
    const planningProgress = getPlanningProgress(selectedEvent.planningChecklist);
    const statusColor = getStatusColor(marketingProgress);
    const statusLabel = getStatusLabel(marketingProgress);
    const isPastEvent = daysUntil !== null && daysUntil < 0;
    const handleTouchStart = (e) => {
      touchStartX.current = e.touches[0].clientX;
    };
    const handleTouchEnd = (e) => {
      if (touchStartX.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(deltaX) > 60) {
        setActiveTab(deltaX < 0 ? 'planning' : 'marketing');
      }
      touchStartX.current = null;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-amber-50 p-4 sm:p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => setSelectedEvent(null)}
            className="mb-6 text-amber-700 hover:text-amber-800 font-medium"
          >
            &larr; Back to Dashboard
          </button>

          <div
            className="bg-white rounded-lg shadow-lg border border-stone-200 overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {selectedEvent.flyerImage && (
              <div className="w-full h-64 bg-gray-100">
                <img
                  src={selectedEvent.flyerImage}
                  alt={selectedEvent.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="p-8">
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Event Name</label>
                  <input
                    type="text"
                    value={selectedEvent.name}
                    onChange={(e) => updateEventField(selectedEvent.id, 'name', e.target.value)}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-2xl font-light text-stone-900"
                    placeholder="Event name"
                  />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 text-stone-700">
                  <div className="flex items-center gap-2">
                    <Calendar size={18} />
                    {selectedEvent.isTBD ? (
                      <span>TBD</span>
                    ) : (
                      <>
                        <input
                          type="date"
                          value={normalizeDateForInput(selectedEvent.date)}
                          onChange={(e) => updateEventField(selectedEvent.id, 'date', e.target.value)}
                          className="px-3 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-sm"
                        />
                        {selectedEvent.time && (
                          <span className="text-sm text-stone-700">
                            · {formatTimeDisplay(selectedEvent.time)}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                  {daysUntil !== null && !isPastEvent && (
                    <div className="flex items-center gap-2">
                      <Clock size={18} />
                      <span>{daysUntil} days away</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6 flex w-full rounded-full border border-stone-200 bg-stone-50 p-1 text-xs font-medium">
                <button
                  onClick={() => setActiveTab('marketing')}
                  className={`flex-1 rounded-full px-3 py-2 transition-colors ${activeTab === 'marketing' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
                >
                  Marketing
                </button>
                <button
                  onClick={() => setActiveTab('planning')}
                  className={`flex-1 rounded-full px-3 py-2 transition-colors ${activeTab === 'planning' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'}`}
                >
                  Event Planning
                </button>
              </div>

              {activeTab === 'marketing' && (
                <>
                  {!isPastEvent && (
                    <div className="mb-8 p-6 bg-gradient-to-br from-stone-50 to-stone-100 rounded-lg border border-stone-200 shadow-sm">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-sm font-medium text-stone-900">Marketing Progress</span>
                        <span className={`text-sm font-medium ${statusColor}`}>{statusLabel}</span>
                      </div>
                      <div className="flex items-center gap-4 mb-2">
                        <div className="flex-1 h-3 bg-white rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 transition-all duration-500"
                            style={{ width: `${Math.min(marketingProgress, 100)}%` }}
                          />
                        </div>
                        <span className="text-lg font-light text-stone-900">{marketingProgress}%</span>
                      </div>
                      <div className="text-sm text-stone-700">
                        {getChecklistCompletion(selectedEvent.checklist)} marketing tasks
                      </div>
                      <div className="mt-4 pt-4 border-t border-stone-200">
                        <p className="text-sm text-stone-800 mb-3">
                          You're {daysUntil > 14 ? `${daysUntil} days out` : daysUntil > 7 ? 'two weeks out' : 'one week out'} and have completed {getChecklistCompletion(selectedEvent.checklist)} marketing tasks ({marketingProgress}%). Attendance is {selectedEvent.currentRSVPs || 0} of {selectedEvent.targetAttendance || 0}.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xl font-light text-stone-900">Marketing Checklist</h2>
                      <span className="text-sm text-stone-600 font-medium">{getChecklistCompletion(selectedEvent.checklist)} complete</span>
                    </div>
                    <div className="space-y-2">
                      {marketingChecklist.map(item => (
                        <label key={item.id} className="flex items-start sm:items-center gap-3 p-3 hover:bg-stone-50 rounded-md cursor-pointer transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedEvent.checklist[item.id] || false}
                            onChange={() => toggleChecklistItem(selectedEvent.id, item.id)}
                            className="w-5 h-5 text-amber-600 rounded focus:ring-amber-400"
                          />
                          <span className={`flex-1 ${selectedEvent.checklist[item.id] ? 'line-through text-gray-400' : 'text-stone-800'} ${item.special ? 'text-sm italic' : ''}`}>
                            {item.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="mb-8">
                    <h2 className="text-xl font-light text-stone-900 mb-4">Event Details</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Time</label>
                        <input
                          type="time"
                          value={normalizeTimeForInput(selectedEvent.time) || ''}
                          onChange={(e) => updateEventField(selectedEvent.id, 'time', e.target.value)}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="Event time"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Goals</label>
                        <input
                          type="text"
                          value={selectedEvent.goals || ''}
                          onChange={(e) => updateEventField(selectedEvent.id, 'goals', e.target.value)}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="What is this event aiming to achieve?"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-stone-900 mb-2">Outcomes</label>
                        <textarea
                          value={selectedEvent.outcomes || ''}
                          onChange={(e) => updateEventField(selectedEvent.id, 'outcomes', e.target.value)}
                          rows={3}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="Key outcomes or takeaways"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-8">
                    <h2 className="text-xl font-light text-stone-900 mb-4">Budget & Promotion</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Advertising</label>
                        <input
                          type="text"
                          value={selectedEvent.advertising || ''}
                          onChange={(e) => updateEventField(selectedEvent.id, 'advertising', e.target.value)}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="Channels, partners, or placements"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Volunteers</label>
                        <input
                          type="text"
                          value={selectedEvent.volunteers || ''}
                          onChange={(e) => updateEventField(selectedEvent.id, 'volunteers', e.target.value)}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="Names or count"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Total Spent</label>
                        <input
                          type="number"
                          value={selectedEvent.totalSpent || ''}
                          onChange={(e) => updateEventField(selectedEvent.id, 'totalSpent', e.target.value)}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Total Earned</label>
                        <input
                          type="number"
                          value={selectedEvent.totalEarned || ''}
                          onChange={(e) => updateEventField(selectedEvent.id, 'totalEarned', e.target.value)}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mb-8">
                    <label className="block text-sm font-medium text-stone-900 mb-2">Current RSVPs / Tickets</label>
                    <input
                      type="number"
                      value={selectedEvent.currentRSVPs}
                      onChange={(e) => updateEventField(selectedEvent.id, 'currentRSVPs', e.target.value)}
                      className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                      placeholder="Update attendance count"
                    />
                  </div>

                  <div className="mb-8">
                    <label className="block text-sm font-medium text-stone-900 mb-2">Notes</label>
                    <textarea
                      value={selectedEvent.notes}
                      onChange={(e) => updateEventField(selectedEvent.id, 'notes', e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                      placeholder="Ongoing thoughts and planning notes..."
                    />
                  </div>

                  <div className="border-t border-stone-200 pt-8">
                    <h2 className="text-xl font-light text-stone-900 mb-4">Post-Event Reflection</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Actual Attendance</label>
                        <input
                          type="number"
                          value={selectedEvent.postEventAttendance}
                          onChange={(e) => updateEventField(selectedEvent.id, 'postEventAttendance', e.target.value)}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="Final attendance count"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-stone-900 mb-2">Reflection Notes</label>
                        <textarea
                          value={selectedEvent.postEventNotes}
                          onChange={(e) => updateEventField(selectedEvent.id, 'postEventNotes', e.target.value)}
                          rows={4}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                          placeholder="What worked well? What would you change? Key takeaways..."
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end">
                    <button
                      onClick={() => deleteEvent(selectedEvent.id)}
                      className="px-4 py-2 border border-stone-300 text-stone-700 rounded-md hover:bg-stone-100 transition-colors"
                    >
                      Delete Event
                    </button>
                  </div>
                </>
              )}

              {activeTab === 'planning' && (
                <div className="mb-8 space-y-6">
                  <div className="bg-white rounded-lg border border-stone-200 shadow-sm p-6">
                    <label className="block text-sm font-medium text-stone-900 mb-2">Planning Notes</label>
                    <textarea
                      value={selectedEvent.planningNotes || ''}
                      onChange={(e) => updateEventField(selectedEvent.id, 'planningNotes', e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                      placeholder="General info, reminders, or planning thoughts..."
                    />
                  </div>

                  <div
                    className="bg-white rounded-lg border border-stone-200 shadow-sm p-6 cursor-pointer hover:border-amber-300 transition-colors"
                    onClick={() => setShowNewsletterModal(true)}
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="text-sm font-medium text-stone-900">Newsletter Content</h3>
                        <p className="text-xs text-stone-500">Showing {monthLabels[previewMonthIndex]}</p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-amber-700 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowNewsletterModal(true);
                        }}
                      >
                        Open
                      </button>
                    </div>
                    <div className="text-sm text-stone-700">
                      {previewEntry.mainFeature ||
                        previewEntry.mainUpcomingEvent ||
                        previewEntry.eventRecaps ||
                        previewEntry.volunteerHours ||
                        previewEntry.donationNeeds ||
                        previewEntry.other ||
                        'Add the monthly overview and details.'}
                    </div>
                    <div className="mt-3 text-xs text-stone-500">
                      {currentNewsletter && currentNewsletter.published
                        ? `Published - previewing ${monthLabels[previewMonthIndex]}`
                        : `Draft - ${monthLabels[previewMonthIndex]}`}
                    </div>
                  </div>

                  <div className="p-6 bg-gradient-to-br from-stone-50 to-stone-100 rounded-lg border border-stone-200 shadow-sm">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-medium text-stone-900">Event Planning Progress</span>
                      <span className="text-sm font-medium text-stone-700">{planningProgress}%</span>
                    </div>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1 h-3 bg-white rounded-full overflow-hidden shadow-inner">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 transition-all duration-500"
                          style={{ width: `${Math.min(planningProgress, 100)}%` }}
                        />
                      </div>
                      <span className="text-lg font-light text-stone-900">{planningProgress}%</span>
                    </div>
                    <div className="text-sm text-stone-700 mb-4">
                      {getPlanningCompletion(selectedEvent.planningChecklist)} planning tasks
                    </div>

                    <div className="space-y-3">
                      {planningChecklist.map(item => {
                        const entry = (selectedEvent.planningChecklist || {})[item.id] || { done: false, note: '' };
                        return (
                          <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-md bg-white p-3 border border-stone-200">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={entry.done || false}
                                onChange={() => togglePlanningItem(selectedEvent.id, item.id)}
                                className="w-5 h-5 text-amber-600 rounded focus:ring-amber-400"
                              />
                              <span className={`text-sm ${entry.done ? 'line-through text-gray-400' : 'text-stone-800'}`}>
                                {item.label}
                              </span>
                            </label>
                            <input
                              type="text"
                              value={entry.note || ''}
                              onChange={(e) => updatePlanningNote(selectedEvent.id, item.id, e.target.value)}
                              className="flex-1 px-3 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-sm"
                              placeholder="Notes"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {showNewsletterModal && (
                <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
                  <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-stone-200">
                    <div className="p-6 border-b border-stone-200 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-light text-stone-900">Newsletter Content</h2>
                        <p className="text-xs text-stone-500">Edit month-by-month content for the newsletter.</p>
                      </div>
                      <button
                        type="button"
                        className="text-sm text-stone-600 hover:text-stone-800"
                        onClick={() => setShowNewsletterModal(false)}
                      >
                        Close
                      </button>
                    </div>

                    <div className="p-6 space-y-6">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                            onClick={() => setNewsletterMonth((newsletterMonth + 11) % 12)}
                          >
                            Prev
                          </button>
                          <div className="text-sm font-medium text-stone-900">
                            {monthLabels[newsletterMonth]}
                          </div>
                          <button
                            type="button"
                            className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                            onClick={() => setNewsletterMonth((newsletterMonth + 1) % 12)}
                          >
                            Next
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`px-3 py-2 rounded-md text-sm font-medium border inline-flex items-center gap-2 ${newsletterData[newsletterMonth]?.published ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                          onClick={() => toggleNewsletterPublished(newsletterMonth)}
                        >
                          {newsletterData[newsletterMonth]?.published ? (
                            <>
                              <CheckCircle2 size={16} />
                              Published
                            </>
                          ) : (
                            'Mark as Published'
                          )}
                        </button>
                      </div>

                      <div className="space-y-4">
                        {newsletterFields.map(field => (
                          <div key={field.id} className="flex flex-col sm:flex-row gap-3">
                            <div className="text-sm font-medium text-stone-900 sm:w-48 pt-2">
                              {field.label}
                            </div>
                            <textarea
                              value={newsletterData[newsletterMonth]?.[field.id] || ''}
                              onChange={(e) => updateNewsletterField(newsletterMonth, field.id, e.target.value)}
                              rows={3}
                              className="flex-1 px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-sm"
                              placeholder={`Add ${field.label.toLowerCase()}...`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-stone-100 to-amber-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-4xl font-light text-stone-900 mb-2">North Star House</h1>
            <p className="text-stone-700">Event Management</p>
          </div>
          <button
            onClick={() => setShowNewEventForm(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-[#886c44] text-white rounded-md hover:bg-[#755a38] transition-all shadow-md w-full md:w-auto"
          >
            <Plus size={20} />
            New Event
          </button>
        </div>

        {showNewEventForm && (
          <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 sm:p-6 z-50">
            <div className="bg-gradient-to-br from-white to-stone-50 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 border border-stone-200">
              <h2 className="text-2xl font-light text-stone-900 mb-6">Create New Event</h2>
              
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-stone-900 mb-2">Event Name</label>
                    <input
                    type="text"
                    value={newEvent.name}
                    onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="Event name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Date</label>
                  <input
                    type="date"
                    value={newEvent.date}
                    onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value, isTBD: false })}
                    disabled={newEvent.isTBD}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent disabled:bg-gray-100 bg-white"
                  />
                  <label className="flex items-center gap-2 mt-2">
                    <input
                      type="checkbox"
                      checked={newEvent.isTBD}
                      onChange={(e) => setNewEvent({ ...newEvent, isTBD: e.target.checked, date: '' })}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-400"
                    />
                    <span className="text-sm text-stone-700">Date TBD</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Time</label>
                  <input
                    type="time"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="Event time"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Goals</label>
                  <input
                    type="text"
                    value={newEvent.goals}
                    onChange={(e) => setNewEvent({ ...newEvent, goals: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="What is this event aiming to achieve?"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Outcomes</label>
                  <textarea
                    value={newEvent.outcomes}
                    onChange={(e) => setNewEvent({ ...newEvent, outcomes: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="Key outcomes or takeaways"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Advertising</label>
                  <input
                    type="text"
                    value={newEvent.advertising}
                    onChange={(e) => setNewEvent({ ...newEvent, advertising: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="Channels, partners, or placements"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Total Spent</label>
                  <input
                    type="number"
                    value={newEvent.totalSpent}
                    onChange={(e) => setNewEvent({ ...newEvent, totalSpent: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Total Earned</label>
                  <input
                    type="number"
                    value={newEvent.totalEarned}
                    onChange={(e) => setNewEvent({ ...newEvent, totalEarned: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Volunteers</label>
                  <input
                    type="text"
                    value={newEvent.volunteers}
                    onChange={(e) => setNewEvent({ ...newEvent, volunteers: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="Names or count"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Target Attendance</label>
                  <input
                    type="number"
                    value={newEvent.targetAttendance}
                    onChange={(e) => setNewEvent({ ...newEvent, targetAttendance: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="Expected number of attendees"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Current RSVPs / Tickets</label>
                  <input
                    type="number"
                    value={newEvent.currentRSVPs}
                    onChange={(e) => setNewEvent({ ...newEvent, currentRSVPs: e.target.value })}
                    className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white"
                    placeholder="Current count"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-stone-900 mb-2">Flyer / Event Image</label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 px-4 py-2 border border-stone-200 rounded-md cursor-pointer hover:bg-stone-50 transition-colors">
                      <Upload size={18} className="text-stone-600" />
                      <span className="text-sm text-stone-800">Upload Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    {newEvent.flyerImage && (
                      <img src={newEvent.flyerImage} alt="Preview" className="h-16 w-16 object-cover rounded-md border border-stone-200 shadow-sm" />
                    )}
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                  <button
                    onClick={handleCreateEvent}
                    disabled={!newEvent.name}
                    className="flex-1 px-6 py-3 bg-[#886c44] text-white rounded-md hover:bg-[#755a38] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md"
                  >
                    Create Event
                  </button>
                  <button
                    onClick={() => setShowNewEventForm(false)}
                    className="px-6 py-3 border border-stone-300 text-stone-800 rounded-md hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {events.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-lg border border-stone-200 shadow-sm">
            <Calendar size={48} className="mx-auto text-stone-300 mb-4" />
            <p className="text-stone-700 mb-2">No events yet</p>
            <p className="text-sm text-stone-500">Create your first event to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {events.map(event => {
              const daysUntil = calculateDaysUntil(event.date);
              const progress = getChecklistProgress(event.checklist);
              const isPastEvent = daysUntil !== null && daysUntil < 0;
              const planningProgress = getPlanningProgress(event.planningChecklist);

              return (
                <div
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="bg-white rounded-lg shadow-md border border-stone-200 overflow-hidden cursor-pointer hover:shadow-lg hover:border-amber-400 transition-all"
                >
                  {event.flyerImage && (
                    <div className="w-full h-40 bg-gradient-to-br from-stone-100 to-amber-100">
                      <img
                        src={event.flyerImage}
                        alt={event.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-lg font-medium text-stone-900 mb-2">{event.name}</h3>
                    <div className="flex items-center justify-between text-sm text-stone-700 mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} />
                      <span>
                        {event.isTBD
                          ? 'TBD'
                          : `${formatDateDisplay(event.date)}${event.time ? ` · ${formatTimeDisplay(event.time)}` : ''}`}
                      </span>
                      </div>
                      {daysUntil !== null && !isPastEvent && (
                        <span className="text-xs text-stone-500">
                          {daysUntil} days
                        </span>
                      )}
                    </div>

                    {!isPastEvent && (
                      <div className="mt-3 space-y-2 text-xs text-stone-600">
                        {(event.targetAttendance || event.currentRSVPs) && (
                          <div className="flex items-center justify-between">
                            <span>Goal / Current</span>
                            <span className="font-medium text-stone-800">
                              {event.targetAttendance || 0} / {event.currentRSVPs || 0}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span>Marketing progress</span>
                          <span className="font-medium text-stone-800">{progress}%</span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {getChecklistCompletion(event.checklist)} tasks
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Event planning progress</span>
                          <span className="font-medium text-stone-800">{planningProgress}%</span>
                        </div>
                        <div className="h-2 bg-stone-100 rounded-full overflow-hidden shadow-inner">
                          <div
                            className="h-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 transition-all duration-500"
                            style={{ width: `${Math.min(planningProgress, 100)}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-stone-500">
                          {getPlanningCompletion(event.planningChecklist)} tasks
                        </div>
                      </div>
                    )}

                    {isPastEvent && (
                      <div className="text-xs text-stone-500">Past event</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-10 bg-white rounded-lg border border-stone-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h2 className="text-lg font-medium text-stone-900">Newsletter Content</h2>
              <p className="text-xs text-stone-500">
                Current focus: {monthLabels[previewMonthIndex]}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://docs.google.com/spreadsheets/d/1dLNdvhcW1_36brUdahk_eh73qx127GYM8djHMJbyazg/edit?gid=764171934#gid=764171934"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-amber-700 font-medium"
              >
                Newsletter Stats
              </a>
              <button
                type="button"
                className="text-xs text-amber-700 font-medium"
                onClick={() => setShowNewsletterModal(true)}
              >
                Open
              </button>
            </div>
          </div>
          <div className="text-sm text-stone-700">
            {previewEntry.mainFeature ||
              previewEntry.mainUpcomingEvent ||
              previewEntry.eventRecaps ||
              previewEntry.volunteerHours ||
              previewEntry.donationNeeds ||
              previewEntry.other ||
              'Add the monthly overview and details.'}
          </div>
          <div className="mt-3 text-xs text-stone-500">
            {currentNewsletter && currentNewsletter.published
              ? `Published - previewing ${monthLabels[previewMonthIndex]}`
              : `Draft - ${monthLabels[previewMonthIndex]}`}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg border border-stone-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h2 className="text-lg font-medium text-stone-900">Press Releases</h2>
              <p className="text-xs text-stone-500">
                Goal: 1 per month - Current focus: {monthLabels[pressReleasePreviewMonthIndex]}
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-amber-700 font-medium"
              onClick={() => setShowPressReleaseModal(true)}
            >
              Open
            </button>
          </div>
          <div className="text-sm text-stone-700">
            {pressReleasePreviewEntry.headline ||
              pressReleasePreviewEntry.summary ||
              pressReleasePreviewEntry.keyDetails ||
              pressReleasePreviewEntry.outlets ||
              pressReleasePreviewEntry.link ||
              pressReleasePreviewEntry.notes ||
              'Outline the monthly press release.'}
          </div>
          <div className="mt-3 text-xs text-stone-500">
            {currentPressRelease && currentPressRelease.published
              ? `Sent - previewing ${monthLabels[pressReleasePreviewMonthIndex]}`
              : `Draft - ${monthLabels[pressReleasePreviewMonthIndex]}`}
          </div>
        </div>

        <div className="mt-6 bg-white rounded-lg border border-stone-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div>
              <h2 className="text-lg font-medium text-stone-900">Monthly Posting Schedule</h2>
              <p className="text-xs text-stone-500">
                Current focus: {monthLabels[postingPreviewMonthIndex]}
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-amber-700 font-medium"
              onClick={() => setShowPostingModal(true)}
            >
              Open
            </button>
          </div>
          <div className="text-sm text-stone-700">
            {postingPreviewCount > 0
              ? `${postingPreviewCount}/${postingFields.length} prompts filled.`
              : 'Add what you posted this month.'}
          </div>
          <div className="mt-3 text-xs text-stone-500">
            {currentPosting && currentPosting.completed
              ? `Completed - previewing ${monthLabels[postingPreviewMonthIndex]}`
              : `In progress - ${monthLabels[postingPreviewMonthIndex]}`}
          </div>
        </div>

      </div>

      {showNewsletterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-stone-200">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-light text-stone-900">Newsletter Content</h2>
                <p className="text-xs text-stone-500">Edit month-by-month content for the newsletter.</p>
              </div>
              <button
                type="button"
                className="text-sm text-stone-600 hover:text-stone-800"
                onClick={() => setShowNewsletterModal(false)}
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                    onClick={() => setNewsletterMonth((newsletterMonth + 11) % 12)}
                  >
                    Prev
                  </button>
                  <div className="text-sm font-medium text-stone-900">
                    {monthLabels[newsletterMonth]}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                    onClick={() => setNewsletterMonth((newsletterMonth + 1) % 12)}
                  >
                    Next
                  </button>
                </div>
                <button
                  type="button"
                  className={`px-3 py-2 rounded-md text-sm font-medium border inline-flex items-center gap-2 ${newsletterData[newsletterMonth]?.published ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                  onClick={() => toggleNewsletterPublished(newsletterMonth)}
                >
                  {newsletterData[newsletterMonth]?.published ? (
                    <>
                      <CheckCircle2 size={16} />
                      Published
                    </>
                  ) : (
                    'Mark as Published'
                  )}
                </button>
              </div>

              <div className="space-y-4">
                {newsletterFields.map(field => (
                  <div key={field.id} className="flex flex-col sm:flex-row gap-3">
                    <div className="text-sm font-medium text-stone-900 sm:w-48 pt-2">
                      {field.label}
                    </div>
                    <textarea
                      value={newsletterData[newsletterMonth]?.[field.id] || ''}
                      onChange={(e) => updateNewsletterField(newsletterMonth, field.id, e.target.value)}
                      rows={3}
                      className="flex-1 px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-sm"
                      placeholder={`Add ${field.label.toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPressReleaseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-stone-200">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-light text-stone-900">Press Releases</h2>
                <p className="text-xs text-stone-500">Plan month-by-month press releases.</p>
              </div>
              <button
                type="button"
                className="text-sm text-stone-600 hover:text-stone-800"
                onClick={() => setShowPressReleaseModal(false)}
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                    onClick={() => setPressReleaseMonth((pressReleaseMonth + 11) % 12)}
                  >
                    Prev
                  </button>
                  <div className="text-sm font-medium text-stone-900">
                    {monthLabels[pressReleaseMonth]}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                    onClick={() => setPressReleaseMonth((pressReleaseMonth + 1) % 12)}
                  >
                    Next
                  </button>
                </div>
                <button
                  type="button"
                  className={`px-3 py-2 rounded-md text-sm font-medium border inline-flex items-center gap-2 ${pressReleaseData[pressReleaseMonth]?.published ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                  onClick={() => togglePressReleasePublished(pressReleaseMonth)}
                >
                  {pressReleaseData[pressReleaseMonth]?.published ? (
                    <>
                      <CheckCircle2 size={16} />
                      Sent
                    </>
                  ) : (
                    'Mark as Sent'
                  )}
                </button>
              </div>

              <div className="space-y-4">
                {pressReleaseFields.map(field => (
                  <div key={field.id} className="flex flex-col sm:flex-row gap-3">
                    <div className="text-sm font-medium text-stone-900 sm:w-48 pt-2">
                      {field.label}
                    </div>
                    <textarea
                      value={pressReleaseData[pressReleaseMonth]?.[field.id] || ''}
                      onChange={(e) => updatePressReleaseField(pressReleaseMonth, field.id, e.target.value)}
                      rows={3}
                      className="flex-1 px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-sm"
                      placeholder={`Add ${field.label.toLowerCase()}...`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showPostingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-stone-200">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-light text-stone-900">Monthly Posting Schedule</h2>
                <p className="text-xs text-stone-500">Track what you actually posted each week.</p>
              </div>
              <button
                type="button"
                className="text-sm text-stone-600 hover:text-stone-800"
                onClick={() => setShowPostingModal(false)}
              >
                Close
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                    onClick={() => setPostingMonth((postingMonth + 11) % 12)}
                  >
                    Prev
                  </button>
                  <div className="text-sm font-medium text-stone-900">
                    {monthLabels[postingMonth]}
                  </div>
                  <button
                    type="button"
                    className="px-3 py-2 border border-stone-200 rounded-md text-sm text-stone-600 hover:bg-stone-50"
                    onClick={() => setPostingMonth((postingMonth + 1) % 12)}
                  >
                    Next
                  </button>
                </div>
                <button
                  type="button"
                  className={`px-3 py-2 rounded-md text-sm font-medium border inline-flex items-center gap-2 ${postingData[postingMonth]?.completed ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : 'border-stone-200 text-stone-600 hover:bg-stone-50'}`}
                  onClick={() => togglePostingComplete(postingMonth)}
                >
                  {postingData[postingMonth]?.completed ? (
                    <>
                      <CheckCircle2 size={16} />
                      Completed
                    </>
                  ) : (
                    'Mark as Complete'
                  )}
                </button>
              </div>

              {postingSchedule.map(section => (
                <div key={section.week} className="space-y-4">
                  <h3 className="text-sm font-semibold text-stone-900">{section.week}</h3>
                  <div className="space-y-3">
                    {section.items.map(item => (
                      <div key={item.id} className="flex flex-col gap-2 rounded-md border border-stone-200 p-3">
                        <div className="text-sm font-medium text-stone-800">
                          {item.day} - {item.prompt}
                        </div>
                        <textarea
                          value={postingData[postingMonth]?.entries?.[item.id] || ''}
                          onChange={(e) => updatePostingEntry(postingMonth, item.id, e.target.value)}
                          rows={2}
                          className="w-full px-4 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-sm"
                          placeholder="What you posted or did..."
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showBookingsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto border border-stone-200">
            <div className="p-6 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-light text-stone-900">Events Booked</h2>
                <p className="text-xs text-stone-500">Manage photo permissions and social posting status.</p>
              </div>
              <button
                type="button"
                className="text-sm text-stone-600 hover:text-stone-800"
                onClick={() => setShowBookingsModal(false)}
              >
                Close
              </button>
            </div>

            <div className="p-6">
              {bookingsData.length === 0 ? (
                <div className="text-sm text-stone-600">No bookings found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-[720px] w-full text-sm">
                    <thead>
                      <tr className="text-left text-stone-500 border-b border-stone-200">
                        <th className="py-2 pr-3 font-medium">Name</th>
                        <th className="py-2 pr-3 font-medium">Type</th>
                        <th className="py-2 pr-3 font-medium">Photo Permission</th>
                        <th className="py-2 pr-3 font-medium">Link / Photographer</th>
                        <th className="py-2 pr-3 font-medium">Posted to Socials</th>
                      </tr>
                    </thead>
                    <tbody className="text-stone-800">
                      {bookingsData.map(entry => (
                        <tr key={entry.rowIndex} className="border-b border-stone-100">
                          <td className="py-3 pr-3 align-top">
                            {entry.name || '—'}
                          </td>
                          <td className="py-3 pr-3 align-top">
                            {entry.type || '—'}
                          </td>
                          <td className="py-3 pr-3 align-top">
                            <label className="inline-flex items-center gap-2 text-xs text-stone-600">
                              <input
                                type="checkbox"
                                checked={Boolean(entry.photoPermission)}
                                onChange={(e) => updateBookingField(entry.rowIndex, 'photoPermission', e.target.checked)}
                                className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-400"
                              />
                              Permission granted
                            </label>
                          </td>
                          <td className="py-3 pr-3 align-top">
                            <input
                              type="text"
                              value={entry.link || ''}
                              onChange={(e) => updateBookingField(entry.rowIndex, 'link', e.target.value)}
                              placeholder="Add link or photographer"
                              className="w-full px-3 py-2 border border-stone-200 rounded-md focus:ring-2 focus:ring-amber-400 focus:border-transparent bg-white text-sm"
                            />
                          </td>
                          <td className="py-3 pr-3 align-top">
                            <label className="inline-flex items-center gap-2 text-xs text-stone-600">
                              <input
                                type="checkbox"
                                checked={Boolean(entry.posted)}
                                onChange={(e) => updateBookingField(entry.rowIndex, 'posted', e.target.checked)}
                                className="h-4 w-4 rounded border-stone-300 text-amber-600 focus:ring-amber-400"
                              />
                              Posted
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManagementApp;

const DashboardView = ({
  metrics,
  majorTodos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onOpenHoneybook,
  onOpenVoicemails,
  unreadHoneybook,
  unreadVoicemails
}) => {
  const [newTodoText, setNewTodoText] = useState('');

  const handleAddTodo = () => {
    const text = newTodoText.trim();
    if (!text) return;
    onAddTodo(text);
    setNewTodoText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleAddTodo();
  };

  const pendingTodos = majorTodos.filter((t) => !t.done);
  const completedTodos = majorTodos.filter((t) => t.done);

  const metricLinks = {
    'Events booked': 'https://northstarhouse.github.io/north-star-bookings-log/',
    Volunteers: 'https://northstarhouse.github.io/Volunteer-Database/',
    'Donation total': 'https://northstarhouse.github.io/donation-database/',
    Sponsors: 'https://northstarhouse.github.io/donation-database/'
  };
  const metricGoals = {
    'Donation total': 'Goal: $75,000',
    'Events booked': 'Goal: 45',
    Sponsors: 'Goal: 15'
  };

  return (
    <div className="max-w-6xl mx-auto fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="flex flex-col gap-4">
        <div className="glass rounded-3xl p-6 md:p-8 card-shadow">
          <div className="flex items-center gap-3 text-gold mb-4">
            <IconSpark size={28} />
            <span className="text-sm uppercase tracking-[0.25em] font-semibold">Mission Control</span>
          </div>

          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={newTodoText}
              onChange={(e) => setNewTodoText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Add a major focus item..."
              className="flex-1 rounded-xl border border-stone-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold placeholder:text-stone-400"
            />
            <button
              onClick={handleAddTodo}
              disabled={!newTodoText.trim()}
              className="bg-gold text-white rounded-xl px-4 py-2.5 text-sm font-medium transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <IconPlus size={16} />
              Add
            </button>
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {pendingTodos.length === 0 && completedTodos.length === 0 && (
              <p className="text-stone-400 text-sm text-center py-4">No items yet. Add your first major focus above.</p>
            )}
            {pendingTodos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 group bg-white rounded-xl border border-stone-100 px-4 py-3 transition hover:border-gold/30">
                <button
                  onClick={() => onToggleTodo(todo.id)}
                  className="w-5 h-5 rounded-md border-2 border-stone-300 flex-shrink-0 transition hover:border-gold flex items-center justify-center"
                  aria-label="Mark complete"
                />
                <span className="text-sm text-ink flex-1">{todo.text}</span>
                <button
                  onClick={() => onDeleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-stone-400 hover:text-red-500 transition flex-shrink-0"
                  aria-label="Delete item"
                >
                  <IconTrash size={14} />
                </button>
              </div>
            ))}
            {completedTodos.length > 0 && (
              <div className="pt-2 border-t border-stone-100 mt-3">
                <p className="text-[10px] uppercase tracking-wide text-stone-400 mb-2">Completed</p>
                {completedTodos.map((todo) => (
                  <div key={todo.id} className="flex items-center gap-3 group rounded-xl px-4 py-2.5 transition">
                    <button
                      onClick={() => onToggleTodo(todo.id)}
                      className="w-5 h-5 rounded-md bg-gold/20 border-2 border-gold/40 flex-shrink-0 flex items-center justify-center text-gold"
                      aria-label="Mark incomplete"
                    >
                      <IconCheck size={12} />
                    </button>
                    <span className="text-sm text-stone-400 line-through flex-1">
                      {todo.text}
                      {todo.completedAt && (
                        <span className="ml-2 text-[10px] text-stone-300 no-underline inline-block" style={{ textDecoration: 'none' }}>
                          {formatDate(todo.completedAt)}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => onDeleteTodo(todo.id)}
                      className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-stone-400 hover:text-red-500 transition flex-shrink-0"
                      aria-label="Delete item"
                    >
                      <IconTrash size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="glass rounded-2xl p-4 card-shadow">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'In-Kind Donation Form', href: 'https://drive.google.com/file/d/1cNGysqW__wS2IEKDaNzG1MPo-5JCE-ay/view' },
              { label: 'Reimbursement Form', href: 'https://drive.google.com/file/d/1Vkfh6Z5eM1RPUtw6j8mQjqKM71-YFPrW/view?usp=drive_link' },
              { label: 'Board Submission Form', href: 'https://drive.google.com/file/d/1_-AcaquXeK-O1x9AOubbQNCwoLWzu3f_/view?usp=drive_link' },
              { label: 'Incident & Injury Form', href: 'https://drive.google.com/file/d/1UNzWO6b_-YbKd_rYUxC5GkA2dRQVfcg-/view?usp=drive_link' },
              { label: 'Brick Form', href: 'https://drive.google.com/drive/folders/1m7RLU9lwPS_0N-qqwP2aNJaz6fp6UXQt?dmr=1&ec=wgc-drive-%5Bmodule%5D-goto' },
              { label: 'Thank You Notes', href: 'https://drive.google.com/drive/folders/1Mi8nNZzNWx1fz7CQ11XiW8SHPqQnBAgR?usp=sharing' }
            ].map((form) => (
              <a
                key={form.label}
                href={form.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:border-gold/40 hover:bg-white hover:text-ink"
              >
                <svg className="w-3 h-3 text-gold/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {form.label}
              </a>
            ))}
          </div>
        </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Donation total', value: formatCurrency(metrics?.donationsTotal) },
            { label: 'Events booked', value: formatCount(metrics?.eventsCount) },
            { label: 'Sponsors', value: formatCount(metrics?.sponsorsCount) },
            { label: 'Volunteers', value: formatCount(metrics?.volunteersCount) }
          ].map((item) => (
            metricLinks[item.label] ? (
              <a
                key={item.label}
                href={metricLinks[item.label]}
                className="bg-white rounded-2xl p-4 border border-stone-100 card-shadow block transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 relative"
                aria-label={`${item.label} details`}
              >
                <div className="text-xs uppercase tracking-wide text-steel">{item.label}</div>
                <div className="font-display text-2xl text-ink mt-2">{item.value}</div>
                {metricGoals[item.label] ? (
                  <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wide text-steel">
                    {metricGoals[item.label]}
                  </div>
                ) : null}
              </a>
            ) : (
              <div key={item.label} className="bg-white rounded-2xl p-4 border border-stone-100 card-shadow relative">
                <div className="text-xs uppercase tracking-wide text-steel">{item.label}</div>
                <div className="font-display text-2xl text-ink mt-2">{item.value}</div>
                {metricGoals[item.label] ? (
                  <div className="absolute bottom-3 right-4 text-[10px] uppercase tracking-wide text-steel">
                    {metricGoals[item.label]}
                  </div>
                ) : null}
              </div>
            )
          ))}
          <div className="col-span-2 grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={onOpenVoicemails}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:border-gold/40 hover:bg-white hover:text-ink relative"
            >
              <svg className="w-3 h-3 text-gold/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              Voicemails
              {unreadVoicemails && (
                <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0" />
              )}
            </button>
            <button
              onClick={onOpenHoneybook}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:border-gold/40 hover:bg-white hover:text-ink relative"
            >
              <svg className="w-3 h-3 text-gold/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Honeybook Messages
              {unreadHoneybook && (
                <span className="w-2 h-2 rounded-full bg-gold flex-shrink-0" />
              )}
            </button>
            {[
              { label: 'Event Planning', href: 'https://northstarhouse.github.io/nsh-events-committee/' },
              { label: 'Archives', href: 'https://northstarhouse.github.io/north-star-archives/' }
            ].map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white/60 px-3 py-1.5 text-xs font-medium text-ink/80 transition hover:border-gold/40 hover:bg-white hover:text-ink"
              >
                <svg className="w-3 h-3 text-gold/70 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7v10" /></svg>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const InitiativesView = ({ initiatives, onSelect, onAdd, onRefresh, isLoading }) => {
  const [search, setSearch] = useState('');
  const [focusArea, setFocusArea] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(() => {
    return initiatives.filter((item) => {
      const text = [item.title, item.description, item.owner, item.coChampions, item.focusArea, item.status]
        .join(' ')
        .toLowerCase();
      if (search && !text.includes(search.toLowerCase())) return false;
      if (focusArea && item.focusArea !== focusArea) return false;
      if (status && item.status !== status) return false;
      return true;
    });
  }, [initiatives, search, focusArea, status]);

  return (
    <div className="max-w-6xl mx-auto fade-up">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h2 className="font-display text-3xl text-ink">Strategic initiatives</h2>
          <p className="text-stone-600">Browse progress, submit updates, and review action items.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="px-4 py-2 border border-stone-200 rounded-lg text-sm"
            disabled={isLoading}
          >
            <span className="inline-flex items-center gap-2">
              <IconRefresh size={16} /> Refresh
            </span>
          </button>
          <button onClick={onAdd} className="px-4 py-2 bg-clay text-white rounded-lg text-sm">
            <span className="inline-flex items-center gap-2">
              <IconPlus size={16} /> Add initiative
            </span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-stone-100 p-4 card-shadow mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search initiatives"
            className="px-3 py-2 border border-stone-200 rounded-lg"
          />
          <select
            value={focusArea}
            onChange={(event) => setFocusArea(event.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            <option value="">All focus areas</option>
            {FOCUS_AREAS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="px-3 py-2 border border-stone-200 rounded-lg bg-white"
          >
            <option value="">All statuses</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-100 p-8 text-center text-stone-600">
          No initiatives found. Adjust filters or add a new initiative.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((initiative) => (
            <InitiativeCard
              key={initiative.id}
              initiative={initiative}
              onSelect={() => onSelect(initiative.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const InitiativeDetailView = ({ initiative, onBack, onEdit, onSubmitUpdate, onReviewUpdate }) => {
  const updates = sortUpdates(initiative.updates || []);

  return (
    <div className="max-w-5xl mx-auto fade-up">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gold mb-4">
        <IconBack size={18} /> Back to initiatives
      </button>

      <div className="bg-white rounded-3xl border border-stone-100 p-6 md:p-8 card-shadow">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">{initiative.focusArea}</div>
            <h1 className="font-display text-3xl text-ink mt-2">{initiative.title}</h1>
            <p className="text-stone-600 mt-2">{initiative.description}</p>
          </div>
          <div className="flex flex-col items-start gap-3">
            <StatusPill status={initiative.status} />
            <button onClick={onEdit} className="px-4 py-2 border border-stone-200 rounded-lg text-sm">
              Edit initiative
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Goal lead</div>
            <div className="text-sm text-ink mt-1">{initiative.owner || 'Unassigned'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Co-champions</div>
            <div className="text-sm text-ink mt-1">{initiative.coChampions || 'Not listed'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Target date</div>
            <div className="text-sm text-ink mt-1">{initiative.targetDate || 'TBD'}</div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-xs text-steel mb-2">
            <span>Progress</span>
            <span>{Math.round(initiative.progress)}%</span>
          </div>
          <ProgressBar value={initiative.progress} />
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Success metrics</div>
            <div className="text-sm text-ink mt-1">{initiative.successMetrics || 'Not defined'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Notes</div>
            <div className="text-sm text-ink mt-1">{initiative.notes || 'No notes yet'}</div>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Three-year vision for success</div>
            <div className="text-sm text-ink mt-1">{initiative.threeYearVision || 'Not defined'}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-steel">Annual goals</div>
            <div className="text-sm text-ink mt-1">{initiative.annualGoals || 'Not defined'}</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <UpdateForm initiative={initiative} onSubmit={(update) => onSubmitUpdate(initiative, update)} />
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-2xl">Update log</h2>
          <span className="text-xs text-steel">{updates.length} updates</span>
        </div>
        {updates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-stone-100 p-6 text-stone-600">
            No updates yet. Submit the first update to start the log.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {updates.map((update) => (
              <UpdateCard
                key={update.id}
                update={update}
                onReviewSave={(updateId, status, notes) => onReviewUpdate(initiative, updateId, status, notes)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// MAIN APP
// ============================================================================

const StrategyApp = () => {
  const [view, setView] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const scriptConfigWarning = getScriptConfigWarning();
  const [metrics, setMetrics] = useState({
    donationsTotal: null,
    volunteersCount: null,
    eventsCount: null,
    sponsorsCount: null
  });
  const [sectionSnapshots, setSectionSnapshots] = useState({
    Construction: null,
    Grounds: null,
    Interiors: null,
    Docents: null,
    Fundraising: null,
    Events: null,
    Marketing: null,
    Venue: null
  });
  const [majorTodos, setMajorTodos] = useState(() => {
    return readSimpleCache(MAJOR_TODOS_CACHE_KEY) || [];
  });
  const [quarterlyUpdates, setQuarterlyUpdates] = useState([]);
  const [quarterlyDraft, setQuarterlyDraft] = useState(null);
  const [inlineQuarterEdit, setInlineQuarterEdit] = useState(null);
  const [inlineQuarterForm, setInlineQuarterForm] = useState(null);
  const [isSavingInlineQuarter, setIsSavingInlineQuarter] = useState(false);
  const [sheetLastUpdated, setSheetLastUpdated] = useState({
    honeybook: null,
    voicemails: null
  });
  const [sheetUnread, setSheetUnread] = useState({
    honeybook: false,
    voicemails: false
  });
  const sectionDetails = SECTION_PAGES.reduce((acc, item) => {
    acc[item.key] = { label: item.label, key: item.sheet };
    return acc;
  }, {});

  const deletedTodoIds = useRef(new Set());

  const saveMajorTodos = (next) => {
    setMajorTodos(next);
    writeSimpleCache(MAJOR_TODOS_CACHE_KEY, next);
  };

  const handleAddTodo = (text) => {
    const todo = { id: makeId(), text, done: false, createdAt: new Date().toISOString(), completedAt: '' };
    const next = [...majorTodos, todo];
    saveMajorTodos(next);
    SheetsAPI.saveMajorTodo(todo);
  };

  const handleToggleTodo = (id) => {
    const next = majorTodos.map((t) => {
      if (t.id !== id) return t;
      const updated = { ...t, done: !t.done, completedAt: !t.done ? new Date().toISOString() : '' };
      SheetsAPI.saveMajorTodo(updated);
      return updated;
    });
    saveMajorTodos(next);
  };

  const handleDeleteTodo = (id) => {
    deletedTodoIds.current.add(id);
    const next = majorTodos.filter((t) => t.id !== id);
    saveMajorTodos(next);
    SheetsAPI.deleteMajorTodo(id);
  };

  useEffect(() => {
    loadData();
  }, []);

  const readLastSeen = () => {
    try {
      const raw = localStorage.getItem(SHEET_LAST_SEEN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  };

  const writeLastSeen = (next) => {
    try {
      localStorage.setItem(SHEET_LAST_SEEN_KEY, JSON.stringify(next));
    } catch (error) {
      console.warn('Failed to persist last seen timestamps:', error);
    }
  };

  const markSheetSeen = (key, updatedAt) => {
    const lastSeen = readLastSeen();
    const next = {
      ...lastSeen,
      [key]: updatedAt || new Date().toISOString()
    };
    writeLastSeen(next);
    setSheetUnread((prev) => ({ ...prev, [key]: false }));
  };

  const fetchSheetLastUpdated = async () => {
    if (!SheetsAPI.isConfigured()) return;
    try {
      const ids = [HONEYBOOK_SHEET_ID, VOICEMAILS_SHEET_ID].join(',');
      const response = await fetch(`${GOOGLE_SCRIPT_URL}?action=getSheetLastUpdated&ids=${encodeURIComponent(ids)}`);
      if (!response.ok) throw new Error('Failed to fetch sheet updates');
      const data = await response.json();
      if (!data.success || !data.updated) return;
      const honeybook = data.updated[HONEYBOOK_SHEET_ID] || null;
      const voicemails = data.updated[VOICEMAILS_SHEET_ID] || null;
      setSheetLastUpdated({ honeybook, voicemails });

      const lastSeen = readLastSeen();
      const honeybookUnread = honeybook && (!lastSeen.honeybook || new Date(honeybook) > new Date(lastSeen.honeybook));
      const voicemailsUnread = voicemails && (!lastSeen.voicemails || new Date(voicemails) > new Date(lastSeen.voicemails));
      setSheetUnread({
        honeybook: Boolean(honeybookUnread),
        voicemails: Boolean(voicemailsUnread)
      });
    } catch (error) {
      console.warn('Failed to check sheet updates:', error);
    }
  };

  const loadData = async ({ useCache = true } = {}) => {
    if (!USE_SHEETS) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const cachedMetrics = useCache ? readSimpleCache(METRICS_CACHE_KEY) : null;
    const cachedSnapshots = useCache ? readSimpleCache(SNAPSHOTS_CACHE_KEY) : null;
    const cachedQuarterly = useCache ? readSimpleCache(QUARTERLY_CACHE_KEY) : null;

    if (cachedMetrics) setMetrics(cachedMetrics);
    if (cachedSnapshots) setSectionSnapshots(cachedSnapshots);
    if (cachedQuarterly) setQuarterlyUpdates(cachedQuarterly);

    try {
      const results = await Promise.allSettled([
        SheetsAPI.fetchMetrics(),
        SheetsAPI.fetchSectionSnapshots(),
        SheetsAPI.fetchMajorTodos()
      ]);

      const [metricsResult, snapshotResult, todosResult] = results;
      if (metricsResult.status === 'fulfilled' && metricsResult.value) {
        setMetrics(metricsResult.value);
        writeSimpleCache(METRICS_CACHE_KEY, metricsResult.value);
      }
      if (snapshotResult.status === 'fulfilled' && snapshotResult.value) {
        setSectionSnapshots(snapshotResult.value);
        writeSimpleCache(SNAPSHOTS_CACHE_KEY, snapshotResult.value);
      }
      if (todosResult.status === 'fulfilled' && todosResult.value?.length) {
        // Merge server todos with local state: skip locally deleted items,
        // prefer local done/completedAt to avoid overwriting pending toggles
        setMajorTodos((localTodos) => {
          const localMap = {};
          localTodos.forEach((t) => { localMap[t.id] = t; });
          const merged = todosResult.value
            .filter((serverTodo) => !deletedTodoIds.current.has(serverTodo.id))
            .map((serverTodo) => {
              const local = localMap[serverTodo.id];
              if (local && local.done !== serverTodo.done) {
                return local;
              }
              return serverTodo;
            });
          // Also keep any local-only todos (added but not yet synced)
          localTodos.forEach((lt) => {
            if (!todosResult.value.find((st) => st.id === lt.id) && !deletedTodoIds.current.has(lt.id)) {
              merged.push(lt);
            }
          });
          writeSimpleCache(MAJOR_TODOS_CACHE_KEY, merged);
          return merged;
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }

    setIsLoading(false);

    setTimeout(async () => {
      try {
        const updatesData = await SheetsAPI.fetchQuarterlyUpdates();
        if (updatesData.length) {
          setQuarterlyUpdates(updatesData);
          writeSimpleCache(QUARTERLY_CACHE_KEY, updatesData);
        }
      } catch (error) {
        console.error('Failed to load quarterly updates:', error);
      }
    }, 0);
  };

  useEffect(() => {
    if (view !== 'dashboard') return undefined;
    fetchSheetLastUpdated();
    const interval = setInterval(fetchSheetLastUpdated, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [view]);

  const handleQuarterlyReviewSave = async (review) => {
    const { focusArea, quarter, ...reviewPayload } = review;
    await SheetsAPI.submitReviewUpdate(review);
    setQuarterlyUpdates((prev) => {
      const index = prev.findIndex(
        (item) => item.focusArea === focusArea && item.quarter === quarter
      );
      const nextEntry = index >= 0
        ? {
          ...prev[index],
          payload: { ...(prev[index].payload || {}), review: reviewPayload }
        }
        : {
          focusArea,
          quarter,
          submittedDate: '',
          payload: { review: reviewPayload }
        };
      const next = index >= 0
        ? prev.map((item, idx) => (idx === index ? nextEntry : item))
        : [...prev, nextEntry];
      writeSimpleCache(QUARTERLY_CACHE_KEY, next);
      return next;
    });
  };

  const handleEditQuarterly = (areaLabel, quarter) => {
    const matches = quarterlyUpdates
      .filter((item) => item.focusArea === areaLabel && item.quarter === quarter)
      .sort((a, b) => new Date(b.submittedDate || b.createdAt) - new Date(a.submittedDate || a.createdAt));
    const latest = matches[0];
    const payload = latest?.payload || {};
    const yearGuess = payload.year || String(new Date().getFullYear());
    const submittedDate = payload.submittedDate || latest?.submittedDate || new Date().toISOString().slice(0, 10);
    setQuarterlyDraft({
      focusArea: areaLabel,
      quarter,
      year: yearGuess,
      submittedDate,
      primaryFocus: payload.primaryFocus || '',
      goals: payload.goals && payload.goals.length ? payload.goals : [
        { goal: '', status: 'On Track', summary: '' },
        { goal: '', status: 'On Track', summary: '' },
        { goal: '', status: 'On Track', summary: '' }
      ],
      wins: payload.wins || '',
      challenges: payload.challenges || {},
      supportNeeded: payload.supportNeeded || '',
      supportTypes: payload.supportTypes || {},
      decisionsNeeded: payload.decisionsNeeded || '',
      nextQuarterFocus: payload.nextQuarterFocus || '',
      nextPriorities: payload.nextPriorities || ['', '', ''],
      finalTallyOverview: payload.finalTallyOverview || ''
    });
    setView('quarterly');
    window.scrollTo(0, 0);
  };

  const handleInlineQuarterEdit = (areaLabel, quarter, latest, payload) => {
    if (quarter !== 'Q1') return;
    const yearGuess = payload.year || String(new Date().getFullYear());
    const submittedDate = payload.submittedDate || latest?.submittedDate || new Date().toISOString().slice(0, 10);
    setInlineQuarterEdit({ areaLabel, quarter });
    setInlineQuarterForm({
      focusArea: areaLabel,
      quarter,
      year: yearGuess,
      submittedDate,
      primaryFocus: payload.primaryFocus || '',
      goals: payload.goals && payload.goals.length ? payload.goals : [
        { goal: '', status: 'On Track', summary: '' },
        { goal: '', status: 'On Track', summary: '' },
        { goal: '', status: 'On Track', summary: '' }
      ],
      wins: payload.wins || '',
      challenges: payload.challenges || {},
      supportNeeded: payload.supportNeeded || '',
      supportTypes: payload.supportTypes || {},
      decisionsNeeded: payload.decisionsNeeded || '',
      nextQuarterFocus: payload.nextQuarterFocus || '',
      nextPriorities: payload.nextPriorities || ['', '', ''],
      finalTallyOverview: payload.finalTallyOverview || '',
      uploadedFiles: payload.uploadedFiles || []
    });
  };

  const handleInlineQuarterSave = async () => {
    if (!inlineQuarterForm) return;
    setIsSavingInlineQuarter(true);
    try {
      await SheetsAPI.submitQuarterlyUpdate({ ...inlineQuarterForm, primaryOnly: true });
      await loadData({ useCache: false });
      setInlineQuarterEdit(null);
      setInlineQuarterForm(null);
    } catch (error) {
      console.error('Failed to save inline quarterly update:', error);
      alert('Failed to save. Please try again.');
    }
    setIsSavingInlineQuarter(false);
  };

  const handleQuarterlySubmitted = async () => {
    await loadData({ useCache: false });
    setQuarterlyDraft(null);
    setView('dashboard');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-stone-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-gold/40 bg-white text-gold flex items-center justify-center shadow-sm">
                <IconSpark size={18} />
              </div>
              <div>
                <div className="font-display text-lg text-ink">Haley’s Star Command</div>
                <div className="text-xs text-steel"></div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm flex-wrap" />
          </div>
          <div className="pb-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setView('dashboard')}
                className={`tab-button text-sm min-w-[200px] ${view === 'dashboard' ? 'active' : ''}`}
              >
                2026 Snapshot
              </button>
              <button
                onClick={() => setView('marketing')}
                className={`tab-button text-sm min-w-[200px] ${view === 'marketing' ? 'active' : ''}`}
              >
                Marketing
              </button>
              <select
                value={SECTION_PAGES.some((item) => item.key === view) ? view : ''}
                onChange={(event) => {
                  const nextView = event.target.value;
                  if (!nextView) return;
                  setView(nextView);
                }}
                className="tab-button tab-select text-sm bg-white min-w-[220px]"
              >
                <option value="">Operational Areas</option>
                {SECTION_PAGES.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-8 py-8">
        {scriptConfigWarning && (
          <div className="max-w-4xl mx-auto mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            {scriptConfigWarning}
          </div>
        )}
        {isLoading ? (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-stone-100 p-8 text-center text-stone-600">
            Loading Haley’s Organized Chaos...
          </div>
        ) : (
          <>
            {view === 'dashboard' && (
              <DashboardView
                metrics={metrics}
                majorTodos={majorTodos}
                onAddTodo={handleAddTodo}
                onToggleTodo={handleToggleTodo}
                onDeleteTodo={handleDeleteTodo}
                onOpenHoneybook={() => {
                  markSheetSeen('honeybook', sheetLastUpdated.honeybook);
                  setView('honeybook');
                  window.scrollTo(0, 0);
                }}
                onOpenVoicemails={() => {
                  markSheetSeen('voicemails', sheetLastUpdated.voicemails);
                  setView('voicemails');
                  window.scrollTo(0, 0);
                }}
                unreadHoneybook={sheetUnread.honeybook}
                unreadVoicemails={sheetUnread.voicemails}
              />
            )}
            {view === 'marketing' && (
              <EventManagementApp />
            )}
            {view === 'honeybook' && (
              <HoneybookMessagesView onBack={() => setView('dashboard')} />
            )}
            {view === 'voicemails' && (
              <VoicemailsView onBack={() => setView('dashboard')} />
            )}
            {['construction', 'grounds', 'interiors', 'docents', 'fund', 'events', 'marketing-ops', 'venue'].includes(view) && (
              <div className="max-w-4xl mx-auto fade-up">
                <div className="bg-white rounded-3xl border border-stone-100 p-6 md:p-8 card-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-display text-3xl text-ink">{sectionDetails[view].label}</h2>
                    <div className="flex items-center gap-2" />
                  </div>
                  <p className="text-stone-600 mt-2">Beginning 2026 snapshot.</p>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      const snapshot = sectionSnapshots[sectionDetails[view].key];
                      return (
                        <>
                          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                            <div className="text-xs uppercase tracking-wide text-steel">Lead name</div>
                            <div className="text-lg text-ink mt-2">{snapshot?.lead || 'N/A'}</div>
                          </div>
                          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                            <div className="text-xs uppercase tracking-wide text-steel">Budget</div>
                            <div className="text-lg text-ink mt-2">
                              {snapshot?.budget ? formatCurrency(snapshot.budget) : 'N/A'}
                            </div>
                          </div>
                          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                            <div className="text-xs uppercase tracking-wide text-steel">Volunteers (2026)</div>
                            <div className="text-lg text-ink mt-2">{snapshot?.volunteers || 'N/A'}</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                {(() => {
                  const areaLabel = sectionDetails[view].label;
                  const quarterPairs = [['Q1', 'Q2'], ['Q3', 'Q4']];
                  const quarterRanges = {
                    Q1: 'Jan 1 - Mar 31',
                    Q2: 'Apr 1 - Jun 30',
                    Q3: 'Jul 1 - Sep 30',
                    Q4: 'Oct 1 - Dec 31'
                  };
                  const quarterDueDates = {
                    Q1: 'Due: March 30th',
                    Q2: 'Due: June 30th',
                    Q3: 'Due: September 30th',
                    Q4: 'Due: December 31st'
                  };
                  const challengeLabels = {
                    capacity: 'Capacity or volunteer limitations',
                    budget: 'Budget or funding constraints',
                    scheduling: 'Scheduling or timing issues',
                    coordination: 'Cross-area coordination gaps',
                    external: 'External factors',
                    other: 'Other'
                  };
                  const supportLabels = {
                    staff: 'Staff or volunteer help',
                    marketing: 'Marketing or communications',
                    board: 'Board guidance or decision',
                    funding: 'Funding or fundraising support',
                    facilities: 'Facilities or logistics',
                    other: 'Other'
                  };

                  const getPreviousQuarter = (quarter) => {
                    switch (quarter) {
                      case 'Q2':
                        return 'Q1';
                      case 'Q3':
                        return 'Q2';
                      case 'Q4':
                        return 'Q3';
                      default:
                        return null;
                    }
                  };

                  const getLatestQuarterly = (quarter) => {
                    const matches = quarterlyUpdates
                      .filter((item) => item.focusArea === areaLabel && item.quarter === quarter)
                      .sort((a, b) => new Date(b.submittedDate || b.createdAt) - new Date(a.submittedDate || a.createdAt));
                    return matches[0];
                  };

                  const renderPrimaryCard = (quarter) => {
                    const isNoneNoted = (value) => String(value || '').trim().toLowerCase() === 'none noted';
                    const latest = getLatestQuarterly(quarter);
                    const payload = latest?.payload || {};
                    const previousQuarter = getPreviousQuarter(quarter);
                    const previousUpdate = previousQuarter ? getLatestQuarterly(previousQuarter) : null;
                    const previousPayload = previousUpdate?.payload || {};
                    const fallbackGoals = (previousPayload.nextPriorities || [])
                      .map((item) => ({ goal: item || '', status: '', summary: '' }))
                      .filter((goal) => String(goal.goal || '').trim() && !isNoneNoted(goal.goal));
                    const goals = (payload.goals && payload.goals.length)
                      ? payload.goals
                      : (fallbackGoals.length ? fallbackGoals : [{}, {}, {}]);
                    const primaryFocusValue = payload.primaryFocus
                      || (!isNoneNoted(previousPayload.nextQuarterFocus) ? previousPayload.nextQuarterFocus : '');
                    const isInlineEditing = inlineQuarterEdit?.areaLabel === areaLabel
                      && inlineQuarterEdit?.quarter === quarter;
                    const submittedDate = payload.submittedDate || latest?.submittedDate || '';
                    const showEdit = quarter === 'Q1';
                    return (
                      <div key={`primary-${quarter}`} className="bg-white rounded-3xl border border-stone-100 p-6 card-shadow quarter-card flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-xl font-display text-ink">{`${quarter} Primary Focus and Goals`}</div>
                          <div className="text-xs uppercase tracking-wide text-steel">{quarterRanges[quarter]}</div>
                        </div>
                        {isInlineEditing ? (
                          <div className="mt-4 space-y-4">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel font-semibold">Primary focus</div>
                              <textarea
                                value={inlineQuarterForm?.primaryFocus || ''}
                                onChange={(event) => setInlineQuarterForm((prev) => ({ ...prev, primaryFocus: event.target.value }))}
                                className="w-full mt-2 px-3 py-2 border border-stone-200 rounded-lg min-h-[100px]"
                                placeholder="Main priorities or themes."
                              />
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel font-semibold">Goals</div>
                              <div className="mt-2 space-y-3">
                                {(inlineQuarterForm?.goals || []).map((goal, idx) => (
                                  <div key={idx}>
                                    <input
                                      type="text"
                                      value={goal.goal}
                                      onChange={(event) => setInlineQuarterForm((prev) => ({
                                        ...prev,
                                        goals: prev.goals.map((item, i) => i === idx ? { ...item, goal: event.target.value } : item)
                                      }))}
                                      className="px-3 py-2 border border-stone-200 rounded-lg"
                                      placeholder={`Goal ${idx + 1}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => { setInlineQuarterEdit(null); setInlineQuarterForm(null); }}
                                className="px-3 py-2 border border-stone-200 rounded-lg text-sm"
                                disabled={isSavingInlineQuarter}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleInlineQuarterSave}
                                className="px-3 py-2 bg-gold text-white rounded-lg text-sm"
                                disabled={isSavingInlineQuarter}
                              >
                                {isSavingInlineQuarter ? 'Saving...' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-4 space-y-3 text-sm text-stone-700">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel font-semibold">Primary focus</div>
                              <div className="whitespace-pre-line">{primaryFocusValue || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel font-semibold">Goals</div>
                              <div className="space-y-1">
                                {goals.map((goal, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className="text-gold mt-0.5">
                                      <IconStar size={12} />
                                    </span>
                                    <div>
                                      <span>{goal.goal || '-'}</span>

                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="mt-4 flex items-center justify-between text-xs text-steel">
                          <div>{submittedDate ? formatDateNumeric(submittedDate) : '00-00-0000'}</div>
                          {showEdit && (
                            <button
                              type="button"
                              onClick={() => handleInlineQuarterEdit(areaLabel, quarter, latest, payload)}
                              className="px-2 py-1 border border-stone-200 rounded-lg text-xs"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  };
                  const renderOverviewCard = (quarter) => {
                    const latest = getLatestQuarterly(quarter);
                    const payload = latest?.payload || {};
                    const submittedDate = payload.submittedDate || latest?.submittedDate || '';
                    const challenges = payload.challenges || {};
                    const supportTypes = payload.supportTypes || {};
                    const challengesChecked = payload.challengesChecked || '';
                    const supportTypesChecked = payload.supportTypesChecked || '';
                    const challengeSelections = Object.keys(challengeLabels)
                      .filter((key) => challenges[key])
                      .map((key) => {
                        if (key === 'other' && challenges.otherText) {
                          return `Other: ${challenges.otherText}`;
                        }
                        return challengeLabels[key];
                      });
                    const supportSelections = Object.keys(supportLabels)
                      .filter((key) => supportTypes[key])
                      .map((key) => {
                        if (key === 'other' && supportTypes.otherText) {
                          return `Other: ${supportTypes.otherText}`;
                        }
                        return supportLabels[key];
                      });
                    const challengesCheckedDisplay = challengesChecked || (challengeSelections.length ? challengeSelections.join(', ') : '');
                    const supportTypesDisplay = supportTypesChecked || (supportSelections.length ? supportSelections.join(', ') : '');
                    const nextPriorities = payload.nextPriorities || [];
                    const filledNextPriorities = nextPriorities.filter((item) => String(item || '').trim());
                    const hasReflection = !!(
                      payload.wins
                      || challenges.details
                      || challengesCheckedDisplay
                      || payload.supportNeeded
                      || supportTypesDisplay
                      || payload.nextQuarterFocus
                      || filledNextPriorities.length
                      || payload.decisionsNeeded
                    );
                    return (
                      <div key={`overview-${quarter}`} className="bg-white rounded-3xl border border-stone-100 p-6 card-shadow quarter-card flex flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-display text-ink">{`${quarter} Quarterly Reflection`}</div>
                            <div className="text-xs uppercase tracking-wide text-steel">{quarterRanges[quarter]}</div>
                          </div>
                        <div className="text-right">
                          <div className="text-xs uppercase tracking-wide text-steel">{quarterDueDates[quarter]}</div>
                        </div>
                        </div>
                        {!latest || !hasReflection ? (
                          <div className="mt-4 text-sm text-stone-600">No submission yet.</div>
                        ) : (
                          <div className="mt-4 space-y-3 text-sm text-stone-700">
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel">What went well</div>
                              <div className="whitespace-pre-line">{payload.wins || 'None noted'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel">Challenges</div>
                              <div className="whitespace-pre-line">{challenges.details || 'None noted'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel">Challenges (checked)</div>
                              <div>{challengesCheckedDisplay || 'None noted'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel">Support needed</div>
                              <div className="whitespace-pre-line">{payload.supportNeeded || 'None noted'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel">Support types</div>
                              <div>{supportTypesDisplay || 'None noted'}</div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel">Next quarter focus area and goals</div>
                              <div className="whitespace-pre-line">{payload.nextQuarterFocus || 'None noted'}</div>
                              <div className="mt-2 space-y-1">
                                {filledNextPriorities.length ? filledNextPriorities.map((item, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <span className="text-gold mt-0.5">
                                      <IconStar size={12} />
                                    </span>
                                    <div>{item || '-'}</div>
                                  </div>
                                )) : <div>None noted</div>}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase tracking-wide text-steel">Other notes</div>
                              <div className="whitespace-pre-line">{payload.decisionsNeeded || 'None noted'}</div>
                            </div>
                          </div>
                        )}
                        <div className="mt-4 flex items-center justify-between text-xs text-steel">
                          <div>{submittedDate ? formatDateNumeric(submittedDate) : '00-00-0000'}</div>
                          <button
                            type="button"
                            onClick={() => handleEditQuarterly(areaLabel, quarter)}
                            className="px-2 py-1 border border-stone-200 rounded-lg text-xs"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    );
                  };

                  const renderReviewCard = (quarter) => {
                    const latest = getLatestQuarterly(quarter);
                    const review = latest?.payload?.review || null;
                    return (
                      <ReviewEditor
                        key={`review-${quarter}`}
                        areaLabel={areaLabel}
                        quarter={quarter}
                        review={review}
                        onSave={handleQuarterlyReviewSave}
                      />
                    );
                  };

                  return (
                    <div className="mt-6 space-y-6">
                      {quarterPairs.map((pair) => (
                        <div key={pair.join('-')} className="space-y-6">
                          <div className="grid grid-cols-2 gap-4">
                            {pair.map((quarter) => renderPrimaryCard(quarter))}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {pair.map((quarter) => renderOverviewCard(quarter))}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {pair.map((quarter) => renderReviewCard(quarter))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </main>

    </div>
  );
};

// ============================================================================
// RENDER
// ============================================================================

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<StrategyApp />);























