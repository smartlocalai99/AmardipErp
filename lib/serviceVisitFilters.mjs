function padTwoDigits(value) {
  return String(value).padStart(2, "0");
}

export function getServicePeriodRange(yearValue, monthValue) {
  const yearText = String(yearValue || "").trim();
  const monthText = String(monthValue || "").trim();

  if (!/^\d{4}$/.test(yearText)) return null;

  const year = Number(yearText);
  if (year < 1900 || year > 2200) return null;

  if (!monthText) {
    return {
      fromDate: `${year}-01-01`,
      toDateExclusive: `${year + 1}-01-01`,
    };
  }

  if (!/^\d{1,2}$/.test(monthText)) return null;

  const month = Number(monthText);
  if (month < 1 || month > 12) return null;

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;

  return {
    fromDate: `${year}-${padTwoDigits(month)}-01`,
    toDateExclusive: `${nextYear}-${padTwoDigits(nextMonth)}-01`,
  };
}
