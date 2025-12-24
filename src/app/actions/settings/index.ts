/**
 * Barrel export para manter compatibilidade com imports existentes.
 * Re-exporta todas as actions de profile e scenario.
 */

// Company profile actions
export {
  saveProfile,
  updateProfile,
  getProfileById,
  deleteProfile,
} from "./company";

// Scenario actions
export { saveScenario, deleteScenario } from "./scenario";

// Re-exportar tipos para facilitar imports
export type { UpdateProfileInput, SaveScenarioInput } from "@/lib/scenarios";
