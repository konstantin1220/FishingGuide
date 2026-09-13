// Einfacher clientseitiger Zugriffsschutz für den Freundeskreis-Test.
// Kein echter Server-Schutz (Code liegt als Hash im Quelltext, wer die App
// vollständig herunterlädt könnte ihn per Brute-Force knacken) - reicht aber
// aus, um die App nicht offen für jeden Google-Fund zu machen.
//
// Zugangscode ändern: neuen Hash erzeugen, z.B. im Browser-Devtools-Konsole:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('NeuerCode'))
//     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
// und den Wert unten bei CODE_HASH einsetzen.
const Auth = (() => {
  const CODE_HASH = 'cabba71d30a0d288e299798c6f68c9868ec81350da463ca27bcd7c6bbc4f1a6d'; // Zugangscode: siehe README
  const USER_KEY = 'fg_user';

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function checkCode(input) {
    return (await sha256Hex(input)) === CODE_HASH;
  }

  function isLoggedIn() {
    return !!localStorage.getItem(USER_KEY);
  }

  function login(name) {
    localStorage.setItem(USER_KEY, name);
  }

  function logout() {
    localStorage.removeItem(USER_KEY);
  }

  function currentUser() {
    return localStorage.getItem(USER_KEY) || '';
  }

  return { checkCode, isLoggedIn, login, logout, currentUser };
})();
