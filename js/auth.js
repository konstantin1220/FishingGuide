// Clientseitige Mehrbenutzer-Accounts für den Freundeskreis-Test.
// Kein echter Server-Schutz: Konten, Passwort-Hashes und alle Nutzdaten
// liegen im localStorage DIESES Geräts. Jedes Konto sieht nur seine eigenen
// Daten (siehe Storage.setNamespace), aber jemand mit Zugriff aufs Gerät
// könnte technisch versiert alles einsehen/manipulieren. Reicht als
// Höflichkeitsschranke + Datentrennung für einen Freundeskreis, ersetzt
// aber kein echtes Server-Backend.
//
// Einladungscode ändern: neuen Hash erzeugen, z.B. in den Browser-Devtools:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('NeuerCode'))
//     .then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2,'0')).join('')))
// und den Wert unten bei INVITE_CODE_HASH einsetzen.
const Auth = (() => {
  const INVITE_CODE_HASH = 'cabba71d30a0d288e299798c6f68c9868ec81350da463ca27bcd7c6bbc4f1a6d'; // Einladungscode: siehe README
  const ACCOUNTS_KEY = 'fg_accounts';
  const SESSION_KEY = 'fg_session';

  async function sha256Hex(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function randomSalt() {
    const arr = crypto.getRandomValues(new Uint8Array(16));
    return [...arr].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function normalize(name) {
    return name.trim().toLowerCase().replace(/\s+/g, '-');
  }

  function readAccounts() {
    try {
      return JSON.parse(localStorage.getItem(ACCOUNTS_KEY)) || [];
    } catch {
      return [];
    }
  }

  function writeAccounts(list) {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list));
  }

  function findAccount(name) {
    const key = normalize(name);
    return readAccounts().find(a => a.username === key);
  }

  async function checkInviteCode(input) {
    return (await sha256Hex(input)) === INVITE_CODE_HASH;
  }

  async function register(displayName, password) {
    const username = normalize(displayName);
    if (!username) throw new Error('Bitte einen Namen angeben.');
    if (findAccount(username)) throw new Error('Dieser Name ist schon vergeben. Bitte anmelden statt registrieren.');
    if (!password || password.length < 4) throw new Error('Passwort muss mindestens 4 Zeichen haben.');
    const accounts = readAccounts();
    const isFirstAccount = accounts.length === 0;
    const salt = randomSalt();
    const hash = await sha256Hex(salt + password);
    accounts.push({ username, displayName: displayName.trim(), salt, hash });
    writeAccounts(accounts);
    localStorage.setItem(SESSION_KEY, username);
    if (isFirstAccount) Storage.migrateLegacyInto(username);
    return username;
  }

  async function login(displayName, password) {
    const account = findAccount(displayName);
    if (!account) throw new Error('Kein Konto mit diesem Namen gefunden.');
    const hash = await sha256Hex(account.salt + password);
    if (hash !== account.hash) throw new Error('Falsches Passwort.');
    localStorage.setItem(SESSION_KEY, account.username);
    return account.username;
  }

  function isLoggedIn() {
    return !!localStorage.getItem(SESSION_KEY);
  }

  function currentUsername() {
    return localStorage.getItem(SESSION_KEY) || '';
  }

  function currentDisplayName() {
    const account = readAccounts().find(a => a.username === currentUsername());
    return account ? account.displayName : currentUsername();
  }

  function logout() {
    localStorage.removeItem(SESSION_KEY);
  }

  return {
    checkInviteCode, register, login, logout, isLoggedIn, currentUsername, currentDisplayName,
  };
})();
