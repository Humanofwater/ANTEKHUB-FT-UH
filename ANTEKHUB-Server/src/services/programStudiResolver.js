// =============================================
// File: src/services/programStudiResolver.js
// =============================================
const { Op } = require("sequelize");
const { STRATA_BY_DIGIT } = require("../utils/enums");

async function resolveProgramStudi(models, sheetName /*, sampleNim */) {
  const warnings = [];
  if (!sheetName || sheetName.length < 4)
    return { programStudi: null, warnings: ["Nama sheet tidak 4 karakter"] };

  const code4 = sheetName.trim().toUpperCase().slice(0, 4);
  if (code4.startsWith("P")) {
    return {
      programStudi: null,
      warnings: ["Prefix P diabaikan sesuai kebijakan"],
      skip: true,
    };
  }

  const digit = code4[3];
  let strataLabel = STRATA_BY_DIGIT[digit] || null;
  if (code4 === "D014") strataLabel = "Insinyur";
  if (code4 === "D024") strataLabel = "Profesi Arsitektur";

  const ProgramStudi = models.ProgramStudi;
  let ps = await ProgramStudi.findOne({
    where: { kode: { [Op.contains]: [code4] } },
  }).catch(() => null);
  if (!ps) {
    const base = code4.slice(0, 3) + digit;
    ps = await ProgramStudi.findOne({
      where: { kode: { [Op.contains]: [base] } },
    }).catch(() => null);
  }

  if (!ps) {
    // AUTO-CREATE prodi baru placeholder
    const nama = `(UNKNOWN) ${code4}`;
    try {
      ps = await ProgramStudi.create({
        nama,
        strata: strataLabel || "Sarjana",
        kode: [code4],
      });
      return { programStudi: ps, created: true, warnings, strataLabel };
    } catch (e) {
      warnings.push(
        `Gagal auto-create program_studi untuk ${code4}: ${e.message}`
      );
      return { programStudi: null, warnings, strataLabel };
    }
  }

  if (strataLabel && ps.strata && ps.strata !== strataLabel) {
    warnings.push(
      `Strata sheet (${strataLabel}) ≠ strata prodi (${ps.strata})`
    );
  }

  return { programStudi: ps, created: false, warnings, strataLabel };
}

module.exports = { resolveProgramStudi };
