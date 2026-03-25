// ===================== Supabase Configuration & Helpers =====================
// Shared namespace
window.Convo = window.Convo || {};

const SUPABASE_URL = 'https://kvrbkkioqxcomjazfwoh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt2cmJra2lvcXhjb21qYXpmd29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzOTY4NDUsImV4cCI6MjA4OTk3Mjg0NX0.SqgHc09o9CKJQeqyzYWiayp52XPgqRB__DEqiPJTi1s';

/*
  SUPABASE SETUP INSTRUCTIONS:
  =============================
  1. Create a new Supabase project at https://supabase.com
  2. Go to SQL Editor and run these queries:

  -- Users table
  CREATE TABLE users (
    id text PRIMARY KEY,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text UNIQUE NOT NULL,
    username text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    is_admin boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE users ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read users"
    ON users FOR SELECT USING (true);

  CREATE POLICY "Anyone can register"
    ON users FOR INSERT WITH CHECK (true);

  -- Messages table (public chat)
  CREATE TABLE messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id text REFERENCES users(id),
    username text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read messages"
    ON messages FOR SELECT USING (true);

  CREATE POLICY "Registered users can send messages"
    ON messages FOR INSERT WITH CHECK (true);

  -- Contacts table
  CREATE TABLE contacts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id text REFERENCES users(id) NOT NULL,
    contact_id text REFERENCES users(id) NOT NULL,
    contact_name text NOT NULL,
    is_favorite boolean DEFAULT false,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, contact_id)
  );

  ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read contacts"
    ON contacts FOR SELECT USING (true);
  CREATE POLICY "Anyone can insert contacts"
    ON contacts FOR INSERT WITH CHECK (true);
  CREATE POLICY "Anyone can update contacts"
    ON contacts FOR UPDATE USING (true);
  CREATE POLICY "Anyone can delete contacts"
    ON contacts FOR DELETE USING (true);

  -- Private Messages table (DMs)
  CREATE TABLE private_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_id text REFERENCES users(id) NOT NULL,
    receiver_id text REFERENCES users(id) NOT NULL,
    sender_name text NOT NULL,
    content text NOT NULL,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE private_messages ENABLE ROW LEVEL SECURITY;

  CREATE POLICY "Anyone can read DMs"
    ON private_messages FOR SELECT USING (true);
  CREATE POLICY "Anyone can send DMs"
    ON private_messages FOR INSERT WITH CHECK (true);

  -- Enable Realtime
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE private_messages;

  -- Channels table
  CREATE TABLE channels (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text DEFAULT '',
    creator_id text REFERENCES users(id) NOT NULL,
    is_public boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read channels" ON channels FOR SELECT USING (true);
  CREATE POLICY "Anyone can create channels" ON channels FOR INSERT WITH CHECK (true);
  CREATE POLICY "Anyone can update channels" ON channels FOR UPDATE USING (true);
  CREATE POLICY "Anyone can delete channels" ON channels FOR DELETE USING (true);

  -- Channel Members table
  CREATE TABLE channel_members (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    channel_id text REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
    user_id text REFERENCES users(id) NOT NULL,
    role text DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    joined_at timestamptz DEFAULT now(),
    UNIQUE(channel_id, user_id)
  );

  ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read channel_members" ON channel_members FOR SELECT USING (true);
  CREATE POLICY "Anyone can insert channel_members" ON channel_members FOR INSERT WITH CHECK (true);
  CREATE POLICY "Anyone can update channel_members" ON channel_members FOR UPDATE USING (true);
  CREATE POLICY "Anyone can delete channel_members" ON channel_members FOR DELETE USING (true);

  -- Channel Messages table
  CREATE TABLE channel_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    channel_id text REFERENCES channels(id) ON DELETE CASCADE NOT NULL,
    user_id text REFERENCES users(id) NOT NULL,
    username text NOT NULL,
    content text NOT NULL,
    file_data text,
    reply_to_content text,
    reply_to_username text,
    created_at timestamptz DEFAULT now()
  );

  ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Anyone can read channel_messages" ON channel_messages FOR SELECT USING (true);
  CREATE POLICY "Anyone can send channel_messages" ON channel_messages FOR INSERT WITH CHECK (true);
  CREATE POLICY "Anyone can delete channel_messages" ON channel_messages FOR DELETE USING (true);

  ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;

  3. Go to Settings → API and copy your URL + anon key above.
*/

// ===================== Initialize Supabase Client =====================
let sb;
try {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.warn('Supabase not configured yet. Please add your credentials in supabase.js');
}

// ===================== Utility / Helper Functions =====================
function generateUniqueId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function getInitials(name) {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

function getAvatarHtml(userId, displayName) {
  if (!sb || !userId) return `<span>${sanitize(getInitials(displayName))}</span>`;
  const { data } = sb.storage.from('avatars').getPublicUrl(`${userId}/avatar`);
  const url = data.publicUrl;
  return `<span class="avatar-fallback">${sanitize(getInitials(displayName))}</span><img src="${url}" alt="" class="avatar-img" onerror="this.style.display='none'" onload="this.previousElementSibling.style.display='none';this.style.display='block'">`;
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function uploadFile(file) {
  const ext = file.name.split('.').pop();
  const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
  const filePath = `uploads/${fileName}`;

  const { data, error } = await sb.storage
    .from('chat-files')
    .upload(filePath, file);

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  const { data: urlData } = sb.storage
    .from('chat-files')
    .getPublicUrl(filePath);

  return {
    url: urlData.publicUrl,
    name: file.name,
    type: file.type,
    size: file.size
  };
}

// ===================== Exports =====================
window.Convo.SUPABASE_URL = SUPABASE_URL;
window.Convo.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
window.Convo.sb = sb;
window.Convo.generateUniqueId = generateUniqueId;
window.Convo.getInitials = getInitials;
window.Convo.getAvatarHtml = getAvatarHtml;
window.Convo.formatTime = formatTime;
window.Convo.sanitize = sanitize;
window.Convo.hashPassword = hashPassword;
window.Convo.formatFileSize = formatFileSize;
window.Convo.uploadFile = uploadFile;
