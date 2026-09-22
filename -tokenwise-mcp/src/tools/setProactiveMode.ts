import { setProactivePreference } from "../utils/proactivePrefs.js";

export function setProactiveMode(enabled: boolean): { success: boolean; enabled: boolean; message: string } {
  setProactivePreference(enabled);
  return {
    success: true,
    enabled,
    message: enabled
      ? "Proactive mode enabled. tokenwise tools will be used automatically when helpful, without being asked, until told otherwise."
      : "Proactive mode disabled. tokenwise tools will only be used when explicitly requested. This can be turned back on by asking.",
  };
}
