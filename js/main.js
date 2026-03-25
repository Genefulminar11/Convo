// ===================== App Entry Point & Initialization =====================
window.Convo = window.Convo || {};

(function () {
  const { sb, SUPABASE_URL } = window.Convo;
  const state = window.Convo.state;

  function initChat() {
    window.Convo.loadMessages();
    window.Convo.loadContacts();
    window.Convo.loadBlockedUsers();
    window.Convo.loadChannels();
    window.Convo.subscribeToMessages();
    window.Convo.subscribeToDMs();
    window.Convo.subscribeToPresence();
    window.Convo.subscribeToCallSignals();
    window.Convo.subscribeToChannelMessages();
  }

  function cleanup() {
    const realtimeChannel = window.Convo.getRealtimeChannel ? window.Convo.getRealtimeChannel() : null;
    const presenceChannel = window.Convo.getPresenceChannel ? window.Convo.getPresenceChannel() : null;
    const dmChannel = window.Convo.getDMChannel ? window.Convo.getDMChannel() : null;
    const callSignalChannel = window.Convo.getCallSignalChannel ? window.Convo.getCallSignalChannel() : null;

    const channelMsgChannel = window.Convo.getChannelMsgChannel ? window.Convo.getChannelMsgChannel() : null;

    if (realtimeChannel) sb.removeChannel(realtimeChannel);
    if (presenceChannel) sb.removeChannel(presenceChannel);
    if (dmChannel) sb.removeChannel(dmChannel);
    if (callSignalChannel) sb.removeChannel(callSignalChannel);
    if (channelMsgChannel) sb.removeChannel(channelMsgChannel);

    if (window.Convo.endCall) window.Convo.endCall(false);
  }

  function init() {
    window.Convo.initTheme();

    const currentUser = state.getCurrentUser();
    const dom = window.Convo.dom();

    if (currentUser && currentUser.id && currentUser.username) {
      window.Convo.setUserUI(currentUser);
      window.Convo.hideAuthModal();
      initChat();
    } else {
      window.Convo.showAuthModal();
    }

    if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      const notice = document.createElement('div');
      notice.className = 'system-message';
      notice.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <strong>Setup Required:</strong> Open <code>js/supabase.js</code> and add your Supabase URL & anon key.
      `;
      dom.chatMessages.appendChild(notice);
    }
  }

  // ===================== Exports =====================
  window.Convo.initChat = initChat;
  window.Convo.cleanup = cleanup;

  // Run
  init();
})();
