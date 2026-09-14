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

  // Die Supabase-Anon-Sitzung wird pro lokalem App-Konto unter einem eigenen
  // localStorage-Key gespeichert (statt einem einzigen, browserweiten Key).
  // Grund: teilen sich mehrere Freunde ein Gerät mit je eigenem FishingGuide-
  // Konto, sollen sie in Gruppen auch als unterschiedliche Personen zählen -
  // nicht als eine geteilte, browserweite Supabase-Identität.
  let client = null;
  let currentAccount = null;
  let sessionPromise = null;
  let currentUserId = null;
  let chatChannel = null;

  function setAccount(username) {
    if (username === currentAccount && client) return;
    currentAccount = username;
    sessionPromise = null;
    currentUserId = null;
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { storageKey: `sb-fg-${username}-auth-token` },
    });
  }

  function ensureSession() {
    if (!client) throw new Error('SB.setAccount() muss vor der ersten Nutzung aufgerufen werden.');
    if (!sessionPromise) {
      sessionPromise = (async () => {
        const { data } = await client.auth.getSession();
        if (data.session) { currentUserId = data.session.user.id; return data.session; }
        const { data: signInData, error } = await client.auth.signInAnonymously();
        if (error) throw error;
        currentUserId = signInData.session.user.id;
        return signInData.session;
      })();
    }
    return sessionPromise;
  }

  function myUserId() {
    return currentUserId;
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

  async function leaveGroup(groupId) {
    await ensureSession();
    const { error } = await client.rpc('leave_group', { p_group_id: groupId });
    if (error) throw error;
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
      .select('user_id, joined_at, profiles!user_id(display_name)')
      .eq('group_id', groupId);
    if (error) throw error;
    return data.map(m => ({ userId: m.user_id, joinedAt: m.joined_at, displayName: m.profiles?.display_name || '?' }));
  }

  async function listLeaderboard(groupId) {
    await ensureSession();
    const { data, error } = await client
      .from('group_stats')
      .select(`
        user_id, total_faenge, biggest_fish_art, biggest_fish_laenge,
        last_fish_art, last_fish_koeder, last_fish_image_path,
        profiles!user_id(display_name)
      `)
      .eq('group_id', groupId)
      .order('total_faenge', { ascending: false });
    if (error) throw error;
    const imagePaths = data.filter(s => s.last_fish_image_path).map(s => s.last_fish_image_path);
    const signedUrls = imagePaths.length
      ? await client.storage.from('group-catches').createSignedUrls(imagePaths, 3600).then(r => {
        const map = {};
        (r.data || []).forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; });
        return map;
      })
      : {};
    return data.map(s => ({
      userId: s.user_id,
      displayName: s.profiles?.display_name || '?',
      totalFaenge: s.total_faenge,
      biggestFishArt: s.biggest_fish_art,
      biggestFishLaenge: s.biggest_fish_laenge,
      lastFishArt: s.last_fish_art,
      lastFishKoeder: s.last_fish_koeder,
      lastFishImageUrl: s.last_fish_image_path ? signedUrls[s.last_fish_image_path] : null,
    }));
  }

  async function syncStats(groupId, totalFaenge, biggestFishArt, biggestFishLaenge, lastFishArt, lastFishKoeder, lastFishImagePath) {
    await ensureSession();
    const { error } = await client.rpc('sync_stats', {
      p_group_id: groupId,
      p_total: totalFaenge,
      p_art: biggestFishArt,
      p_laenge: biggestFishLaenge,
      p_last_art: lastFishArt || null,
      p_last_koeder: lastFishKoeder || null,
      p_last_image_path: lastFishImagePath || null,
    });
    if (error) throw error;
  }

  // ---------- Gruppen-Chat ----------

  async function listMessages(groupId) {
    await ensureSession();
    const { data, error } = await client
      .from('group_messages')
      .select('id, user_id, body, image_path, created_at, profiles!user_id(display_name)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(50);
    if (error) throw error;
    return data.map(m => ({
      id: m.id,
      userId: m.user_id,
      displayName: m.profiles?.display_name || '?',
      body: m.body,
      imagePath: m.image_path,
      createdAt: m.created_at,
    }));
  }

  async function sendMessage(groupId, body, imagePath) {
    await ensureSession();
    const { data, error } = await client
      .from('group_messages')
      .insert({ group_id: groupId, user_id: currentUserId, body: body || null, image_path: imagePath || null })
      .select('id, user_id, body, image_path, created_at')
      .single();
    if (error) throw error;
    return { id: data.id, userId: data.user_id, body: data.body, imagePath: data.image_path, createdAt: data.created_at };
  }

  async function deleteMessage(messageId) {
    await ensureSession();
    const { error } = await client.from('group_messages').delete().eq('id', messageId);
    if (error) throw error;
  }

  // Skaliert/komprimiert ein Bild clientseitig, damit hochgeladene Fotos
  // nicht unnötig Speicherplatz fressen. maxSide/quality konfigurierbar,
  // da Chat-Bilder (Vollbild-Ansicht) größer bleiben dürfen als kleine
  // Leaderboard-Teaser-Fotos (siehe uploadCatchImage/Fanglog).
  function compressImage(file, { maxSide = 1600, quality = 0.82 } = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht verarbeitet werden.'))), 'image/jpeg', quality);
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'));
      img.src = URL.createObjectURL(file);
    });
  }

  async function uploadChatImage(groupId, file) {
    await ensureSession();
    const blob = await compressImage(file);
    const path = `${groupId}/${crypto.randomUUID()}.jpg`;
    const { error } = await client.storage.from('group-chat').upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  }

  // Fester Dateiname pro Nutzer+Gruppe: ein erneuter Sync überschreibt das
  // vorherige Foto (upsert), statt verwaiste Dateien anzuhäufen.
  async function uploadCatchImage(groupId, blob) {
    await ensureSession();
    const path = `${groupId}/${currentUserId}-latest.jpg`;
    const { error } = await client.storage.from('group-catches').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (error) throw error;
    return path;
  }

  async function getSignedImageUrls(paths) {
    if (!paths.length) return {};
    await ensureSession();
    const { data, error } = await client.storage.from('group-chat').createSignedUrls(paths, 3600);
    if (error) throw error;
    const map = {};
    data.forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; });
    return map;
  }

  async function listReactions(messageIds) {
    if (!messageIds.length) return [];
    await ensureSession();
    const { data, error } = await client
      .from('message_reactions')
      .select('message_id, user_id, emoji')
      .in('message_id', messageIds);
    if (error) throw error;
    return data.map(r => ({ messageId: r.message_id, userId: r.user_id, emoji: r.emoji }));
  }

  async function toggleReaction(messageId, emoji) {
    await ensureSession();
    const { error } = await client
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: currentUserId, emoji });
    if (!error) return 'added';
    if (error.code === '23505') {
      const { error: delError } = await client
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId).eq('user_id', currentUserId).eq('emoji', emoji);
      if (delError) throw delError;
      return 'removed';
    }
    throw error;
  }

  function subscribeToChat(groupId, { onMessage, onMessageDelete, onReactionChange } = {}) {
    unsubscribeFromChat();
    chatChannel = client
      .channel(`chat-${groupId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        payload => onMessage && onMessage(payload.new))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'group_messages', filter: `group_id=eq.${groupId}` },
        payload => onMessageDelete && onMessageDelete(payload.old))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' },
        () => onReactionChange && onReactionChange())
      .subscribe();
  }

  function unsubscribeFromChat() {
    if (chatChannel) { client.removeChannel(chatChannel); chatChannel = null; }
  }

  return {
    setAccount, ensureSession, myUserId, createGroup, joinGroup, leaveGroup, listMyGroups, listMembers, listLeaderboard, syncStats,
    listMessages, sendMessage, deleteMessage, compressImage, uploadChatImage, uploadCatchImage, getSignedImageUrls, listReactions, toggleReaction,
    subscribeToChat, unsubscribeFromChat,
  };
})();
