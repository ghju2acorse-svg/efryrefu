// app.js

(function(){
  "use strict";

  function injectGamePageChat(){
    var side = document.querySelector('.game-page-side');
    if(!side || document.getElementById('chatForm')) return;
    side.insertAdjacentHTML('afterbegin',
      '<div class="chat-card chat-card-game">'
      + '<div class="chat-head"><span>Chat</span><small>Roblox names shown</small></div>'
      + '<div class="chat-messages" id="chatMessages"><div class="chat-empty">No messages yet.</div></div>'
      + '<form class="chat-input-row" id="chatForm">'
      + '<input type="text" id="chatInput" placeholder="Log in to chat" disabled maxlength="200" autocomplete="off">'
      + '<button type="submit" disabled aria-label="Send message" id="chatSendBtn">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 20 18-8L3 4l4 8-4 8Z"/></svg>'
      + '</button></form>'
      + '<p class="chat-gate-note" id="chatGateNote">Log in to join the chat.</p>'
      + '</div>'
    );
  }
  injectGamePageChat();

  var Starfield = (function(){
    var canvas = document.getElementById('starfield');
    var ctx = canvas ? canvas.getContext('2d') : null;
    var stars = [];
    var w = 0, h = 0, dpr = 1;
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var colors = { a: '#A47CFF', b: '#F6F7FC' };
    var raf = null;

    function computedColor(varName){
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }

    function resize(){
      if(!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function buildStars(){
      var count = Math.round((w * h) / 9000);
      count = Math.max(70, Math.min(220, count));
      stars = [];
      for(var i = 0; i < count; i++){
        stars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: Math.random() * 1.4 + 0.4,
          isPurple: Math.random() < 0.38,
          baseAlpha: Math.random() * 0.5 + 0.35,
          twinkleSpeed: Math.random() * 0.015 + 0.004,
          twinklePhase: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.06,
          vy: (Math.random() - 0.5) * 0.06 + 0.02
        });
      }
    }

    function tick(t){
      if(!ctx) return;
      ctx.clearRect(0, 0, w, h);
      for(var i = 0; i < stars.length; i++){
        var s = stars[i];
        if(!reduceMotion){
          s.x += s.vx;
          s.y += s.vy;
          if(s.x < -5) s.x = w + 5;
          if(s.x > w + 5) s.x = -5;
          if(s.y < -5) s.y = h + 5;
          if(s.y > h + 5) s.y = -5;
        }
        var alpha = reduceMotion ? s.baseAlpha : s.baseAlpha + Math.sin(t * s.twinkleSpeed + s.twinklePhase) * 0.25;
        alpha = Math.max(0.08, Math.min(1, alpha));
        ctx.beginPath();
        ctx.fillStyle = s.isPurple ? colors.a : colors.b;
        ctx.globalAlpha = alpha;
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    }

    function start(){
      if(!canvas) return;
      resize();
      buildStars();
      colors.a = computedColor('--star-a') || colors.a;
      colors.b = computedColor('--star-b') || colors.b;
      if(raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }

    window.addEventListener('resize', function(){
      resize();
      buildStars();
    });

    return {
      init: start,
      setTheme: function(){
        colors.a = computedColor('--star-a') || colors.a;
        colors.b = computedColor('--star-b') || colors.b;
      }
    };
  })();
  Starfield.init();

  var Api = {
    call: function(method, url, body){
      var opts = { method: method, credentials: 'same-origin', headers: {} };
      if(body !== undefined){ opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
      return fetch(url, opts).then(function(res){
        return res.json().catch(function(){ return null; }).then(function(data){
          if(!res.ok){
            var err = new Error((data && data.error) || 'Request failed');
            err.status = res.status;
            throw err;
          }
          return data;
        });
      });
    },
    get: function(url){ return this.call('GET', url); },
    post: function(url, body){ return this.call('POST', url, body === undefined ? {} : body); }
  };

  function fmt(n){
    return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function escapeHtml(s){
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }
  var toastHideTimer = null;
  function showToast(message){
    var el = document.getElementById('appToast');
    if(!el){
      el = document.createElement('div');
      el.id = 'appToast';
      el.className = 'app-toast';
      el.innerHTML = '<span class="app-toast-bar"></span><span class="app-toast-text"></span>';
      document.body.appendChild(el);
    }
    el.querySelector('.app-toast-text').textContent = message;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    if(toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(function(){ el.classList.remove('show'); }, 3800);
  }

  var App = { user: null };
  var CHAT_MIN_LEVEL = 3;

  function xpProgress(u){
    var width = 150;
    var levelStart = (u.level - 1) * width;
    var into = Math.max(0, u.xp - levelStart);
    var pct = Math.max(0, Math.min(100, (into / width) * 100));
    return { into: into, width: width, pct: pct };
  }

  function applyWallet(walletPatch){
    if(!walletPatch || !App.user) return;
    App.user.balance = walletPatch.balance;
    if(walletPatch.level !== undefined) App.user.level = walletPatch.level;
    if(walletPatch.xp !== undefined) App.user.xp = walletPatch.xp;
    renderUser();
  }

  function renderUser(){
    var walletAmount = document.getElementById('walletAmount');
    var wdSabAmount = document.getElementById('wdSabAmount');
    var gmBalance = document.getElementById('gmBalance');
    var walletBtnEl = document.getElementById('walletBtn');
    var walletBtnSecondaryEl = document.getElementById('walletBtnSecondary');
    var navAvatar = document.getElementById('navAvatar');
    var navUsername = document.getElementById('navUsername');
    var welcomeAvatar = document.getElementById('welcomeAvatar');
    var welcomeName = document.getElementById('welcomeName');
    var welcomeLevelBadge = document.getElementById('welcomeLevelBadge');
    var xpFill = document.getElementById('xpFill');
    var xpLevel = document.getElementById('xpLevel');
    var xpNums = document.getElementById('xpNums');
    var dropdownAccountLine = document.getElementById('dropdownAccountLine');
    var logoutLinkEl = document.getElementById('logoutLink');

    if(!App.user){
      if(walletAmount) walletAmount.textContent = '0.00';
      if(wdSabAmount) wdSabAmount.textContent = '0.00';
      if(gmBalance) gmBalance.textContent = '0.00';
      if(walletBtnEl){
        walletBtnEl.classList.add('guest');
      }
      if(walletBtnSecondaryEl) walletBtnSecondaryEl.style.display = 'none';
      if(navAvatar) navAvatar.textContent = '?';
      if(navUsername) navUsername.textContent = 'Guest';
      if(welcomeAvatar) welcomeAvatar.textContent = '?';
      if(welcomeName) welcomeName.textContent = 'Guest';
      if(welcomeLevelBadge) welcomeLevelBadge.textContent = '–';
      if(xpFill) xpFill.style.width = '0%';
      if(xpLevel) xpLevel.textContent = '1';
      if(xpNums) xpNums.textContent = '0 / 150';
      if(dropdownAccountLine) dropdownAccountLine.textContent = 'Not logged in';
      if(logoutLinkEl) logoutLinkEl.style.display = 'none';
      if(typeof closeWalletDropdown === 'function') closeWalletDropdown();
      refreshChatGate();
      return;
    }
    var u = App.user;
    var initial = u.username.charAt(0).toUpperCase();
    if(walletAmount) walletAmount.textContent = fmt(u.balance);
    if(wdSabAmount) wdSabAmount.textContent = fmt(u.balance);
    if(gmBalance) gmBalance.textContent = fmt(u.balance);
    if(walletBtnEl){
      walletBtnEl.classList.remove('guest');
    }
    if(walletBtnSecondaryEl) walletBtnSecondaryEl.style.display = '';
    if(navAvatar) navAvatar.textContent = initial;
    if(navUsername) navUsername.textContent = u.username;
    if(welcomeAvatar) welcomeAvatar.textContent = initial;
    if(welcomeName) welcomeName.textContent = u.username;
    if(welcomeLevelBadge) welcomeLevelBadge.textContent = u.level;
    if(xpFill){
      var xp = xpProgress(u);
      xpFill.style.width = xp.pct + '%';
      if(xpLevel) xpLevel.textContent = u.level;
      if(xpNums) xpNums.textContent = xp.into + ' / ' + xp.width;
    }
    if(dropdownAccountLine) dropdownAccountLine.textContent = 'Level ' + u.level + ' · ' + fmt(u.balance) + ' credits';
    if(logoutLinkEl) logoutLinkEl.style.display = '';
    refreshChatGate();
  }

  function refreshMe(){
    return Api.get('/api/me').then(function(data){
      App.user = data.user;
      renderUser();
      return App.user;
    });
  }

  var menuToggle = document.getElementById('menuToggle');
  var navLinks = document.querySelector('.nav-links');
  if(menuToggle){
    menuToggle.addEventListener('click', function(){
      var open = navLinks.style.display === 'flex';
      navLinks.style.display = open ? 'none' : 'flex';
      navLinks.style.cssText += open ? '' : 'position:absolute;top:76px;left:0;right:0;background:var(--bg);flex-direction:column;padding:20px 24px;border-bottom:1px solid var(--outline-soft);gap:18px;';
    });
  }

  if(!document.getElementById('modal-roblox')){
    document.body.insertAdjacentHTML('beforeend',
      '<div class="modal-overlay" id="modal-roblox">'
      + '<div class="modal modal-panel modal-roblox" role="dialog" aria-modal="true" aria-labelledby="robloxTitle">'
      + '<div class="modal-accent modal-accent-teal"></div>'
      + '<div class="modal-head">'
      + '<div class="modal-brand">'
      + '<span class="modal-badge modal-badge-teal"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 12h6M12 9v6"/></svg></span>'
      + '<div><h3 id="robloxTitle">Link your Roblox account</h3><p>Required before you can play any games.</p></div>'
      + '</div>'
      + '<button class="modal-close" data-modal-close><svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>'
      + '</div>'
      + '<form id="robloxStartForm">'
      + '<div class="field"><label for="robloxUser">Roblox username</label>'
      + '<input id="robloxUser" type="text" placeholder="Your Roblox username" required autocomplete="off"></div>'
      + '<p class="modal-error" id="robloxStartError"></p>'
      + '<button type="submit" class="btn btn-primary" id="robloxStartBtn">Continue</button>'
      + '</form>'
      + '<div id="robloxCodeStep" class="roblox-code-step" style="display:none;">'
      + '<ol class="roblox-steps">'
      + '<li>Join the verification experience below.</li>'
      + '<li>Enter your code in the in-game prompt.</li>'
      + '</ol>'
      + '<div class="field"><label>Your code</label>'
      + '<div class="roblox-code-row">'
      + '<code id="robloxCodeDisplay" class="roblox-code"></code>'
      + '<button type="button" class="btn btn-ghost" id="robloxCopyBtn">Copy</button>'
      + '</div></div>'
      + '<a href="#" target="_blank" rel="noopener" class="btn btn-gold roblox-join-btn" id="robloxJoinLink">Join Roblox experience</a>'
      + '<p class="roblox-status" id="robloxStatusText">Waiting for verification…</p>'
      + '</div></div></div>'
    );
  }

  var overlays = {
    auth: document.getElementById('modal-auth'),
    roblox: document.getElementById('modal-roblox')
  };
  var lastFocused = null;
  var currentGameCleanup = null;
  var gameRoundLocked = false;

  function setRoundLocked(locked){
    gameRoundLocked = locked;
    document.body.classList.toggle('round-locked', locked);
  }
  window.addEventListener('beforeunload', function(e){
    if(!gameRoundLocked) return;
    e.preventDefault();
    e.returnValue = '';
  });
  document.addEventListener('click', function(e){
    if(!gameRoundLocked) return;
    var link = e.target.closest && e.target.closest('a[href]');
    if(!link) return;
    e.preventDefault();
    showToast('🔒 Finish your round before leaving this page.');
  }, true);

  function openModal(name){
    var m = overlays[name];
    if(!m) return;
    lastFocused = document.activeElement;
    m.classList.add('open');
    var firstInput = m.querySelector('input:not([disabled])');
    if(firstInput) firstInput.focus();
    document.body.style.overflow = 'hidden';
  }
  function closeModal(m){
    m.classList.remove('open');
    document.body.style.overflow = '';
    if(lastFocused) lastFocused.focus();
  }
  function requireLogin(){
    if(App.user) return true;
    setAuthMode('register');
    openModal('auth');
    return false;
  }
  function requireRobloxLinked(){
    if(!App.user) return requireLogin();
    if(App.user.robloxLinked) return true;
    openModal('roblox');
    showToast('Link your Roblox account to play.');
    return false;
  }

  document.querySelectorAll('[data-modal-open]').forEach(function(btn){
    btn.addEventListener('click', function(){
      openModal(btn.getAttribute('data-modal-open'));
    });
  });
  document.querySelectorAll('[data-modal-close]').forEach(function(btn){
    btn.addEventListener('click', function(){ closeModal(btn.closest('.modal-overlay')); });
  });
  Object.keys(overlays).forEach(function(key){
    var m = overlays[key];
    if(!m) return;
    m.addEventListener('click', function(e){ if(e.target === m) closeModal(m); });
  });
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape'){
      Object.keys(overlays).forEach(function(key){
        if(overlays[key] && overlays[key].classList.contains('open')) closeModal(overlays[key]);
      });
    }
  });

  var profileToggle = document.getElementById('profileToggle');
  var profileDropdown = document.getElementById('profileDropdown');
  if(profileToggle){
    profileToggle.addEventListener('click', function(e){
      e.stopPropagation();
      if(!App.user){ requireLogin(); return; }
      var open = profileToggle.getAttribute('aria-expanded') === 'true';
      profileToggle.setAttribute('aria-expanded', open ? 'false' : 'true');
      profileDropdown.classList.toggle('open', !open);
      if(typeof closeWalletDropdown === 'function') closeWalletDropdown();
    });
    document.addEventListener('click', function(e){
      if(!profileDropdown.contains(e.target) && e.target !== profileToggle){
        profileToggle.setAttribute('aria-expanded', 'false');
        profileDropdown.classList.remove('open');
      }
    });
  }
  var logoutLink = document.getElementById('logoutLink');
  if(logoutLink){
    logoutLink.addEventListener('click', function(e){
      e.preventDefault();
      Api.post('/api/logout').then(function(){
        App.user = null;
        renderUser();
        profileDropdown.classList.remove('open');
      });
    });
  }

  var walletBtn = document.getElementById('walletBtn');
  var walletBtnSecondary = document.getElementById('walletBtnSecondary');
  var walletDropdown = document.getElementById('walletDropdown');
  function closeWalletDropdown(){
    if(walletBtn) walletBtn.setAttribute('aria-expanded', 'false');
    if(walletBtnSecondary) walletBtnSecondary.setAttribute('aria-expanded', 'false');
    if(walletDropdown) walletDropdown.classList.remove('open');
  }
  function toggleWalletDropdown(triggerBtn){
    if(!App.user){ requireLogin(); return; }
    var isOpen = walletDropdown.classList.contains('open');
    closeWalletDropdown();
    if(!isOpen){
      walletDropdown.classList.add('open');
      triggerBtn.setAttribute('aria-expanded', 'true');
    }
    profileToggle.setAttribute('aria-expanded', 'false');
    profileDropdown.classList.remove('open');
  }
  [walletBtn, walletBtnSecondary].forEach(function(btn){
    if(!btn) return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      toggleWalletDropdown(btn);
    });
  });
  document.addEventListener('click', function(e){
    if(!walletDropdown) return;
    if(!walletDropdown.contains(e.target) && e.target !== walletBtn && e.target !== walletBtnSecondary){
      closeWalletDropdown();
    }
  });
  var walletInfoToggle = document.getElementById('walletInfoToggle');
  var walletInfoText = document.getElementById('walletInfoText');
  if(walletInfoToggle){
    walletInfoToggle.addEventListener('click', function(e){
      e.stopPropagation();
      walletInfoText.classList.toggle('open');
    });
  }
  var walletFunDeposit = document.getElementById('walletFunDeposit');
  var walletFunWithdraw = document.getElementById('walletFunWithdraw');
  if(walletFunDeposit) walletFunDeposit.addEventListener('click', function(e){
    e.stopPropagation();
    showToast('Deposits are not available in this demo.');
  });
  if(walletFunWithdraw) walletFunWithdraw.addEventListener('click', function(e){
    e.stopPropagation();
    showToast('Withdrawals are not available in this demo.');
  });

  var rainTimerEl = document.getElementById('rainTimer');
  if(rainTimerEl){
    var remaining = 60 * 60;
    setInterval(function(){
      remaining = remaining > 0 ? remaining - 1 : 60 * 60;
      var m = Math.floor(remaining / 60), s = remaining % 60;
      rainTimerEl.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }, 1000);
  }

  var authMode = 'register';
  var authUserInput = document.getElementById('authUser');
  var authUserStatus = document.getElementById('authUserStatus');

  function setAuthMode(mode){
    authMode = mode;
    document.getElementById('authTitle').textContent = mode === 'register' ? 'Create your account' : 'Welcome back';
    document.getElementById('authSubmitBtn').textContent = mode === 'register' ? 'Create account' : 'Log in';
    document.getElementById('authSwitchText').textContent = mode === 'register' ? 'Already have an account?' : 'New here?';
    document.getElementById('authSwitchLink').textContent = mode === 'register' ? 'Log in' : 'Create one';
    document.getElementById('authError').textContent = '';
    if(authUserStatus){ authUserStatus.textContent = ''; }
  }
  var authSwitchLink = document.getElementById('authSwitchLink');
  if(authSwitchLink){
    authSwitchLink.addEventListener('click', function(e){
      e.preventDefault();
      setAuthMode(authMode === 'register' ? 'login' : 'register');
    });
  }

  var usernameCheckTimer = null;
  var lastCheckedAvailable = null;
  if(authUserInput){
    authUserInput.addEventListener('input', function(){
      lastCheckedAvailable = null;
      if(authMode !== 'register'){ authUserStatus.textContent = ''; return; }
      var value = authUserInput.value.trim();
      if(usernameCheckTimer) clearTimeout(usernameCheckTimer);
      if(!value){ authUserStatus.textContent = ''; return; }
      if(!/^[A-Za-z0-9_]{3,20}$/.test(value)){
        authUserStatus.textContent = '3–20 characters: letters, numbers, underscores.';
        authUserStatus.style.color = 'var(--text-3)';
        return;
      }
      authUserStatus.textContent = 'Checking…';
      authUserStatus.style.color = 'var(--text-3)';
      usernameCheckTimer = setTimeout(function(){
        Api.get('/api/check-username?u=' + encodeURIComponent(value)).then(function(res){
          if(authUserInput.value.trim() !== value) return;
          lastCheckedAvailable = res.available;
          if(res.available){
            authUserStatus.textContent = '✓ Username available';
            authUserStatus.style.color = 'var(--teal)';
          } else {
            authUserStatus.textContent = '✕ Someone already has that username';
            authUserStatus.style.color = 'var(--red)';
          }
        }).catch(function(){ authUserStatus.textContent = ''; });
      }, 350);
    });
  }

  var authForm = document.getElementById('authForm');
  if(authForm){
    authForm.addEventListener('submit', function(e){
      e.preventDefault();
      var username = document.getElementById('authUser').value.trim();
      var password = document.getElementById('authPass').value;
      var errEl = document.getElementById('authError');
      var btn = document.getElementById('authSubmitBtn');
      errEl.textContent = '';
      if(authMode === 'register' && lastCheckedAvailable === false){
        errEl.textContent = 'That username is taken — pick another.';
        return;
      }
      btn.disabled = true;
      var url = authMode === 'register' ? '/api/register' : '/api/login';
      Api.post(url, { username: username, password: password }).then(function(res){
        App.user = res.user;
        renderUser();
        closeModal(overlays.auth);
        authForm.reset();
        authUserStatus.textContent = '';
        lastCheckedAvailable = null;
        loadChat();
        if(res.bonus){
          showToast('+' + fmt(res.bonus) + ' SAB — daily rakeback');
        }

        if(!App.user.robloxLinked && overlays.roblox){
          setTimeout(function(){ openModal('roblox'); }, 350);
        }
      }).catch(function(err){
        errEl.textContent = err.message;
      }).finally(function(){ btn.disabled = false; });
    });
  }

  var robloxStartForm = document.getElementById('robloxStartForm');
  var robloxStartBtn = document.getElementById('robloxStartBtn');
  var robloxStartError = document.getElementById('robloxStartError');
  var robloxCodeStep = document.getElementById('robloxCodeStep');
  var robloxCodeDisplay = document.getElementById('robloxCodeDisplay');
  var robloxJoinLink = document.getElementById('robloxJoinLink');
  var robloxStatusText = document.getElementById('robloxStatusText');
  var robloxCopyBtn = document.getElementById('robloxCopyBtn');
  var robloxPollTimer = null;

  function resetRobloxModal(){
    if(!robloxStartForm) return;
    robloxStartForm.style.display = '';
    robloxCodeStep.style.display = 'none';
    robloxStartError.textContent = '';
    document.getElementById('robloxUser').value = '';
    robloxStatusText.textContent = 'Waiting for verification…';
    if(robloxPollTimer){ clearInterval(robloxPollTimer); robloxPollTimer = null; }
  }

  if(robloxStartForm){
    robloxStartForm.addEventListener('submit', function(e){
      e.preventDefault();
      var username = document.getElementById('robloxUser').value.trim();
      if(!username) return;
      robloxStartBtn.disabled = true;
      robloxStartError.textContent = '';
      Api.post('/api/roblox/link/start', { robloxUsername: username }).then(function(res){

        robloxCodeDisplay.textContent = res.code;
        robloxJoinLink.href = res.joinUrl;
        robloxStartForm.style.display = 'none';
        robloxCodeStep.style.display = 'block';
        startRobloxPolling();
      }).catch(function(err){
        robloxStartError.textContent = err.message;
      }).finally(function(){
        robloxStartBtn.disabled = false;
      });
    });
  }

  if(robloxCopyBtn){
    robloxCopyBtn.addEventListener('click', function(){
      navigator.clipboard.writeText(robloxCodeDisplay.textContent).then(function(){
        showToast('Code copied');
      });
    });
  }

  function startRobloxPolling(){
    if(robloxPollTimer) clearInterval(robloxPollTimer);
    robloxPollTimer = setInterval(function(){
      Api.get('/api/roblox/link/status').then(function(res){
        if(res.status === 'verified'){
          clearInterval(robloxPollTimer);
          robloxPollTimer = null;
          robloxStatusText.textContent = 'Verified!';
          showToast('Roblox account linked — you can play now!');
          refreshMe().then(function(){
            setTimeout(function(){ closeModal(overlays.roblox); resetRobloxModal(); }, 900);
          });
        } else if(res.status === 'expired'){
          clearInterval(robloxPollTimer);
          robloxPollTimer = null;
          robloxStatusText.textContent = 'Code expired — close and try again.';
        }

      }).catch(function(){  });
    }, 2500);
  }

  if(overlays.roblox){
    document.querySelectorAll('[data-modal-close]').forEach(function(btn){
      if(btn.closest('.modal-overlay') === overlays.roblox){
        btn.addEventListener('click', resetRobloxModal);
      }
    });
    overlays.roblox.addEventListener('click', function(e){
      if(e.target === overlays.roblox) resetRobloxModal();
    });
  }

  var chatInput = document.getElementById('chatInput');
  var chatSendBtn = document.getElementById('chatSendBtn');
  var chatForm = document.getElementById('chatForm');
  var chatMessages = document.getElementById('chatMessages');
  var chatGateNote = document.getElementById('chatGateNote');

  function chatDisplayName(m){
    return m.roblox_username || m.username;
  }
  function chatInitial(name){
    return (name || '?').charAt(0).toUpperCase();
  }

  function refreshChatGate(){
    if(!chatInput) return;
    var unlocked = App.user && App.user.level >= CHAT_MIN_LEVEL;
    chatInput.disabled = !unlocked;
    if(chatSendBtn) chatSendBtn.disabled = !unlocked;
    if(!chatGateNote) return;
    if(!App.user){
      chatInput.placeholder = 'Log in to chat';
      chatGateNote.textContent = 'Log in to join the chat.';
    } else if(unlocked){
      chatInput.placeholder = 'Send a message';
      chatGateNote.textContent = App.user.robloxLinked
        ? 'Chatting as ' + (App.user.robloxUsername || App.user.username) + '.'
        : 'Chat unlocked — link Roblox to show your Roblox name.';
    } else {
      chatInput.placeholder = 'Reach Level 3 to chat';
      chatGateNote.textContent = 'Chat unlocks at Level 3 (you\'re Level ' + App.user.level + ').';
    }
  }

  function renderChatMessages(messages){
    if(!chatMessages) return;
    if(!messages.length){
      chatMessages.innerHTML = '<div class="chat-empty">No messages yet — say hi.</div>';
      return;
    }
    var wasAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 30;
    chatMessages.innerHTML = messages.map(function(m){
      var name = chatDisplayName(m);
      return '<div class="chat-msg">'
        + '<div class="chat-msg-head">'
        + '<span class="chat-avatar">' + escapeHtml(chatInitial(name)) + '</span>'
        + '<span class="chat-name">' + escapeHtml(name) + '</span>'
        + (m.roblox_username ? '<span class="chat-rbx">Roblox</span>' : '')
        + '</div>'
        + '<p class="chat-text">' + escapeHtml(m.message) + '</p>'
        + '</div>';
    }).join('');
    if(wasAtBottom) chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function loadChat(){
    if(!App.user) return;
    Api.get('/api/chat').then(function(data){ renderChatMessages(data.messages); }).catch(function(){});
  }

  if(chatForm){
    chatForm.addEventListener('submit', function(e){
      e.preventDefault();
      if(!App.user || App.user.level < CHAT_MIN_LEVEL) return;
      var message = chatInput.value.trim();
      if(!message) return;
      chatInput.value = '';
      Api.post('/api/chat', { message: message }).then(loadChat).catch(function(err){
        if(chatGateNote) chatGateNote.textContent = err.message;
      });
    });
  }

  var BET_MIN = {
    mines: 0.01,
    upgrader: 0.05,
    coinflip: 0.05,
    roulette: 0.05,
    crash: 0.10,
    casebattles: 0.10,
    blackjack: 0.10
  };

  function roundBet(n){
    return Math.round(n * 100) / 100;
  }

  function betControlsHTML(defaultBet, minBet){
    minBet = minBet || 0.01;
    return '<div class="bet-row">'
      + '<label class="bet-label" for="betInput">Bet (min ' + minBet.toFixed(2) + ')</label>'
      + '<input type="number" id="betInput" min="' + minBet + '" step="0.01" value="' + roundBet(defaultBet).toFixed(2) + '">'
      + '<div class="bet-quick">'
      + '<button type="button" data-bet-op="half">½</button>'
      + '<button type="button" data-bet-op="double">2×</button>'
      + '<button type="button" data-bet-op="max">Max</button>'
      + '</div></div>';
  }
  function wireBetControls(minBet){
    minBet = minBet || 0.01;
    var betInput = document.getElementById('betInput');
    document.querySelectorAll('[data-bet-op]').forEach(function(btn){
      btn.addEventListener('click', function(){
        var v = parseFloat(betInput.value) || 0;
        var op = btn.getAttribute('data-bet-op');
        var bal = App.user ? App.user.balance : 0;
        if(op === 'half') v = Math.max(minBet, roundBet(v / 2));
        if(op === 'double') v = Math.min(roundBet(bal), Math.max(minBet, roundBet(v * 2)));
        if(op === 'max') v = Math.max(minBet, roundBet(bal));
        betInput.value = v.toFixed(2);
      });
    });
    return betInput;
  }
  function currentBet(betInput, minBet){
    minBet = minBet || 0.01;
    return Math.max(minBet, roundBet(parseFloat(betInput.value) || 0));
  }
  function showMsg(el, text, cls){
    el.className = 'game-msg ' + (cls || 'info');
    el.textContent = text;
  }
  function syncGmBalance(){
    var gmBalance = document.getElementById('gmBalance');
    if(gmBalance && App.user) gmBalance.textContent = fmt(App.user.balance);
  }

  function loadRecentActivity(gameKey){
    var list = document.getElementById('activityList');
    if(!list) return;
    function render(){
      Api.get('/api/recent-rounds?game=' + encodeURIComponent(gameKey) + '&limit=12').then(function(data){
        if(!data.rounds || !data.rounds.length){
          list.innerHTML = '<div class="activity-empty">No rounds played yet — be the first.</div>';
          return;
        }
        list.innerHTML = data.rounds.map(function(r){
          var net = r.net;
          var cls = net >= 0 ? 'win' : 'lose';
          var sign = net >= 0 ? '+' : '';
          return '<div class="activity-row">'
            + '<div class="activity-left">'
            + '<span class="activity-who">' + escapeHtml(r.username) + '</span>'
            + '<span class="activity-detail">bet ' + fmt(r.bet) + '</span>'
            + '</div>'
            + '<span class="activity-amt ' + cls + '">' + sign + fmt(net) + '</span>'
            + '</div>';
        }).join('');
      }).catch(function(){});
    }
    render();
    setInterval(render, 8000);
  }

  var LIVE_GAME_META = {
    coinflip: {
      label: 'Coinflip',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB800" stroke-width="2"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M9 10h6M9 14h6"/></svg>'
    },
    mines: {
      label: 'Mines',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#FF2E4D" stroke-width="2"><circle cx="12" cy="12" r="7"/><path d="M12 8v8M8 12h8"/></svg>'
    },
    crash: {
      label: 'Crash',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#FF2E4D" stroke-width="2"><path d="m3 17 6-6 4 4 8-8"/><path d="M15 5h6v6"/></svg>'
    },
    casebattles: {
      label: 'Battles',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#22D3B6" stroke-width="2"><path d="M4 4h16v6H4zM4 14h7v6H4zM13 14h7v6h-7z"/></svg>'
    },
    upgrader: {
      label: 'Upgrader',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#FFB800" stroke-width="2"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg>'
    },
    blackjack: {
      label: 'Blackjack',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#22D3B6" stroke-width="2"><rect x="4" y="6" width="12" height="14" rx="2"/><rect x="8" y="4" width="12" height="14" rx="2"/></svg>'
    },
    roulette: {
      label: 'Roulette',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="#22D3B6" stroke-width="2"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5"/></svg>'
    }
  };
  var LIVE_COIN_SVG = '<svg class="live-coin" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9.5c0-1.4 1.3-2.5 3-2.5s3 .9 3 2.2c0 2.8-6 1.3-6 4 0 1.4 1.3 2.3 3 2.3s3-1 3-2.3"/></svg>';

  function timeAgo(dateStr){
    var then = new Date(String(dateStr).replace(' ', 'T') + 'Z').getTime();
    if(!then || isNaN(then)) return 'just now';
    var sec = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if(sec < 8) return 'just now';
    if(sec < 60) return sec + (sec === 1 ? ' second' : ' seconds');
    var min = Math.floor(sec / 60);
    if(min < 60) return min + (min === 1 ? ' minute' : ' minutes');
    var hr = Math.floor(min / 60);
    return hr + (hr === 1 ? ' hour' : ' hours');
  }

  function liveMultiplier(round){
    if(round.payout <= 0) return '-';
    var detail = round.detail || {};
    if(detail.multiplier && detail.multiplier > 0) return detail.multiplier.toFixed(2) + 'x';
    if(detail.cashedOutAt && detail.cashedOutAt > 0) return detail.cashedOutAt.toFixed(2) + 'x';
    if(round.bet > 0 && round.payout > 0) return (round.payout / round.bet).toFixed(2) + 'x';
    return '-';
  }

  function loadLiveGames(){
    var list = document.getElementById('liveGamesList');
    if(!list) return;
    function render(){
      Api.get('/api/recent-rounds?limit=20').then(function(data){
        if(!data.rounds || !data.rounds.length){
          list.innerHTML = '<div class="live-games-empty">No live rounds yet — play a game to appear here.</div>';
          return;
        }
        list.innerHTML = data.rounds.map(function(r){
          var meta = LIVE_GAME_META[r.game] || { label: r.game, icon: '' };
          var initial = (r.username || '?').charAt(0).toUpperCase();
          var mult = liveMultiplier(r);
          var profit = r.payout > 0 ? fmt(r.payout) : '0.00';
          return '<div class="live-games-row">'
            + '<span class="live-col live-col-date">' + timeAgo(r.created_at) + '</span>'
            + '<span class="live-col live-col-user"><span class="live-avatar">' + escapeHtml(initial) + '</span><span class="live-username">' + escapeHtml(r.username) + '</span></span>'
            + '<span class="live-col live-col-game"><span class="live-game-icon">' + meta.icon + '</span><span>' + escapeHtml(meta.label) + '</span></span>'
            + '<span class="live-col live-col-bet">' + LIVE_COIN_SVG + fmt(r.bet) + '</span>'
            + '<span class="live-col live-col-mult' + (mult === '-' ? ' is-loss' : '') + '">' + mult + '</span>'
            + '<span class="live-col live-col-profit' + (r.payout <= 0 ? ' is-loss' : '') + '">' + LIVE_COIN_SVG + profit + '</span>'
            + '</div>';
        }).join('');
      }).catch(function(){
        list.innerHTML = '<div class="live-games-empty">Could not load live rounds.</div>';
      });
    }
    render();
    setInterval(render, 6000);
  }

  document.querySelectorAll('a.game-card[href]').forEach(function(card){
    card.addEventListener('click', function(e){
      if(!App.user) return;
      if(!App.user.robloxLinked){
        e.preventDefault();
        requireRobloxLinked();
      }
    });
  });

  var GAME_META = {
    crash:       { title: 'Crash',        sub: 'Cash out before it crashes.' },
    coinflip:    { title: 'Coinflip',     sub: 'Pick a side. 2× payout.' },
    mines:       { title: 'Mines',        sub: 'Reveal gems, avoid mines, cash out anytime.' },
    casebattles: { title: 'Case Battles', sub: 'Open a case, see what you land.' },
    upgrader:    { title: 'Upgrader',     sub: 'Risk it for a bigger multiplier.' },
    blackjack:   { title: 'Blackjack',    sub: 'Beat the dealer to 21.' },
    roulette:    { title: 'Roulette',     sub: 'Red, black, or green.' }
  };
  var Games = {};

  Games.coinflip = {
    mount: function(stage){
      var choice = null;
      var rotation = 0;
      var youInitial = (App.user && App.user.username ? App.user.username.charAt(0).toUpperCase() : '?');
      stage.innerHTML =
        '<div class="coin-vs-row">'
        + '<div class="coin-vs-side"><div class="coin-vs-avatar you">' + youInitial + '</div>'
        + '<div class="coin-vs-name">' + (App.user ? escapeHtml(App.user.username) : 'You') + '</div>'
        + '<div class="coin-vs-chance">49% to win</div></div>'
        + '<div class="coin-vs-side"><div class="coin-vs-avatar house"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></div>'
        + '<div class="coin-vs-name">House</div>'
        + '<div class="coin-vs-chance">51% edge</div></div>'
        + '</div>'
        + '<div class="coin-pick">'
        + '<button type="button" data-side="heads">HEADS</button>'
        + '<button type="button" data-side="tails">TAILS</button>'
        + '</div>'
        + '<div class="coin-stage"><div class="coin-toss-wrap" id="cfTossWrap"><div class="coin-3d" id="cfCoin">'
        + '<div class="coin-face coin-face-heads">H</div>'
        + '<div class="coin-face coin-face-tails">T</div>'
        + '</div></div></div>'
        + betControlsHTML(BET_MIN.coinflip, BET_MIN.coinflip)
        + '<div class="game-msg info" id="cfMsg">Pick a side and place your bet.</div>'
        + '<div class="game-actions"><button type="button" class="btn btn-primary" id="cfPlay">Flip</button></div>';

      var betInput = wireBetControls(BET_MIN.coinflip);
      var msg = document.getElementById('cfMsg');
      var tossWrap = document.getElementById('cfTossWrap');
      var coin = document.getElementById('cfCoin');
      var playBtn = document.getElementById('cfPlay');

      stage.querySelectorAll('[data-side]').forEach(function(btn){
        btn.addEventListener('click', function(){
          stage.querySelectorAll('[data-side]').forEach(function(b){ b.classList.remove('selected'); });
          btn.classList.add('selected');
          choice = btn.getAttribute('data-side');
        });
      });

      playBtn.addEventListener('click', function(){
        if(!choice) return showMsg(msg, 'Pick heads or tails first.', 'info');
        var bet = currentBet(betInput, BET_MIN.coinflip);
        playBtn.disabled = true;
        setRoundLocked(true);
        tossWrap.classList.remove('tossing');
        void tossWrap.offsetWidth;
        tossWrap.classList.add('tossing');
        showMsg(msg, 'Flipping…', 'info');

        Api.post('/api/games/coinflip', { bet: bet, choice: choice }).then(function(res){
          var desiredMod = res.result === 'heads' ? 0 : 180;
          var currentMod = ((rotation % 360) + 360) % 360;
          var delta = ((desiredMod - currentMod) % 360 + 360) % 360;
          rotation = rotation + delta + 5 * 360;
          coin.style.transform = 'rotateY(' + rotation + 'deg)';

          setTimeout(function(){
            applyWallet(res.wallet);
            syncGmBalance();
            showMsg(msg, res.won ? ('You won +' + fmt(res.payout - bet)) : ('You lost -' + fmt(bet)), res.won ? 'win' : 'lose');
            playBtn.disabled = false;
            setRoundLocked(false);
          }, 1350);
        }).catch(function(err){
          setRoundLocked(false);
          showMsg(msg, err.message, 'lose');
          playBtn.disabled = false;
        });
      });
    }
  };

  var ROULETTE_RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  function rouletteSegColor(n){
    if(n === 0) return '#22D3B6';
    return ROULETTE_RED_NUMBERS.indexOf(n) > -1 ? '#E23A54' : '#2E3038';
  }
  function rouletteWheelGradient(){
    var slice = 100 / 37;
    var stops = [];
    for(var i = 0; i < 37; i++){
      stops.push(rouletteSegColor(i) + ' ' + (i * slice).toFixed(4) + '% ' + ((i + 1) * slice).toFixed(4) + '%');
    }
    return 'conic-gradient(from 0deg, ' + stops.join(', ') + ')';
  }

  Games.roulette = {
    mount: function(stage){
      var choice = null;
      var rotation = 0;
      var payLabels = { red: '2×', black: '2×', green: '14×' };
      stage.innerHTML =
        '<div class="roulette-shell">'
        + '<div class="roulette-head">'
        + '<div class="roulette-stat"><span class="roulette-stat-label">Selection</span><span class="roulette-stat-val" id="rlPickVal">—</span></div>'
        + '<div class="roulette-stat roulette-stat-gold"><span class="roulette-stat-label">Payout</span><span class="roulette-stat-val" id="rlPayVal">—</span></div>'
        + '</div>'
        + '<div class="roulette-picks">'
        + '<button type="button" data-color="red"><span class="roulette-pick-dot"></span>RED · 2×</button>'
        + '<button type="button" data-color="black"><span class="roulette-pick-dot"></span>BLACK · 2×</button>'
        + '<button type="button" data-color="green"><span class="roulette-pick-dot"></span>GREEN · 14×</button>'
        + '</div>'
        + '<div class="roulette-stage-wrap">'
        + '<div class="wheel-stage">'
        + '<div class="wheel-ring"></div>'
        + '<div class="wheel-pointer"></div>'
        + '<div class="wheel-disc" id="rlDisc" style="background:' + rouletteWheelGradient() + ';"></div>'
        + '<div class="wheel-hub" id="rlHub">?</div>'
        + '</div></div>'
        + '</div>'
        + betControlsHTML(BET_MIN.roulette, BET_MIN.roulette)
        + '<div class="game-msg info" id="rlMsg">Pick a color and place your bet.</div>'
        + '<div class="game-actions"><button type="button" class="btn btn-primary" id="rlPlay">Spin</button></div>';

      var betInput = wireBetControls(BET_MIN.roulette);
      var msg = document.getElementById('rlMsg');
      var disc = document.getElementById('rlDisc');
      var hub = document.getElementById('rlHub');
      var playBtn = document.getElementById('rlPlay');
      var pickValEl = document.getElementById('rlPickVal');
      var payValEl = document.getElementById('rlPayVal');

      function syncPickUI(){
        if(!choice){
          pickValEl.textContent = '—';
          payValEl.textContent = '—';
          return;
        }
        pickValEl.textContent = choice.charAt(0).toUpperCase() + choice.slice(1);
        payValEl.textContent = payLabels[choice];
      }

      stage.querySelectorAll('[data-color]').forEach(function(btn){
        btn.addEventListener('click', function(){
          if(playBtn.disabled) return;
          stage.querySelectorAll('[data-color]').forEach(function(b){ b.classList.remove('selected'); });
          btn.classList.add('selected');
          choice = btn.getAttribute('data-color');
          syncPickUI();
        });
      });

      playBtn.addEventListener('click', function(){
        if(!choice) return showMsg(msg, 'Pick a color first.', 'info');
        var bet = currentBet(betInput, BET_MIN.roulette);
        playBtn.disabled = true;
        setRoundLocked(true);
        hub.className = 'wheel-hub';
        hub.textContent = '';
        showMsg(msg, 'Spinning…', 'info');

        Api.post('/api/games/roulette', { bet: bet, choice: choice }).then(function(res){
          var slice = 360 / 37;
          var segCenterDeg = (res.landed + 0.5) * slice;
          var targetMod = ((-segCenterDeg % 360) + 360) % 360;
          var currentMod = ((rotation % 360) + 360) % 360;
          var delta = ((targetMod - currentMod) % 360 + 360) % 360;
          rotation = rotation + delta + 6 * 360;
          disc.style.transform = 'rotate(' + rotation + 'deg)';

          setTimeout(function(){
            hub.textContent = res.landed;
            hub.className = 'wheel-hub ' + (res.won ? 'win' : 'lose');
            applyWallet(res.wallet);
            syncGmBalance();
            showMsg(msg, res.won ? ('You won +' + fmt(res.payout - bet)) : ('You lost -' + fmt(bet)), res.won ? 'win' : 'lose');
            playBtn.disabled = false;
            setRoundLocked(false);
          }, 3650);
        }).catch(function(err){
          setRoundLocked(false);
          showMsg(msg, err.message, 'lose');
          playBtn.disabled = false;
        });
      });
    }
  };

  Games.upgrader = {
    mount: function(stage){
      var MIN_CHANCE = 0.05, MAX_CHANCE = 0.95, HOUSE_EDGE = 0.04;
      var chance = 0.50;
      var needleRotation = 0;
      var dragging = false;
      var pillPresets = [0.25, 0.50, 0.75, 0.90];

      stage.innerHTML =
        '<div class="upgrader-shell">'
        + '<div class="upgrader-head">'
        + '<div class="upgrader-stat"><span class="upgrader-stat-label">Win chance</span><span class="upgrader-stat-val" id="upgChanceVal">50.0%</span></div>'
        + '<div class="upgrader-stat upgrader-stat-gold"><span class="upgrader-stat-label">Multiplier</span><span class="upgrader-stat-val" id="upgMultVal">1.92×</span></div>'
        + '</div>'
        + '<div class="upgrader-pills" id="upgPills">'
        + pillPresets.map(function(p){
          return '<button type="button" class="upgrader-pill' + (p === 0.50 ? ' active' : '') + '" data-chance="' + p + '">' + Math.round(p * 100) + '%</button>';
        }).join('')
        + '</div>'
        + '<div class="upg-stage-wrap"><div class="upg-stage" id="upgStage">'
        + '<div class="upg-ring" id="upgRing"></div>'
        + '<div class="upg-needle" id="upgNeedle"><div class="upg-needle-tip"></div></div>'
        + '<div class="upg-ring-hole"></div>'
        + '<div class="upg-readout"><div class="upg-chance-val" id="upgChanceDisplay">50.0%</div><div class="upg-mult-val" id="upgMultDisplay">1.92×</div></div>'
        + '<div class="upg-handle" id="upgHandle"></div>'
        + '</div></div>'
        + '<p class="upg-hint">Drag the gold handle or pick a preset chance.</p>'
        + '</div>'
        + betControlsHTML(BET_MIN.upgrader, BET_MIN.upgrader)
        + '<div class="game-msg info" id="upMsg">Set your chance and bet, then spin.</div>'
        + '<div class="game-actions"><button type="button" class="btn btn-primary" id="upPlay">Upgrade</button></div>';

      var betInput = wireBetControls(BET_MIN.upgrader);
      var msg = document.getElementById('upMsg');
      var stageEl = document.getElementById('upgStage');
      var ring = document.getElementById('upgRing');
      var needle = document.getElementById('upgNeedle');
      var handle = document.getElementById('upgHandle');
      var chanceValEl = document.getElementById('upgChanceVal');
      var multValEl = document.getElementById('upgMultVal');
      var chanceDisplayEl = document.getElementById('upgChanceDisplay');
      var multDisplayEl = document.getElementById('upgMultDisplay');
      var pillsWrap = document.getElementById('upgPills');
      var playBtn = document.getElementById('upPlay');

      var CENTER = 140, RADIUS = 122;

      function multiplierFor(c){ return (1 - HOUSE_EDGE) / c; }

      function setChance(c){
        chance = Math.max(MIN_CHANCE, Math.min(MAX_CHANCE, c));
        render();
      }

      function render(){
        var deg = chance * 360;
        ring.style.background = 'conic-gradient(from -90deg, #22D3B6 0deg, #22D3B6 ' + deg + 'deg, rgba(226,58,84,0.85) ' + deg + 'deg, rgba(226,58,84,0.85) 360deg)';
        var angleRad = (deg - 90) * Math.PI / 180;
        handle.style.left = (CENTER + RADIUS * Math.cos(angleRad)) + 'px';
        handle.style.top = (CENTER + RADIUS * Math.sin(angleRad)) + 'px';
        var chanceText = (chance * 100).toFixed(1) + '%';
        var multText = multiplierFor(chance).toFixed(2) + '×';
        chanceValEl.textContent = chanceText;
        multValEl.textContent = multText;
        chanceDisplayEl.textContent = chanceText;
        multDisplayEl.textContent = multText;
        pillsWrap.querySelectorAll('.upgrader-pill').forEach(function(pill){
          var preset = parseFloat(pill.getAttribute('data-chance'));
          pill.classList.toggle('active', Math.abs(preset - chance) < 0.005);
        });
      }
      render();

      pillsWrap.querySelectorAll('.upgrader-pill').forEach(function(pill){
        pill.addEventListener('click', function(){
          if(playBtn.disabled) return;
          setChance(parseFloat(pill.getAttribute('data-chance')));
        });
      });

      function pointerPos(e){
        if(e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        return { x: e.clientX, y: e.clientY };
      }
      function angleFromClient(x, y){
        var rect = stageEl.getBoundingClientRect();
        var dx = x - (rect.left + rect.width / 2);
        var dy = y - (rect.top + rect.height / 2);
        return (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
      }
      function onDragMove(e){
        if(!dragging) return;
        e.preventDefault();
        var p = pointerPos(e);
        setChance(angleFromClient(p.x, p.y) / 360);
      }
      function onDragEnd(){
        dragging = false;
        stageEl.classList.remove('dragging');
        document.removeEventListener('pointermove', onDragMove);
        document.removeEventListener('pointerup', onDragEnd);
      }
      function onDragStart(e){
        if(playBtn.disabled) return;
        dragging = true;
        stageEl.classList.add('dragging');
        onDragMove(e);
        document.addEventListener('pointermove', onDragMove);
        document.addEventListener('pointerup', onDragEnd);
      }
      stageEl.addEventListener('pointerdown', onDragStart);

      playBtn.addEventListener('click', function(){
        var bet = currentBet(betInput, BET_MIN.upgrader);
        playBtn.disabled = true;
        pillsWrap.querySelectorAll('.upgrader-pill').forEach(function(p){ p.disabled = true; });
        setRoundLocked(true);
        showMsg(msg, 'Spinning…', 'info');
        Api.post('/api/games/upgrader', { bet: bet, chance: chance }).then(function(res){
          var currentMod = ((needleRotation % 360) + 360) % 360;
          var delta = ((res.landingAngle - currentMod) % 360 + 360) % 360;
          needleRotation = needleRotation + delta + 5 * 360;
          needle.style.transform = 'rotate(' + needleRotation + 'deg)';
          setTimeout(function(){
            applyWallet(res.wallet);
            syncGmBalance();
            showMsg(msg, res.won ? ('Upgraded! +' + fmt(res.payout - bet)) : ('Failed — lost ' + fmt(bet)), res.won ? 'win' : 'lose');
            playBtn.disabled = false;
            pillsWrap.querySelectorAll('.upgrader-pill').forEach(function(p){ p.disabled = false; });
            setRoundLocked(false);
          }, 3300);
        }).catch(function(err){
          setRoundLocked(false);
          showMsg(msg, err.message, 'lose');
          playBtn.disabled = false;
          pillsWrap.querySelectorAll('.upgrader-pill').forEach(function(p){ p.disabled = false; });
        });
      });
    }
  };

  Games.casebattles = {
    mount: function(stage){
      var table = [0.10, 0.25, 0.50, 1.00, 2.00, 5.00, 10.00];
      var rarityFor = function(v){
        if(v >= 5) return 'r-legendary';
        if(v >= 2) return 'r-rare';
        if(v >= 0.5) return 'r-uncommon';
        return 'r-common';
      };
      function itemHtml(v){
        return '<div class="case-item ' + rarityFor(v) + '" data-val="' + v + '"><span class="rarity-dot"></span>' + v + '×</div>';
      }
      var itemsHtml = table.map(itemHtml).join('');
      var REPEATS = 8;
      var reelHtml = '';
      for(var r = 0; r < REPEATS; r++) reelHtml += itemsHtml;

      stage.innerHTML =
        '<div class="case-reel-wrap"><div class="case-pointer-cap"></div><div class="case-reel" id="cbReel">' + reelHtml + '</div></div>'
        + betControlsHTML(BET_MIN.casebattles, BET_MIN.casebattles)
        + '<div class="game-msg info" id="cbMsg">Set your case price and open.</div>'
        + '<div class="game-actions"><button type="button" class="btn btn-primary" id="cbPlay">Open Case</button></div>';

      var betInput = wireBetControls(BET_MIN.casebattles);
      var msg = document.getElementById('cbMsg');
      var wrap = stage.querySelector('.case-reel-wrap');
      var reel = document.getElementById('cbReel');

      var playBtn = document.getElementById('cbPlay');

      playBtn.addEventListener('click', function(){
        var bet = currentBet(betInput, BET_MIN.casebattles);
        playBtn.disabled = true;
        setRoundLocked(true);
        showMsg(msg, 'Opening…', 'info');
        reel.querySelectorAll('.case-item.landed').forEach(function(el){ el.classList.remove('landed'); });

        Api.post('/api/games/casebattles', { bet: bet }).then(function(res){
          var items = reel.querySelectorAll('.case-item');

          var candidateIdx = [];
          items.forEach(function(el, i){
            if(i >= table.length * 4 && i < table.length * 7 && parseFloat(el.dataset.val) === res.multiplier){
              candidateIdx.push(i);
            }
          });
          var targetIndex = candidateIdx.length
            ? candidateIdx[Math.floor(Math.random() * candidateIdx.length)]
            : table.length * 5 + table.indexOf(res.multiplier);
          var targetItem = items[targetIndex];

          var wrapWidth = wrap.offsetWidth;
          var itemCenter = targetItem.offsetLeft + targetItem.offsetWidth / 2;
          var translateX = (wrapWidth / 2) - itemCenter;

          reel.style.transition = 'none';
          reel.style.transform = 'translateX(0px)';
          void reel.offsetWidth;
          reel.style.transition = 'transform 5.5s cubic-bezier(.09,.68,.14,1)';
          reel.style.transform = 'translateX(' + translateX + 'px)';

          setTimeout(function(){
            targetItem.classList.add('landed');
            applyWallet(res.wallet);
            syncGmBalance();
            var net = res.payout - bet;
            showMsg(msg, 'Landed ' + res.multiplier + '× — ' + (net >= 0 ? '+' : '') + fmt(net), net >= 0 ? 'win' : 'lose');
            playBtn.disabled = false;
            setRoundLocked(false);
          }, 5600);
        }).catch(function(err){
          setRoundLocked(false);
          showMsg(msg, err.message, 'lose');
          playBtn.disabled = false;
        });
      });
    }
  };

  Games.mines = {
    mount: function(stage){
      var mineOptions = [1, 3, 5, 10, 15, 20];
      stage.innerHTML =
        '<div class="mines-shell">'
        + '<div class="mines-head">'
        + '<div class="mines-stat"><span class="mines-stat-label">Multiplier</span><span class="mines-stat-val" id="mnMult">1.00×</span></div>'
        + '<div class="mines-stat mines-stat-gold"><span class="mines-stat-label">Cash out</span><span class="mines-stat-val" id="mnPotential">0.00</span></div>'
        + '</div>'
        + '<div class="mines-progress"><div class="mines-progress-fill" id="mnProgress"></div></div>'
        + '<div class="mines-grid" id="mnGrid"></div>'
        + '</div>'
        + betControlsHTML(BET_MIN.mines, BET_MIN.mines)
        + '<div class="mines-pills" id="mnPills">'
        + mineOptions.map(function(n){
          return '<button type="button" class="mines-pill' + (n === 3 ? ' active' : '') + '" data-mines="' + n + '">' + n + ' mines</button>';
        }).join('')
        + '</div>'
        + '<div class="game-msg info" id="mnMsg">Pick a bet and mine count, then start.</div>'
        + '<div class="game-actions"><button type="button" class="btn btn-primary" id="mnStart">Start Round</button><button type="button" class="btn btn-gold" id="mnCashout" style="display:none;">Cash Out</button></div>';

      var betInput = wireBetControls(BET_MIN.mines);
      var pillsWrap = document.getElementById('mnPills');
      var msg = document.getElementById('mnMsg');
      var gridEl = document.getElementById('mnGrid');
      var multEl = document.getElementById('mnMult');
      var potEl = document.getElementById('mnPotential');
      var progressEl = document.getElementById('mnProgress');
      var startBtn = document.getElementById('mnStart');
      var cashoutBtn = document.getElementById('mnCashout');
      var active = false;
      var currentBetAmt = 0;
      var mineCount = 3;
      var revealedCount = 0;

      pillsWrap.querySelectorAll('.mines-pill').forEach(function(pill){
        pill.addEventListener('click', function(){
          if(active) return;
          pillsWrap.querySelectorAll('.mines-pill').forEach(function(p){ p.classList.remove('active'); });
          pill.classList.add('active');
          mineCount = parseInt(pill.getAttribute('data-mines'), 10);
        });
      });

      function setMinePillsEnabled(enabled){
        pillsWrap.querySelectorAll('.mines-pill').forEach(function(p){ p.disabled = !enabled; });
      }

      function updateProgress(count, totalSafe){
        var pct = totalSafe > 0 ? Math.min(100, (count / totalSafe) * 100) : 0;
        progressEl.style.width = pct + '%';
      }

      function buildGrid(enabled){
        gridEl.innerHTML = '';
        revealedCount = 0;
        updateProgress(0, 25 - mineCount);
        for(var i = 0; i < 25; i++){
          var tile = document.createElement('button');
          tile.type = 'button';
          tile.className = 'mines-tile';
          tile.dataset.index = i;
          tile.disabled = !enabled;
          tile.innerHTML = '<span class="mines-tile-inner">?</span>';
          tile.addEventListener('click', onTileClick);
          gridEl.appendChild(tile);
        }
      }
      buildGrid(false);

      function onTileClick(e){
        if(!active) return;
        var tile = e.currentTarget;
        if(tile.disabled || tile.classList.contains('gem') || tile.classList.contains('mine')) return;
        var index = parseInt(tile.dataset.index, 10);
        tile.disabled = true;
        Api.post('/api/games/mines/reveal', { tile: index }).then(function(res){
          if(res.safe){
            tile.classList.add('gem');
            tile.querySelector('.mines-tile-inner').textContent = '💎';
            revealedCount += 1;
            multEl.textContent = res.multiplier.toFixed(2) + '×';
            potEl.textContent = fmt(res.potentialPayout);
            updateProgress(revealedCount, 25 - mineCount);
            cashoutBtn.style.display = '';
            showMsg(msg, 'Safe gem found — keep going or cash out.', 'win');
          } else {
            active = false;
            setMinePillsEnabled(true);
            res.mineIndices.forEach(function(mi){
              var t = gridEl.querySelector('[data-index="' + mi + '"]');
              if(t){
                t.classList.remove('dimmed');
                t.classList.add('mine');
                t.querySelector('.mines-tile-inner').textContent = '💣';
              }
            });
            gridEl.querySelectorAll('.mines-tile:not(.mine):not(.gem)').forEach(function(t){
              t.classList.add('dimmed');
              t.disabled = true;
            });
            gridEl.querySelectorAll('.mines-tile.gem').forEach(function(t){ t.disabled = true; });
            cashoutBtn.style.display = 'none';
            startBtn.style.display = '';
            applyWallet(res.wallet);
            syncGmBalance();
            showMsg(msg, 'Mine hit — you lost ' + fmt(currentBetAmt) + '.', 'lose');
            setRoundLocked(false);
          }
        }).catch(function(err){
          tile.disabled = false;
          showMsg(msg, err.message, 'lose');
        });
      }

      startBtn.addEventListener('click', function(){
        var bet = currentBet(betInput, BET_MIN.mines);
        startBtn.disabled = true;
        Api.post('/api/games/mines/start', { bet: bet, mineCount: mineCount }).then(function(res){
          currentBetAmt = bet;
          active = true;
          setRoundLocked(true);
          setMinePillsEnabled(false);
          if(App.user){ App.user.balance = res.balance; renderUser(); }
          syncGmBalance();
          buildGrid(true);
          multEl.textContent = '1.00×';
          potEl.textContent = '0.00';
          startBtn.style.display = 'none';
          cashoutBtn.style.display = 'none';
          showMsg(msg, 'Round live — reveal gems and avoid mines.', 'info');
          startBtn.disabled = false;
        }).catch(function(err){
          showMsg(msg, err.message, 'lose');
          startBtn.disabled = false;
        });
      });

      cashoutBtn.addEventListener('click', function(){
        cashoutBtn.disabled = true;
        Api.post('/api/games/mines/cashout').then(function(res){
          active = false;
          setMinePillsEnabled(true);
          gridEl.querySelectorAll('.mines-tile').forEach(function(t){ t.disabled = true; });
          cashoutBtn.style.display = 'none';
          startBtn.style.display = '';
          applyWallet(res.wallet);
          syncGmBalance();
          showMsg(msg, 'Cashed out +' + fmt(res.payout - currentBetAmt) + ' at ' + res.multiplier.toFixed(2) + '×.', 'win');
          cashoutBtn.disabled = false;
          setRoundLocked(false);
        }).catch(function(err){
          showMsg(msg, err.message, 'lose');
          cashoutBtn.disabled = false;
        });
      });
    }
  };

  Games.crash = {
    mount: function(stage){
      stage.innerHTML =
        '<div class="crash-shell">'
        + '<div class="crash-display" id="crDisplay">'
        + '<div class="crash-bg-grid"></div>'
        + '<canvas id="crCanvas"></canvas>'
        + '<div class="crash-hud">'
        + '<div class="crash-hud-top">'
        + '<div class="crash-mult-wrap"><div class="crash-mult" id="crMult">1.00×</div><div class="crash-sub" id="crSub">Set a bet and launch</div></div>'
        + '</div>'
        + '<div class="crash-bet-tag" id="crBetTag" style="display:none;">Bet <b id="crBetAmt">0.00</b></div>'
        + '</div></div>'
        + '</div>'
        + '<div class="crash-controls">'
        + betControlsHTML(BET_MIN.crash, BET_MIN.crash)
        + '<div class="game-msg info" id="crMsg">Set your bet and launch when ready.</div>'
        + '<div class="game-actions"><button type="button" class="btn btn-primary" id="crBet">Launch</button><button type="button" class="btn btn-gold" id="crCashout" style="display:none;">Cash Out</button></div>'
        + '</div>';

      var betInput = wireBetControls(BET_MIN.crash);
      var msg = document.getElementById('crMsg');
      var display = document.getElementById('crDisplay');
      var canvas = document.getElementById('crCanvas');
      var ctx = canvas.getContext('2d');
      var multEl = document.getElementById('crMult');
      var subEl = document.getElementById('crSub');
      var betBtn = document.getElementById('crBet');
      var cashoutBtn = document.getElementById('crCashout');
      var betTag = document.getElementById('crBetTag');
      var betAmtEl = document.getElementById('crBetAmt');
      var pollTimer = null;
      var rafId = null;
      var currentBetAmt = 0;

      var GROWTH_PER_SEC = 0.09;
      var startTime = null;
      var points = [];
      var running = false;
      var crashedState = false;
      var chartMaxT = 4000;
      var chartMaxM = 2;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);

      function setDisplayState(state){
        display.classList.remove('running', 'crashed-state');
        if(state) display.classList.add(state);
      }

      function resizeCanvas(){
        var w = display.clientWidth, h = display.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      function onResize(){
        resizeCanvas();
        draw();
      }
      resizeCanvas();
      window.addEventListener('resize', onResize);

      function stopPolling(){ if(pollTimer){ clearInterval(pollTimer); pollTimer = null; } }
      function stopRaf(){ if(rafId){ cancelAnimationFrame(rafId); rafId = null; } }
      currentGameCleanup = function(){ stopPolling(); stopRaf(); window.removeEventListener('resize', onResize); };

      function resetChartBounds(){
        chartMaxT = 3500;
        chartMaxM = 2;
      }

      function expandChartBounds(last){
        if(last.t > chartMaxT * 0.82) chartMaxT = Math.max(chartMaxT, last.t * 1.35);
        if(last.m > chartMaxM * 0.82) chartMaxM = Math.max(chartMaxM, Math.ceil(last.m * 1.35 * 10) / 10);
      }

      function drawRocket(x, y, angle, crashed){
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle + Math.PI / 2);
        if(crashed){
          ctx.beginPath();
          for(var i = 0; i < 8; i++){
            var a = (Math.PI * 2 * i) / 8;
            var r = i % 2 === 0 ? 14 : 7;
            var px = Math.cos(a) * r, py = Math.sin(a) * r;
            if(i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = '#FF2E4D';
          ctx.shadowColor = 'rgba(255,46,77,0.8)';
          ctx.shadowBlur = 18;
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -16);
          ctx.lineTo(9, 12);
          ctx.lineTo(0, 8);
          ctx.lineTo(-9, 12);
          ctx.closePath();
          ctx.fillStyle = '#F6F7FC';
          ctx.shadowColor = 'rgba(34,211,182,0.65)';
          ctx.shadowBlur = 14;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-5, 12);
          ctx.lineTo(0, 22);
          ctx.lineTo(5, 12);
          ctx.closePath();
          ctx.fillStyle = '#FFB800';
          ctx.shadowBlur = 10;
          ctx.fill();
        }
        ctx.restore();
      }

      function drawCurve(lineColor, fillTop){
        var w = display.clientWidth, h = display.clientHeight;
        var padLeft = 44, padRight = 20, padTop = 88, padBottom = 32;
        var last = points[points.length - 1];
        expandChartBounds(last);
        function X(t){ return padLeft + (t / chartMaxT) * (w - padLeft - padRight); }
        function Y(m){
          var range = chartMaxM - 1;
          if(range <= 0) return h - padBottom;
          return h - padBottom - ((m - 1) / range) * (h - padTop - padBottom);
        }

        ctx.strokeStyle = 'rgba(128,128,150,0.08)';
        ctx.fillStyle = 'rgba(180,184,200,0.4)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.lineWidth = 1;
        for(var g = 0; g <= 4; g++){
          var val = 1 + ((chartMaxM - 1) * g / 4);
          var gy = Math.round(Y(val)) + 0.5;
          ctx.beginPath(); ctx.moveTo(padLeft, gy); ctx.lineTo(w - padRight, gy); ctx.stroke();
          ctx.fillText(val.toFixed(2) + '×', padLeft - 6, gy);
        }

        var baseY = h - padBottom;
        var grad = ctx.createLinearGradient(0, padTop, 0, h);
        grad.addColorStop(0, fillTop);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.moveTo(X(points[0].t), baseY);
        ctx.lineTo(X(points[0].t), Y(points[0].m));
        for(var i = 1; i < points.length; i++){
          var prev = points[i - 1], cur = points[i];
          var cpx = (X(prev.t) + X(cur.t)) / 2;
          var cpy = (Y(prev.m) + Y(cur.m)) / 2;
          ctx.quadraticCurveTo(X(prev.t), Y(prev.m), cpx, cpy);
        }
        ctx.lineTo(X(last.t), Y(last.m));
        ctx.lineTo(X(last.t), baseY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(X(points[0].t), Y(points[0].m));
        for(var j = 1; j < points.length; j++){
          var p0 = points[j - 1], p1 = points[j];
          var mx = (X(p0.t) + X(p1.t)) / 2;
          var my = (Y(p0.m) + Y(p1.m)) / 2;
          ctx.quadraticCurveTo(X(p0.t), Y(p0.m), mx, my);
        }
        ctx.lineTo(X(last.t), Y(last.m));
        ctx.strokeStyle = lineColor;
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowColor = lineColor;
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;

        var tipX = X(last.t), tipY = Y(last.m);
        var refIdx = Math.max(0, points.length - 8);
        var ref = points[refIdx];
        var angle = Math.atan2(tipY - Y(ref.m), tipX - X(ref.t));
        drawRocket(tipX, tipY, angle, crashedState);

        return { tipX: tipX, tipY: tipY };
      }

      function draw(){
        var w = display.clientWidth, h = display.clientHeight;
        ctx.clearRect(0, 0, w, h);
        if(points.length < 2) return;
        var lineColor = crashedState ? '#FF2E4D' : '#22D3B6';
        var fillTop = crashedState ? 'rgba(255,46,77,0.28)' : 'rgba(34,211,182,0.22)';
        var tip = drawCurve(lineColor, fillTop);
        if(!crashedState && running && tip){
          ctx.beginPath();
          ctx.arc(tip.tipX, tip.tipY, 16, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(34,211,182,0.1)';
          ctx.fill();
        }
      }

      function tick(){
        if(!running) return;
        var elapsed = performance.now() - startTime;
        var m = Math.exp(GROWTH_PER_SEC * (elapsed / 1000));
        points.push({ t: elapsed, m: m });
        multEl.textContent = m.toFixed(2) + '×';
        draw();
        rafId = requestAnimationFrame(tick);
      }

      function endRoundCrashed(crashPoint){
        stopPolling();
        running = false;
        stopRaf();
        crashedState = true;
        setDisplayState('crashed-state');
        points.push({ t: (performance.now() - startTime), m: crashPoint });
        draw();
        display.classList.remove('shake');
        void display.offsetWidth;
        display.classList.add('shake');
        multEl.textContent = crashPoint.toFixed(2) + '×';
        multEl.classList.add('crashed');
        subEl.textContent = 'Crashed';
        cashoutBtn.style.display = 'none';
        betTag.style.display = 'none';
        betBtn.style.display = '';
      }

      function pollState(){
        Api.get('/api/games/crash/state').then(function(res){
          if(res.crashed){
            endRoundCrashed(res.crashPoint);
            applyWallet(res.wallet);
            syncGmBalance();
            showMsg(msg, 'Crashed at ' + res.crashPoint.toFixed(2) + '× — lost ' + fmt(currentBetAmt) + '.', 'lose');
            setRoundLocked(false);
          } else if(!res.active){
            stopPolling();
          }
        }).catch(function(){ stopPolling(); });
      }

      betBtn.addEventListener('click', function(){
        var bet = currentBet(betInput, BET_MIN.crash);
        betBtn.disabled = true;
        Api.post('/api/games/crash/bet', { bet: bet }).then(function(res){
          currentBetAmt = bet;
          setRoundLocked(true);
          if(App.user){ App.user.balance = res.balance; renderUser(); }
          syncGmBalance();
          betBtn.style.display = 'none';
          cashoutBtn.style.display = '';
          betTag.style.display = 'block';
          betAmtEl.textContent = fmt(bet);
          multEl.classList.remove('crashed');
          multEl.textContent = '1.00×';
          subEl.textContent = 'Rising…';
          setDisplayState('running');
          showMsg(msg, 'Multiplier rising — cash out before the crash.', 'info');

          resizeCanvas();
          resetChartBounds();
          points = [{ t: 0, m: 1 }];
          crashedState = false;
          running = true;
          startTime = performance.now();
          stopRaf();
          rafId = requestAnimationFrame(tick);
          stopPolling();
          pollTimer = setInterval(pollState, 150);
          betBtn.disabled = false;
        }).catch(function(err){
          showMsg(msg, err.message, 'lose');
          betBtn.disabled = false;
        });
      });

      cashoutBtn.addEventListener('click', function(){
        stopPolling();
        running = false;
        stopRaf();
        cashoutBtn.disabled = true;
        Api.post('/api/games/crash/cashout').then(function(res){
          if(res.crashed){
            endRoundCrashed(res.crashPoint);
            subEl.textContent = 'Too slow!';
            showMsg(msg, 'Crashed at ' + res.crashPoint.toFixed(2) + '× before cashout.', 'lose');
          } else {
            points.push({ t: (performance.now() - startTime), m: res.cashedOutAt });
            draw();
            setDisplayState('');
            subEl.textContent = 'Cashed out at ' + res.cashedOutAt.toFixed(2) + '×';
            showMsg(msg, 'Secured +' + fmt(res.payout - currentBetAmt) + ' at ' + res.cashedOutAt.toFixed(2) + '×.', 'win');
          }
          cashoutBtn.style.display = 'none';
          betTag.style.display = 'none';
          betBtn.style.display = '';
          applyWallet(res.wallet);
          syncGmBalance();
          cashoutBtn.disabled = false;
          setRoundLocked(false);
        }).catch(function(err){
          showMsg(msg, err.message, 'lose');
          cashoutBtn.disabled = false;
        });
      });
    }
  };

  Games.blackjack = {
    mount: function(stage){
      stage.innerHTML =
        '<div class="bj-table"><div class="bj-hands">'
        + '<div><div class="bj-hand-label"><span>Dealer</span><span id="bjDealerTotal"></span></div><div class="bj-cards" id="bjDealerCards"></div></div>'
        + '<div><div class="bj-hand-label"><span>You</span><span id="bjPlayerTotal"></span></div><div class="bj-cards" id="bjPlayerCards"></div></div>'
        + '</div></div>'
        + betControlsHTML(BET_MIN.blackjack, BET_MIN.blackjack)
        + '<div class="game-msg info" id="bjMsg">Place your bet and deal.</div>'
        + '<div class="game-actions" id="bjActions">'
        + '<button type="button" class="btn btn-primary" id="bjDeal">Deal</button>'
        + '<button type="button" class="btn btn-ghost" id="bjHit" style="display:none;">Hit</button>'
        + '<button type="button" class="btn btn-gold" id="bjStand" style="display:none;">Stand</button>'
        + '</div>';

      var betInput = wireBetControls(BET_MIN.blackjack);
      var msg = document.getElementById('bjMsg');
      var dealerCardsEl = document.getElementById('bjDealerCards');
      var playerCardsEl = document.getElementById('bjPlayerCards');
      var dealerTotalEl = document.getElementById('bjDealerTotal');
      var playerTotalEl = document.getElementById('bjPlayerTotal');
      var dealBtn = document.getElementById('bjDeal');
      var hitBtn = document.getElementById('bjHit');
      var standBtn = document.getElementById('bjStand');
      var currentBetAmt = 0;

      function cardHtml(card, hidden){
        if(hidden){
          return '<div class="bj-card hidden"><div class="bj-card-back"><svg viewBox="0 0 24 24"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/></svg></div></div>';
        }
        var rank = card.slice(0, -1), suit = card.slice(-1);
        var suitChar = { S: '♠', H: '♥', D: '♦', C: '♣' }[suit];
        var isRed = suit === 'H' || suit === 'D';
        var corner = '<b>' + rank + '</b>' + suitChar;
        return '<div class="bj-card' + (isRed ? ' red-suit' : '') + '">'
          + '<span class="bj-card-corner bj-card-corner-tl">' + corner + '</span>'
          + '<span class="bj-card-suit-center">' + suitChar + '</span>'
          + '<span class="bj-card-corner bj-card-corner-br">' + corner + '</span>'
          + '</div>';
      }
      function clientHandValue(hand){
        var total = 0, aces = 0;
        hand.forEach(function(c){
          var rank = c.slice(0, -1);
          var v = rank === 'A' ? 11 : (['J', 'Q', 'K'].indexOf(rank) > -1 ? 10 : parseInt(rank, 10));
          if(rank === 'A') aces++;
          total += v;
        });
        while(total > 21 && aces > 0){ total -= 10; aces--; }
        return total;
      }
      function renderHands(playerHand, dealerHand, dealerHidden){
        playerCardsEl.innerHTML = playerHand.map(function(c){ return cardHtml(c, false); }).join('');
        var dealerHtml = dealerHand.map(function(c){ return cardHtml(c, false); }).join('');
        if(dealerHidden) dealerHtml += cardHtml(null, true);
        dealerCardsEl.innerHTML = dealerHtml;
        playerTotalEl.textContent = clientHandValue(playerHand);
        dealerTotalEl.textContent = dealerHidden ? '' : clientHandValue(dealerHand);
      }
      function resetControls(){
        dealBtn.style.display = '';
        hitBtn.style.display = 'none';
        standBtn.style.display = 'none';
      }

      dealBtn.addEventListener('click', function(){
        var bet = currentBet(betInput, BET_MIN.blackjack);
        dealBtn.disabled = true;
        Api.post('/api/games/blackjack/deal', { bet: bet }).then(function(res){
          currentBetAmt = bet;
          if(res.finished){
            renderHands(res.playerHand, res.dealerHand, false);
            applyWallet(res.wallet);
            syncGmBalance();
            var net = res.payout - bet;
            showMsg(msg, res.outcome === 'push' ? 'Push — bet returned.' : ('Blackjack! +' + fmt(net)), res.outcome === 'push' ? 'info' : 'win');
            resetControls();
          } else {
            setRoundLocked(true);
            renderHands(res.playerHand, res.dealerHand, true);
            if(App.user){ App.user.balance -= 0; }
            refreshMe().then(function(){ syncGmBalance(); });
            dealBtn.style.display = 'none';
            hitBtn.style.display = '';
            standBtn.style.display = '';
            showMsg(msg, 'Hit or stand.', 'info');
          }
          dealBtn.disabled = false;
        }).catch(function(err){
          showMsg(msg, err.message, 'lose');
          dealBtn.disabled = false;
        });
      });

      hitBtn.addEventListener('click', function(){
        hitBtn.disabled = true;
        Api.post('/api/games/blackjack/hit').then(function(res){
          if(res.finished){
            renderHands(res.playerHand, [], false);
            applyWallet(res.wallet);
            syncGmBalance();
            showMsg(msg, 'Bust — you lost ' + fmt(currentBetAmt) + '.', 'lose');
            resetControls();
            setRoundLocked(false);
          } else {
            playerCardsEl.innerHTML = res.playerHand.map(function(c){ return cardHtml(c, false); }).join('');
            playerTotalEl.textContent = res.total;
          }
          hitBtn.disabled = false;
        }).catch(function(err){
          showMsg(msg, err.message, 'lose');
          hitBtn.disabled = false;
        });
      });

      standBtn.addEventListener('click', function(){
        standBtn.disabled = true;
        Api.post('/api/games/blackjack/stand').then(function(res){
          renderHands(res.playerHand, res.dealerHand, false);
          applyWallet(res.wallet);
          syncGmBalance();
          var net = res.payout - currentBetAmt;
          var label = res.outcome === 'win' ? ('You win! +' + fmt(net)) : (res.outcome === 'push' ? 'Push — bet returned.' : ('Dealer wins -' + fmt(currentBetAmt)));
          showMsg(msg, label, res.outcome === 'win' ? 'win' : (res.outcome === 'push' ? 'info' : 'lose'));
          resetControls();
          standBtn.disabled = false;
          setRoundLocked(false);
        }).catch(function(err){
          showMsg(msg, err.message, 'lose');
          standBtn.disabled = false;
        });
      });
    }
  };

  function mountGamePage(key){
    var container = document.getElementById('gamePageStage');
    var gate = document.getElementById('gameSignInGate');
    if(!container) return;
    var titleEl = document.getElementById('gmTitle');
    var subEl = document.getElementById('gmSub');
    if(titleEl) titleEl.textContent = GAME_META[key].title;
    if(subEl) subEl.textContent = GAME_META[key].sub;

    function configureGate(title, message, btnLabel, onClick){
      if(!gate) return;
      gate.style.display = 'flex';
      var h3 = gate.querySelector('h3');
      var p = gate.querySelector('p');
      var btn = gate.querySelector('button');
      if(h3) h3.textContent = title;
      if(p) p.textContent = message;
      if(btn){
        btn.textContent = btnLabel;
        btn.onclick = onClick;
      }
    }

    function doMount(){
      if(gate) gate.style.display = 'none';
      container.style.display = 'block';
      currentGameCleanup = null;
      setRoundLocked(false);
      syncGmBalance();
      Games[key].mount(container);
    }

    function waitUntilReady(checkFn, onReady){
      var timer = setInterval(function(){
        if(!checkFn()) return;
        clearInterval(timer);
        onReady();
      }, 400);
    }

    (window.appReady || Promise.resolve()).then(function(){
      if(!App.user){
        configureGate(
          'Sign in to play ' + GAME_META[key].title,
          'Create a free account first, then link your Roblox account to unlock all games.',
          'Sign In',
          function(){ requireLogin(); }
        );
        container.style.display = 'none';
        waitUntilReady(function(){ return !!App.user; }, function(){
          if(App.user.robloxLinked) doMount();
          else mountGamePage(key);
        });
        return;
      }
      if(!App.user.robloxLinked){
        configureGate(
          'Link Roblox to play ' + GAME_META[key].title,
          'You must verify and link your Roblox account before you can bet or play any games.',
          'Link Roblox account',
          function(){ requireRobloxLinked(); }
        );
        container.style.display = 'none';
        waitUntilReady(function(){ return App.user && App.user.robloxLinked; }, doMount);
        return;
      }
      doMount();
    });
  }
  window.mountGamePage = mountGamePage;
  window.requireLogin = requireLogin;
  window.requireRobloxLinked = requireRobloxLinked;
  window.loadRecentActivity = loadRecentActivity;
  window.loadLiveGames = loadLiveGames;

  window.appReady = refreshMe().then(function(){
    if(App.user) loadChat();
    loadLiveGames();
  });
  setInterval(function(){
    if(App.user && document.getElementById('chatMessages')) loadChat();
  }, 4000);
  refreshChatGate();

})();
