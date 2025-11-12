const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const addYears = (d, n) =>
  new Date(
    d.getFullYear() + n,
    d.getMonth(),
    d.getDate(),
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  );
const isSameMonth = (a, b) =>
  a.getUTCFullYear() === b.getUTCFullYear() &&
  a.getUTCMonth() === b.getUTCMonth();
module.exports = { addDays, addYears, isSameMonth };
