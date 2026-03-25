# Convo
A real-time messaging app hosted on GitHub Pages with Supabase backend.

## Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a free project
2. Open the **SQL Editor** and run:

```sql
CREATE TABLE messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read messages"
  ON messages FOR SELECT USING (true);

CREATE POLICY "Anyone can insert messages"
  ON messages FOR INSERT WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
```

### 2. Add Your Credentials
1. Go to **Settings → API** in your Supabase dashboard
2. Copy your **Project URL** and **anon/public key**
3. Open `app.js` and replace the placeholders:
```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

### 3. Deploy to GitHub Pages
1. Push this repo to GitHub
2. Go to **Settings → Pages → Source → Deploy from branch (main)**
3. Your app will be live at `https://yourusername.github.io/Convo/`
