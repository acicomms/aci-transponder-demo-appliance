// Date helpers for the NMS frontend.
// export function toLocalIso(d) {
//   const pad = (n) => String(n).padStart(2, '0');
//   return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
//     `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
// }

export function toLocalIso(d) {
  return d.toISOString();
}