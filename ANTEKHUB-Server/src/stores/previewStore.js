// =============================================
// File: src/stores/previewStore.js
// =============================================
const { v4: uuidv4 } = require("uuid");
class PreviewStore {
  constructor() {
    this.runs = new Map();
  }
  createRun(payload) {
    const id = uuidv4();
    this.runs.set(id, { id, createdAt: new Date().toISOString(), ...payload });
    return id;
  }
  getRun(id) {
    return this.runs.get(id) || null;
  }
  updateRun(id, patch) {
    const r = this.getRun(id);
    if (!r) return null;
    const merged = { ...r, ...patch };
    this.runs.set(id, merged);
    return merged;
  }
  removeRun(id) {
    return this.runs.delete(id);
  }
}
module.exports = new PreviewStore();
