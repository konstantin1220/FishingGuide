// Gruppen-Feature (Gruppen/Mitglieder/Leaderboard) über Supabase.
// Persönliche Angel-Daten bleiben komplett lokal - dieses Modul betrifft
// ausschließlich Gruppen-bezogene Daten (siehe supabase/schema.sql).
//
// Project URL + Publishable Key sind absichtlich clientseitig sichtbar:
// Absicherung erfolgt über Row-Level-Security-Regeln in der Datenbank,
// nicht durch Geheimhaltung dieser Werte (Supabase-Standardmodell).
const SB = (() => {
  const SUPABASE_URL = 'https://zcgltmednexquyzueqdc.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tLXoTU6J1fFT4owdxbPYkA_i9xTMknb';

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let sessionPromise = null;

  function ensureSession() {
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const { data } = await client.auth.getSession();
        if (data.session) return data.session;
        const { data: signInData, error } = await client.auth.signInAnonymously();
        if (error) throw error;
        return signInData.session;
      })();
    }
    return sessionPromise;
  }

  async function createGroup(name, displayName) {
    await ensureSession();
    const { data, error } = await client.rpc('create_group', { p_name: name, p_display_name: displayName });
    if (error) throw error;
    return data;
  }

  async function joinGroup(code, displayName) {
    await ensureSession();
    const { data, error } = await client.rpc('join_group', { p_code: code, p_display_name: displayName });
    if (error) throw new Error(error.message === 'invalid_code' || error.code === 'P0001' ? 'invalid_code' : error.message);
    return data;
  }

  async function listMyGroups() {
    await ensureSession();
    const { data, error } = await client.from('groups').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  }

  async function listMembers(groupId) {
    await ensureSession();
    const { data, error } = await client
      .from('group_members')
      .select('user_id, joined_at, profiles(display_name)')
      .eq('group_id', groupId);
    if (error) throw error;
    return data.map(m => ({ userId: m.user_id, joinedAt: m.joined_at, displayName: m.profiles?.display_name || '?' }));
  }

  async function listLeaderboard(groupId) {
    await ensureSession();
    const { data, error } = await client
      .from('group_stats')
      .select('user_id, total_faenge, biggest_fish_art, biggest_fish_laenge, profiles(display_name)')
      .eq('group_id', groupId)
      .order('total_faenge', { ascending: false });
    if (error) throw error;
    return data.map(s => ({
      userId: s.user_id,
      displayName: s.profiles?.display_name || '?',
      totalFaenge: s.total_faenge,
      biggestFishArt: s.biggest_fish_art,
      biggestFishLaenge: s.biggest_fish_laenge,
    }));
  }

  async function syncStats(groupId, totalFaenge, biggestFishArt, biggestFishLaenge) {
    await ensureSession();
    const { error } = await client.rpc('sync_stats', {
      p_group_id: groupId,
      p_total: totalFaenge,
      p_art: biggestFishArt,
      p_laenge: biggestFishLaenge,
    });
    if (error) throw error;
  }

  return { ensureSession, createGroup, joinGroup, listMyGroups, listMembers, listLeaderboard, syncStats };
})();
