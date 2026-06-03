// Temperature unit helpers.
// Protocol values are always Celsius; Fahrenheit is a display-only conversion.
// -999 is the "not yet synced" sentinel used by live measurements.

export const cToF = (c) => (c * 9) / 5 + 32;
export const fToC = (f) => ((f - 32) * 5) / 9;
export const round1 = (n) => Math.round(n * 10) / 10;

// Format a Celsius value for display in the chosen unit ('C' | 'F').
// Returns an em-dash for null / sentinel / NaN.
export const formatTemp = (celsius, unit) => {
  if (celsius === null || celsius === undefined) return '—';
  const c = Number(celsius);
  if (Number.isNaN(c) || c === -999 || c === -999.0) return '—';
  return unit === 'F'
    ? `${round1(cToF(c)).toFixed(1)} °F`
    : `${c.toFixed(1)} °C`;
};