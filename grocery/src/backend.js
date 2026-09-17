// Same-origin API proxy to the existing Render / MongoDB backend.
export const isLive = Boolean(import.meta.env.VITE_GROCERY_API);
const base = import.meta.env.VITE_GROCERY_API || "/api/grocery";
let session = null;
const listeners = new Set();
const notify = (next) => {
  session = next;
  for (const fn of listeners) fn("SESSION_CHANGED", next);
};
async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(`${base}/${path}`, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "KalnaDaily",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(45000),
  });
  const data = await res.json().catch(() => ({
    error: "The store service is unavailable. Please retry.",
  }));
  if (!res.ok) {
    const error = new Error(
      data.error || data.message || "The request could not be completed.",
    );
    error.status = res.status;
    throw error;
  }
  return data;
}
const result = async (fn) => {
  try {
    return { data: await fn(), error: null };
  } catch (error) {
    return { data: null, error };
  }
};
function from(table) {
  const filters = {},
    state = {};
  const query = {
    select() {
      return query;
    },
    eq(k, v) {
      filters[k] = v;
      return query;
    },
    in(k, v) {
      filters[k] = v;
      return query;
    },
    order() {
      return query;
    },
    limit() {
      return query;
    },
    update(value) {
      state.update = value;
      return query;
    },
    async maybeSingle() {
      const r = await execute();
      return { ...r, data: Array.isArray(r.data) ? r.data[0] || null : r.data };
    },
    async single() {
      return query.maybeSingle();
    },
    then(resolve, reject) {
      return execute().then(resolve, reject);
    },
  };
  async function execute() {
    return result(async () => {
      if (table === "store_admins")
        return session?.user.role === "admin"
          ? [{ user_id: session.user.id }]
          : [];
      if (table === "store_settings")
        return state.update
          ? request("settings", { method: "POST", body: state.update })
          : request("settings");
      if (table === "grocery_orders")
        return request(
          `orders${filters.driver_id ? "?driver=true" : filters.view === "admin" ? "?admin=true" : ""}`,
        );
      if (table === "grocery_delivery_codes") return request("delivery-codes");
      if (table === "grocery_drivers") {
        let rows = await request("drivers");
        if (filters.user_id)
          rows = rows.filter((d) => d.user_id === filters.user_id);
        if (filters.active !== undefined)
          rows = rows.filter((d) => d.active === filters.active);
        return rows;
      }
      throw new Error("Unknown store resource.");
    });
  }
  return query;
}
export const backend = isLive
  ? {
      from,
      auth: {
        async getSession() {
          try {
            const data = await request("auth/session");
            session = { user: data.user };
            return { data: { session } };
          } catch (e) {
            if (e.status === 401) {
              session = null;
              return { data: { session: null } };
            }
            throw e;
          }
        },
        onAuthStateChange(fn) {
          listeners.add(fn);
          return {
            data: { subscription: { unsubscribe: () => listeners.delete(fn) } },
          };
        },
        async signInWithOtp({ email }) {
          return result(() =>
            request("auth/send", { method: "POST", body: { email } }),
          );
        },
        async verifyOtp({ email, token }) {
          return result(async () => {
            const data = await request("auth/verify", {
              method: "POST",
              body: { email, token },
            });
            const full = await request("auth/session");
            notify({ user: full.user });
            return data;
          });
        },
        async signOut() {
          await request("auth/logout", { method: "POST", body: {} });
          notify(null);
        },
      },
    }
  : null;
export async function loadCatalog() {
  if (!session) {
    try {
      await backend.auth.getSession();
    } catch {}
  }
  return request(session?.user.role === "admin" ? "admin/catalog" : "catalog");
}
export async function saveProduct(product) {
  return request("catalog", { method: "POST", body: product });
}
export async function uploadPhoto(file) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 1500000
  )
    throw new Error("Choose a PNG, JPEG, or WebP smaller than 1.5 MB.");
  const image = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read photo."));
    reader.readAsDataURL(file);
  });
  return (await request("photo", { method: "POST", body: { image } })).url;
}
export async function callApi(action, body) {
  return request(action, { method: "POST", body });
}

export async function ensureCheckoutSession() {
  const current = await backend.auth.getSession();
  if (!current.data.session || current.data.session.user.guest)
    throw new Error("Please verify your email to continue.");
  return current.data.session;
}
