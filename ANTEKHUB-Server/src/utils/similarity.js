// Jaro & Jaro-Winkler untuk fuzzy matching
const normalize = (s = "") => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function jaro(a, b) {
  const s1 = a || "", s2 = b || "";
  if (!s1.length && !s2.length) return 1;
  const matchDistance = Math.max(0, Math.floor(Math.max(s1.length, s2.length) / 2) - 1);
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  let matches = 0, transpositions = 0;

  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, s2.length);
    for (let j = start; j < end; j++) {
      if (s2Matches[j]) continue;
      if (s1[i] !== s2[j]) continue;
      s1Matches[i] = true; s2Matches[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  return (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;
}

function jaroWinkler(a, b, p = 0.1) {
  const ja = jaro(a, b);
  const na = normalize(a), nb = normalize(b);
  let l = 0; const maxL = 4;
  while (l < Math.min(maxL, na.length, nb.length) && na[l] === nb[l]) l++;
  return ja + l * p * (1 - ja);
}

module.exports = { normalize, jaro, jaroWinkler };