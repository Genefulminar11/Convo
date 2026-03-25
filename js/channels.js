// ===================== Channels & Groups (Telegram-style) =====================
window.Convo = window.Convo || {};

(function () {
  const { sb, sanitize, getInitials, getAvatarHtml, formatTime, uploadFile,
          showConfirmAction, scrollToBottom, clearSearchHighlights, closeSidebar,
          renderFileContent, generateUniqueId, updateBlockedUI } = window.Convo;
  const state = window.Convo.state;
  const dom = window.Convo.dom();

  let channelMsgChannel = null;
  let userChannels = [];

  // ===================== DOM Elements =====================
  const channelsList = document.getElementById('channelsList');
  const channelsLabel = document.getElementById('channelsLabel');
  const btnCreateChannel = document.getElementById('btnCreateChannel');
  const btnBrowseChannels = document.getElementById('btnBrowseChannels');

  const createChannelModal = document.getElementById('createChannelModal');
  const createChannelForm = document.getElementById('createChannelForm');
  const createChannelName = document.getElementById('createChannelName');
  const createChannelDesc = document.getElementById('createChannelDesc');
  const createChannelError = document.getElementById('createChannelError');
  const btnCloseCreateChannel = document.getElementById('btnCloseCreateChannel');

  const browseChannelsModal = document.getElementById('browseChannelsModal');
  const browseChannelsList = document.getElementById('browseChannelsList');
  const browseChannelsSearch = document.getElementById('browseChannelsSearch');
  const btnCloseBrowseChannels = document.getElementById('btnCloseBrowseChannels');

  const channelInfoModal = document.getElementById('channelInfoModal');
  const channelInfoName = document.getElementById('channelInfoName');
  const channelInfoDesc = document.getElementById('channelInfoDesc');
  const channelInfoMembers = document.getElementById('channelInfoMembers');
  const channelInfoMemberCount = document.getElementById('channelInfoMemberCount');
  const btnCloseChannelInfo = document.getElementById('btnCloseChannelInfo');
  const btnLeaveChannel = document.getElementById('btnLeaveChannel');
  const btnDeleteChannel = document.getElementById('btnDeleteChannel');
  const btnChannelInfo = document.getElementById('btnChannelInfo');

  // ===================== Load User's Channels =====================
  async function loadChannels() {
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;

    const { data, error } = await sb
      .from('channel_members')
      .select('channel_id, role, channels(id, name, description, creator_id)')
      .eq('user_id', currentUser.id);

    if (error) {
      console.error('Error loading channels:', error);
      return;
    }

    userChannels = (data || []).map(d => ({
      id: d.channels.id,
      name: d.channels.name,
      description: d.channels.description,
      creator_id: d.channels.creator_id,
      role: d.role
    }));

    renderChannels();
  }

  function renderChannels() {
    const currentView = state.getCurrentView();

    if (!userChannels || userChannels.length === 0) {
      channelsList.innerHTML = '';
      return;
    }

    channelsList.innerHTML = userChannels.map(ch => {
      const isActive = currentView !== 'general' && currentView.channelId === ch.id;
      return `
        <div class="conv-item ${isActive ? 'active' : ''}" data-channel-id="${sanitize(ch.id)}" data-channel-name="${sanitize(ch.name)}">
          <div class="conv-icon channel-icon"><i class="fas fa-bullhorn"></i></div>
          <div class="conv-info">
            <span class="conv-name">${sanitize(ch.name)}</span>
            <span class="conv-preview">${sanitize(ch.description || 'Channel')}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  channelsList.addEventListener('click', (e) => {
    const item = e.target.closest('.conv-item');
    if (item) {
      openChannel(item.dataset.channelId, item.dataset.channelName);
    }
  });

  // ===================== Open Channel View =====================
  async function openChannel(channelId, channelName) {
    state.setCurrentView({ channelId, channelName });

    dom.chatRoomIcon.innerHTML = '<i class="fas fa-bullhorn me-1"></i>';
    dom.chatRoomTitle.textContent = channelName;
    dom.chatRoomDesc.textContent = 'Loading...';
    dom.btnBackChat.classList.remove('hidden');
    document.getElementById('onlineCount').classList.add('hidden');
    document.getElementById('dmStatusDot').classList.add('hidden');

    // Hide DM-only controls
    dom.callButtons.classList.add('hidden');
    dom.headerMenuWrap.classList.add('hidden');
    dom.chatSearchBar.classList.add('hidden');
    clearSearchHighlights();
    dom.headerDropdown.classList.add('hidden');
    document.getElementById('btnClearAllMsgs').classList.add('hidden');

    // Show channel controls
    document.getElementById('channelHeaderActions').classList.remove('hidden');
    dom.btnSearchChat.classList.remove('hidden');

    // Hide blocked banner for channels
    dom.blockedBanner.classList.add('hidden');
    dom.chatInputArea.classList.remove('hidden');

    // Update sidebar active states
    dom.convGeneral.classList.remove('active');
    if (window.Convo.renderContacts) window.Convo.renderContacts();
    renderChannels();

    // Get member count
    const { count } = await sb
      .from('channel_members')
      .select('*', { count: 'exact', head: true })
      .eq('channel_id', channelId);

    dom.chatRoomDesc.textContent = `${count || 0} member${count !== 1 ? 's' : ''}`;

    await loadChannelMessages(channelId);
    closeSidebar();

    dom.messageInput.placeholder = `Message #${channelName}...`;
    dom.messageInput.focus();
  }

  // ===================== Channel Messages =====================
  async function loadChannelMessages(channelId) {
    if (!sb) return;

    dom.chatMessages.innerHTML = '';

    const { data, error } = await sb
      .from('channel_messages')
      .select('*')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) {
      console.error('Error loading channel messages:', error);
      return;
    }

    if (!data || data.length === 0) {
      const emptyMsg = document.createElement('div');
      emptyMsg.className = 'system-message';
      emptyMsg.innerHTML = '<i class="fas fa-bullhorn"></i> Welcome to the channel! Start the conversation.';
      dom.chatMessages.appendChild(emptyMsg);
    }

    (data || []).forEach(msg => {
      dom.chatMessages.appendChild(createChannelMessageEl(msg));
    });

    scrollToBottom();
  }

  function createChannelMessageEl(msg) {
    const currentUser = state.getCurrentUser();
    const isOwn = currentUser && msg.user_id === currentUser.id;
    const isAdmin = currentUser && currentUser.is_admin;
    const ch = userChannels.find(c => c.id === msg.channel_id);
    const isChannelOwner = ch && ch.creator_id === (currentUser && currentUser.id);

    const div = document.createElement('div');
    div.className = `message ${isOwn ? 'own' : ''}`;
    div.dataset.msgId = msg.id;

    const fileHtml = msg.file_data ? renderFileContent(msg.file_data) : '';
    const textHtml = msg.content ? `<div class="message-bubble">${sanitize(msg.content)}</div>` : '';
    const replyHtml = msg.reply_to_content ? `<div class="reply-quote"><span class="reply-quote-name">${sanitize(msg.reply_to_username || 'User')}</span><span class="reply-quote-text">${sanitize(msg.reply_to_content)}</span></div>` : '';
    const deleteHtml = (isAdmin || isChannelOwner) ? `<button class="btn-admin-delete" title="Delete message" data-ch-msg-id="${msg.id}"><i class="fas fa-trash"></i></button>` : '';

    div.innerHTML = `
      <div class="message-avatar">${getAvatarHtml(msg.user_id, msg.username)}</div>
      <div class="message-content">
        ${replyHtml}
        ${textHtml}
        ${fileHtml}
        <div class="message-meta">
          <span class="message-sender">${sanitize(msg.username)}</span>
          <span class="message-time">${formatTime(msg.created_at)}</span>
        </div>
      </div>
      ${deleteHtml}
      <button class="btn-reply" title="Reply" data-msg-id="${msg.id}" data-msg-user="${sanitize(msg.username)}" data-msg-content="${sanitize(msg.content || '')}" data-msg-type="channel">
        <i class="fas fa-reply"></i>
      </button>
    `;
    return div;
  }

  // Delete channel message (owner/admin)
  dom.chatMessages.addEventListener('click', async (e) => {
    const delBtn = e.target.closest('.btn-admin-delete[data-ch-msg-id]');
    if (!delBtn) return;
    const currentView = state.getCurrentView();
    if (!currentView.channelId) return;
    const msgId = delBtn.dataset.chMsgId;
    if (!msgId) return;
    const { error } = await sb.from('channel_messages').delete().eq('id', msgId);
    if (error) console.error('Delete channel message error:', error);
    else delBtn.closest('.message').remove();
  });

  // ===================== Realtime Subscription =====================
  function subscribeToChannelMessages() {
    if (!sb) return;

    channelMsgChannel = sb
      .channel('public:channel_messages')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'channel_messages'
      }, (payload) => {
        const msg = payload.new;
        const currentView = state.getCurrentView();
        if (currentView.channelId && currentView.channelId === msg.channel_id) {
          dom.chatMessages.appendChild(createChannelMessageEl(msg));
          scrollToBottom();
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'channel_messages'
      }, (payload) => {
        const currentView = state.getCurrentView();
        if (currentView.channelId) {
          const el = dom.chatMessages.querySelector(`[data-msg-id="${payload.old.id}"]`);
          if (el) el.remove();
        }
      })
      .subscribe();
  }

  function getChannelMsgChannel() { return channelMsgChannel; }

  // ===================== Create Channel =====================
  btnCreateChannel.addEventListener('click', () => {
    createChannelModal.classList.remove('hidden');
    createChannelName.value = '';
    createChannelDesc.value = '';
    createChannelError.classList.add('hidden');
    createChannelName.focus();
  });

  btnCloseCreateChannel.addEventListener('click', () => {
    createChannelModal.classList.add('hidden');
  });

  createChannelModal.addEventListener('click', (e) => {
    if (e.target === createChannelModal) createChannelModal.classList.add('hidden');
  });

  createChannelForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentUser = state.getCurrentUser();
    if (!sb || !currentUser) return;

    const name = createChannelName.value.trim();
    const desc = createChannelDesc.value.trim();

    if (!name || name.length < 2) {
      createChannelError.textContent = 'Channel name must be at least 2 characters.';
      createChannelError.classList.remove('hidden');
      return;
    }

    // Check duplicate name
    const { data: existing } = await sb
      .from('channels')
      .select('id')
      .ilike('name', name)
      .limit(1);

    if (existing && existing.length > 0) {
      createChannelError.textContent = 'A channel with this name already exists.';
      createChannelError.classList.remove('hidden');
      return;
    }

    const channelId = generateUniqueId();

    const { error: chErr } = await sb
      .from('channels')
      .insert([{
        id: channelId,
        name: name,
        description: desc,
        creator_id: currentUser.id,
        is_public: true
      }]);

    if (chErr) {
      createChannelError.textContent = 'Failed to create channel.';
      createChannelError.classList.remove('hidden');
      console.error('Create channel error:', chErr);
      return;
    }

    // Add creator as owner member
    await sb.from('channel_members').insert([{
      channel_id: channelId,
      user_id: currentUser.id,
      role: 'owner'
    }]);

    createChannelModal.classList.add('hidden');
    await loadChannels();
    openChannel(channelId, name);
  });

  // ===================== Browse Channels =====================
  btnBrowseChannels.addEventListener('click', async () => {
    browseChannelsModal.classList.remove('hidden');
    browseChannelsSearch.value = '';
    await loadBrowseChannels();
  });

  btnCloseBrowseChannels.addEventListener('click', () => {
    browseChannelsModal.classList.add('hidden');
  });

  browseChannelsModal.addEventListener('click', (e) => {
    if (e.target === browseChannelsModal) browseChannelsModal.classList.add('hidden');
  });

  let browseTimeout;
  browseChannelsSearch.addEventListener('input', () => {
    clearTimeout(browseTimeout);
    browseTimeout = setTimeout(() => loadBrowseChannels(browseChannelsSearch.value.trim()), 300);
  });

  async function loadBrowseChannels(query) {
    if (!sb) return;

    let q = sb.from('channels').select('*').eq('is_public', true).order('created_at', { ascending: false }).limit(50);
    if (query && query.length >= 1) {
      q = q.ilike('name', `%${query}%`);
    }

    const { data, error } = await q;

    if (error) {
      browseChannelsList.innerHTML = '<div class="search-empty">Error loading channels</div>';
      return;
    }

    if (!data || data.length === 0) {
      browseChannelsList.innerHTML = '<div class="search-empty"><i class="fas fa-bullhorn me-1"></i> No channels found</div>';
      return;
    }

    // Get member counts
    const channelIds = data.map(ch => ch.id);
    const { data: memberData } = await sb
      .from('channel_members')
      .select('channel_id')
      .in('channel_id', channelIds);

    const memberCounts = {};
    (memberData || []).forEach(m => {
      memberCounts[m.channel_id] = (memberCounts[m.channel_id] || 0) + 1;
    });

    const joinedIds = new Set(userChannels.map(c => c.id));

    browseChannelsList.innerHTML = data.map(ch => {
      const isJoined = joinedIds.has(ch.id);
      const count = memberCounts[ch.id] || 0;
      return `
        <div class="browse-channel-item" data-channel-id="${sanitize(ch.id)}" data-channel-name="${sanitize(ch.name)}">
          <div class="browse-channel-icon"><i class="fas fa-bullhorn"></i></div>
          <div class="browse-channel-info">
            <span class="browse-channel-name">${sanitize(ch.name)}</span>
            <span class="browse-channel-desc">${sanitize(ch.description || 'No description')}</span>
            <span class="browse-channel-meta"><i class="fas fa-users me-1"></i>${count} member${count !== 1 ? 's' : ''}</span>
          </div>
          <button class="btn-channel-join ${isJoined ? 'joined' : ''}" data-channel-id="${sanitize(ch.id)}" data-channel-name="${sanitize(ch.name)}">
            ${isJoined ? '<i class="fas fa-check me-1"></i>Joined' : '<i class="fas fa-sign-in-alt me-1"></i>Join'}
          </button>
        </div>
      `;
    }).join('');
  }

  browseChannelsList.addEventListener('click', async (e) => {
    const joinBtn = e.target.closest('.btn-channel-join');
    if (!joinBtn) return;

    const currentUser = state.getCurrentUser();
    const channelId = joinBtn.dataset.channelId;
    const channelName = joinBtn.dataset.channelName;

    if (joinBtn.classList.contains('joined')) {
      browseChannelsModal.classList.add('hidden');
      openChannel(channelId, channelName);
      return;
    }

    const { error } = await sb.from('channel_members').insert([{
      channel_id: channelId,
      user_id: currentUser.id,
      role: 'member'
    }]);

    if (error) {
      console.error('Join channel error:', error);
      return;
    }

    joinBtn.classList.add('joined');
    joinBtn.innerHTML = '<i class="fas fa-check me-1"></i>Joined';
    await loadChannels();
  });

  // ===================== Channel Info =====================
  btnChannelInfo.addEventListener('click', async () => {
    const currentView = state.getCurrentView();
    if (!currentView.channelId) return;

    channelInfoModal.classList.remove('hidden');

    const { data: ch } = await sb.from('channels').select('*').eq('id', currentView.channelId).single();
    if (!ch) return;

    channelInfoName.textContent = ch.name;
    channelInfoDesc.textContent = ch.description || 'No description';

    const { data: members } = await sb
      .from('channel_members')
      .select('user_id, role, users(username)')
      .eq('channel_id', currentView.channelId)
      .order('role', { ascending: true });

    const memberCount = (members || []).length;
    channelInfoMemberCount.textContent = `${memberCount} member${memberCount !== 1 ? 's' : ''}`;

    const currentUser = state.getCurrentUser();
    const isCreator = ch.creator_id === currentUser.id;

    channelInfoMembers.innerHTML = (members || []).map(m => {
      const roleBadge = m.role === 'owner' ? '<span class="channel-role-badge owner">Owner</span>' :
                        m.role === 'admin' ? '<span class="channel-role-badge admin">Admin</span>' : '';
      const kickBtn = isCreator && m.user_id !== currentUser.id ?
        `<button class="btn-kick-member" data-user-id="${sanitize(m.user_id)}" title="Remove"><i class="fas fa-times"></i></button>` : '';
      return `
        <div class="channel-member-item">
          <div class="channel-member-avatar">${getAvatarHtml(m.user_id, m.users.username)}</div>
          <span class="channel-member-name">${sanitize(m.users.username)}</span>
          ${roleBadge}
          ${kickBtn}
        </div>
      `;
    }).join('');

    btnDeleteChannel.classList.toggle('hidden', !isCreator);
    btnLeaveChannel.classList.toggle('hidden', isCreator);
  });

  btnCloseChannelInfo.addEventListener('click', () => {
    channelInfoModal.classList.add('hidden');
  });

  channelInfoModal.addEventListener('click', (e) => {
    if (e.target === channelInfoModal) channelInfoModal.classList.add('hidden');
  });

  // Kick member
  channelInfoMembers.addEventListener('click', async (e) => {
    const kickBtn = e.target.closest('.btn-kick-member');
    if (!kickBtn) return;
    const userId = kickBtn.dataset.userId;
    const currentView = state.getCurrentView();

    showConfirmAction(
      'Remove Member',
      'Remove this member from the channel?',
      async () => {
        await sb.from('channel_members').delete()
          .eq('channel_id', currentView.channelId)
          .eq('user_id', userId);
        // Refresh channel info
        btnChannelInfo.click();
      }
    );
  });

  // Leave Channel
  btnLeaveChannel.addEventListener('click', () => {
    const currentView = state.getCurrentView();
    showConfirmAction(
      'Leave Channel',
      `Leave <span class="highlight-name">#${sanitize(currentView.channelName)}</span>?`,
      async () => {
        const currentUser = state.getCurrentUser();
        await sb.from('channel_members').delete()
          .eq('channel_id', currentView.channelId)
          .eq('user_id', currentUser.id);

        channelInfoModal.classList.add('hidden');
        userChannels = userChannels.filter(c => c.id !== currentView.channelId);
        renderChannels();
        if (window.Convo.openGeneralChat) window.Convo.openGeneralChat();
      }
    );
  });

  // Delete Channel
  btnDeleteChannel.addEventListener('click', () => {
    const currentView = state.getCurrentView();
    showConfirmAction(
      'Delete Channel',
      `Permanently delete <span class="highlight-name">#${sanitize(currentView.channelName)}</span> and all its messages? This cannot be undone.`,
      async () => {
        await sb.from('channel_messages').delete().eq('channel_id', currentView.channelId);
        await sb.from('channel_members').delete().eq('channel_id', currentView.channelId);
        await sb.from('channels').delete().eq('id', currentView.channelId);

        channelInfoModal.classList.add('hidden');
        userChannels = userChannels.filter(c => c.id !== currentView.channelId);
        renderChannels();
        if (window.Convo.openGeneralChat) window.Convo.openGeneralChat();
      }
    );
  });

  // ===================== Exports =====================
  window.Convo.loadChannels = loadChannels;
  window.Convo.renderChannels = renderChannels;
  window.Convo.openChannel = openChannel;
  window.Convo.subscribeToChannelMessages = subscribeToChannelMessages;
  window.Convo.getChannelMsgChannel = getChannelMsgChannel;
  window.Convo.getUserChannels = () => userChannels;
})();
