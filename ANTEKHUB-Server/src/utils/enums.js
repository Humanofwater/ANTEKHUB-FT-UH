exports.STRATA_BY_DIGIT = { 1: "Sarjana", 2: "Magister", 3: "Doktor" };
exports.ENUMS = {
  agama: new Set([
    "Islam",
    "Kristen Protestan",
    "Kristen Katholik",
    "Hindu",
    "Buddha",
    "Konghucu",
    "Lainnya",
  ]),
  nilai_ujian: new Set(["Memuaskan", "Sangat Memuaskan", "Dengan Pujian"]),
  predikat_kelulusan: new Set(["Memuaskan", "Sangat Memuaskan", "Cum Laude"]),
};
exports.ALIAS = {
  agama: {
    katolik: "Kristen Katholik",
    katholik: "Kristen Katholik",
    protestan: "Kristen Protestan",
    budha: "Buddha",
    buddha: "Buddha",
  },
  predikat_kelulusan: {
    cumlaude: "Cum Laude",
    "dengan pujian": "Cum Laude",
    "sangat memuaskan": "Sangat Memuaskan",
    memuaskan: "Memuaskan",
  },
  nilai_ujian: {
    cumlaude: "Dengan Pujian",
    "dengan pujian": "Dengan Pujian",
    "sangat memuaskan": "Sangat Memuaskan",
    memuaskan: "Memuaskan",
  },
};
