const API_URL =
  import.meta.env.VITE_API_URL ||  "http://localhost:5000/api";

export const API_BASE = API_URL.replace(/\/api\/?$/, "");

export async function api(path, options = {}) {
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}
