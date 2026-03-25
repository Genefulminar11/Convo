// ===================== HTML Partial Loader =====================
// Loads HTML partials into the page before app scripts run.
(async function () {
  const partials = [
    { id: 'partial-sidebar',  src: 'html/sidebar.html' },
    { id: 'partial-chat',     src: 'html/chat.html' },
    { id: 'partial-auth',     src: 'html/auth-modal.html' },
    { id: 'partial-modals',   src: 'html/modals.html' },
    { id: 'partial-channels', src: 'html/channels.html' },
    { id: 'partial-toasts',   src: 'html/toasts.html' }
  ];

  const results = await Promise.all(
    partials.map(p =>
      fetch(p.src)
        .then(r => { if (!r.ok) throw new Error(p.src + ' ' + r.status); return r.text(); })
        .then(html => ({ id: p.id, html }))
    )
  );

  results.forEach(({ id, html }) => {
    const slot = document.getElementById(id);
    if (slot) slot.innerHTML = html;
  });

  // Load app scripts sequentially after partials are ready
  const scripts = [
    'js/supabase.js',
    'js/ui.js',
    'js/auth.js',
    'js/chat.js',
    'js/dm.js',
    'js/contacts.js',
    'js/call.js',
    'js/channels.js',
    'js/main.js'
  ];

  for (const src of scripts) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.body.appendChild(s);
    });
  }
})();
