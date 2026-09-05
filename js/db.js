/**
 * DB Layer
 * LocalStorage-backed database with a Supabase-ready interface.
 * Swap `storage` to Supabase by setting SUPABASE_URL/SUPABASE_ANON_KEY.
 */
const DB = (() => {
  const PREFIX = 'hiredhunter_v1_';
  const COLLECTIONS = ['jobs', 'scraped', 'recruiters', 'emails', 'settings', 'resume', 'alerts'];

  function defaultData() {
    return {
      jobs: [],
      scraped: [],
      recruiters: [],
      emails: [],
      settings: { resendKey: '', openaiKey: '', senderName: '', senderEmail: '', headline: '' },
      resume: null,
      alerts: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(PREFIX + 'db');
      if (!raw) return defaultData();
      return { ...defaultData(), ...JSON.parse(raw) };
    } catch (e) {
      return defaultData();
    }
  }

  function save(state) {
    localStorage.setItem(PREFIX + 'db', JSON.stringify(state));
  }

  const store = { state: load() };
  const persist = () => save(store.state);

  const db = {
    get collection() { return store.state; },

    isSupabase() {
      return typeof window !== 'undefined' && window.SUPABASE_CLIENT;
    },

    /** Async-friendly upsert. Falls back to localStorage. */
    async upsert(collection, doc) {
      if (db.isSupabase()) {
        return window.SUPABASE_CLIENT.from(collection).upsert(doc);
      }
      const list = store.state[collection] || [];
      const idx = list.findIndex((d) => d.id === doc.id);
      if (idx >= 0) list[idx] = { ...list[idx], ...doc };
      else list.unshift(doc);
      store.state[collection] = list;
      persist();
      return { data: doc, error: null };
    },

    async insert(collection, docs) {
      const items = Array.isArray(docs) ? docs : [docs];
      for (const d of items) {
        if (!d.id) d.id = uid();
        d.createdAt = d.createdAt || new Date().toISOString();
        await db.upsert(collection, d);
      }
      return items;
    },

    async getAll(collection) {
      if (db.isSupabase()) {
        const { data } = await window.SUPABASE_CLIENT.from(collection).select('*');
        return data || [];
      }
      return store.state[collection] || [];
    },

    async remove(collection, id) {
      if (db.isSupabase()) {
        return window.SUPABASE_CLIENT.from(collection).delete().eq('id', id);
      }
      store.state[collection] = (store.state[collection] || []).filter((d) => d.id !== id);
      persist();
      return { data: null, error: null };
    },

    async saveSettings(settings) {
      store.state.settings = { ...store.state.settings, ...settings };
      persist();
      return store.state.settings;
    },

    async saveResume(resume, isTailored) {
      store.state.resume = { base: !isTailored ? resume : store.state.resume.base, ...(isTailored ? {} : {}) };
      persist();
      return store.state.resume;
    },

    clear() {
      COLLECTIONS.forEach((c) => store.state[c] = defaultData()[c] || []);
      persist();
    },

    exportAll() {
      return JSON.stringify(store.state, null, 2);
    },
  };

  return db;
})();

function uid() {
  return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadSupabaseClient() {
  if (!window.JS_ENV || !window.JS_ENV.SUPABASE_URL || !window.JS_ENV.SUPABASE_ANON_KEY) return;
  if (typeof window.supabase === 'undefined') return;
  window.SUPABASE_CLIENT = window.supabase.createClient(window.JS_ENV.SUPABASE_URL, window.JS_ENV.SUPABASE_ANON_KEY);
}
