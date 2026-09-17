import { backend } from "./backend";
export const defaultSettings = {
  id: 1,
  is_open: true,
  opens_at: "08:00",
  closes_at: "22:00",
  closed_message:
    "We’re closed for now. Please visit again during store hours.",
  delivery_pincodes: ["713409"],
  delivery_fee: 0,
  minimum_order: 0,
  support_phone: "",
};
export async function getSettings() {
  if (backend) {
    const { data, error } = await backend
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .single();
    if (error) throw error;
    return data;
  }
  try {
    return {
      ...defaultSettings,
      ...JSON.parse(localStorage.getItem("kalna-settings-v1") || "{}"),
    };
  } catch {
    return defaultSettings;
  }
}
export async function saveSettings(settings) {
  if (backend) {
    const { error } = await backend
      .from("store_settings")
      .update(settings)
      .eq("id", 1);
    if (error) throw error;
  } else localStorage.setItem("kalna-settings-v1", JSON.stringify(settings));
  window.dispatchEvent(new Event("store-settings-changed"));
}
export { openNow } from "../server/hours.js";
