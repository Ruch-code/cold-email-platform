/**
 * DB Layer - User-isolated with Supabase RLS support
 * Falls back to localStorage when Supabase not configured
 */
const DB = (() => {
  const PREFIX = 'hiredhunter_v2_';
  const COLLECTIONS = ['jobs', 'scraped', 'recruiters', 'emails', 'settings', 'resume', 'alerts', 'cover_letters', 'applications', 'salary_estimates'];

  function defaultData() {
    return {
      jobs: [],
      scraped: [],
      recruiters: [],
      emails: [],
      settings: { resendKey: '', openaiKey: '', senderName: '', senderEmail: '', headline: '' },
      resume: null,
      alerts: [],
      cover_letters: [],
      applications: [],
      salary_estimates: [],
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

  function isAuthed() {
    return window.SUPABASE_CLIENT && window.SUPABASE_USER;
  }

  function getUserId() {
    return window.SUPABASE_USER?.id || 'local';
  }

  const db = {
    get collection() { return store.state; },

    isSupabase() {
      return isAuthed();
    },

    async upsert(collection, doc) {
      if (db.isSupabase()) {
        const supabase = window.SUPABASE_CLIENT;
        const { data, error } = await supabase
          .from(collection)
          .upsert({ ...doc, user_id: getUserId() });
        return { data, error };
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
        d.user_id = getUserId();
        await db.upsert(collection, d);
      }
      return items;
    },

    async getAll(collection, opts = {}) {
      if (db.isSupabase()) {
        const supabase = window.SUPABASE_CLIENT;
        let query = supabase.from(collection).select('*').eq('user_id', getUserId());
        if (opts.order) query = query.order(opts.order.column, { ascending: opts.order.asc });
        if (opts.limit) query = query.limit(opts.limit);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      }
      return store.state[collection] || [];
    },

    async getOne(collection, id) {
      if (db.isSupabase()) {
        const supabase = window.SUPABASE_CLIENT;
        const { data, error } = await supabase
          .from(collection)
          .select('*')
          .eq('id', id)
          .eq('user_id', getUserId())
          .single();
        return { data, error };
      }
      const item = (store.state[collection] || []).find((d) => d.id === id);
      return { data: item || null, error: item ? null : { message: 'Not found' } };
    },

    async remove(collection, id) {
      if (db.isSupabase()) {
        const supabase = window.SUPABASE_CLIENT;
        return supabase.from(collection).delete().eq('id', id).eq('user_id', getUserId());
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

    async saveResume(resume) {
      store.state.resume = resume;
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

    onAuthChange(user) {
      window.SUPABASE_USER = user;
      if (user) {
        this.loadFromSupabase();
      } else {
        store.state = load();
      }
    },

    async loadFromSupabase() {
      if (!db.isSupabase()) return;
      try {
        for (const col of COLLECTIONS) {
          const data = await db.getAll(col, { order: { column: 'createdAt', asc: false } });
          store.state[col] = data;
        }
        persist();
      } catch (e) {
        console.error('Failed to load from Supabase:', e);
      }
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

  // Listen for auth changes
  window.SUPABASE_CLIENT.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      window.SUPABASE_USER = session.user;
      await DB.loadFromSupabase();
      if (typeof renderDashboard === 'function') renderDashboard();
    } else if (event === 'SIGNED_OUT') {
      window.SUPABASE_USER = null;
      DB.clear();
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  });
}