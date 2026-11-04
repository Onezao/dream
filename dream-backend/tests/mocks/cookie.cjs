/** (c) 2024-2026 Topee (https://topee.top). All rights reserved. Proprietary and confidential. */

module.exports = {
  stringifySetCookie: (cookie) => `${cookie.name}=${cookie.value}`,
  parseCookie: () => ({}),
  parseSetCookie: () => ({}),
  stringifyCookie: () => '',
};
