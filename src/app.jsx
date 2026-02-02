const { useState, useEffect, useMemo } = React;

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
  { key: 'marketing', label: 'Marketing', sheet: 'Marketing' },
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

const DashboardView = ({ metrics, majorTodos, onAddTodo, onToggleTodo, onDeleteTodo }) => {
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
    Voicemails: 'https://northstarhouse.github.io/nsh-voicemails/',
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
        <div className="glass rounded-3xl p-6 md:p-8 card-shadow">
          <div className="flex items-center gap-3 text-gold">
            <IconSpark size={28} />
            <span className="text-xs uppercase tracking-wide">The Big Picture</span>
          </div>
          <h2 className="font-display text-xl md:text-2xl text-ink mt-4">Major Focus To-Do List</h2>
          <p className="text-stone-500 text-xs mt-1 mb-4">The items that matter most right now.</p>

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
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Donation total', value: formatCurrency(metrics?.donationsTotal) },
            { label: 'Events booked', value: formatCount(metrics?.eventsCount) },
            { label: 'Sponsors', value: formatCount(metrics?.sponsorsCount) },
            { label: 'Volunteers', value: formatCount(metrics?.volunteersCount) },
            { label: 'Voicemails', value: 'Voicemails' }
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
  const sectionDetails = SECTION_PAGES.reduce((acc, item) => {
    acc[item.key] = { label: item.label, key: item.sheet };
    return acc;
  }, {});

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
    const next = majorTodos.filter((t) => t.id !== id);
    saveMajorTodos(next);
    SheetsAPI.deleteMajorTodo(id);
  };

  useEffect(() => {
    loadData();
  }, []);

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
        saveMajorTodos(todosResult.value);
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
                <div className="font-display text-lg text-ink">Haley’s Star Command: Mission Control</div>
                <div className="text-xs text-steel">Progress tracker</div>
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
              />
            )}
            {['construction', 'grounds', 'interiors', 'docents', 'fund', 'events', 'marketing', 'venue'].includes(view) && (
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





















