/* Taco Truck Games — project switcher + media lightbox.
   Everything is in the HTML already; this only chooses which panel is visible,
   keeps the URL hash in sync, lazy-loads media, and opens trailers/screenshots. */
(function () {
  'use strict';

  var rail = document.querySelector('.rail');
  var tabs = rail ? Array.prototype.slice.call(rail.querySelectorAll('[role="tab"]')) : [];
  if (!tabs.length) return;

  var ids = tabs.map(function (t) { return t.id.replace(/^tab-/, ''); });
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var narrow = window.matchMedia('(max-width: 900px)');
  var current = null;
  var stage = document.querySelector('.stage');
  var panelList = ids.map(panelOf);
  var mobileReady = false;

  function panelOf(id) { return document.getElementById('panel-' + id); }

  /* Non-default panels keep their images in data-src so nothing loads until first selection. */
  function hydrate(panel) {
    if (panel.getAttribute('data-hydrated')) return;
    panel.setAttribute('data-hydrated', '1');
    Array.prototype.forEach.call(panel.querySelectorAll('[data-src]'), function (img) {
      img.setAttribute('src', img.getAttribute('data-src'));
      img.removeAttribute('data-src');
    });
  }

  function setTabStates(id) {
    var tab = document.getElementById('tab-' + id);
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
  }

  /* Mirror the active project onto <html> so per-project ambient effects
     (Stop Santa snow, Depths of Ruin ash) can key off it in CSS. */
  function setActiveProject(id) {
    document.documentElement.setAttribute('data-project', id);
  }

  function revealTab(id, smooth) {
    var tab = document.getElementById('tab-' + id);
    if (narrow.matches && tab && tab.scrollIntoView) {
      tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: (smooth && !reduce.matches) ? 'smooth' : 'auto' });
    }
  }

  /* Mobile carousel: show and load every panel so swiping between them is smooth. */
  function prepCarousel() {
    if (mobileReady) return;
    mobileReady = true;
    panelList.forEach(function (p) { if (p) { hydrate(p); p.hidden = false; p.classList.remove('is-entering'); } });
  }

  /* Size the carousel to the active panel so short panels don't leave a gap. */
  function fitStage(id) {
    if (!stage || !narrow.matches) return;
    var p = panelList[ids.indexOf(id)];
    if (p) stage.style.height = p.offsetHeight + 'px';
  }

  var suppressSync = false, suppressT;
  function scrollToPanel(id, smooth) {
    if (!stage) return;
    var i = ids.indexOf(id);
    if (i < 0) return;
    var behavior = (smooth && !reduce.matches) ? 'smooth' : 'auto';
    suppressSync = true;
    clearTimeout(suppressT);
    stage.scrollTo({ left: Math.round(i * stage.clientWidth), behavior: behavior });
    suppressT = setTimeout(function () { suppressSync = false; }, behavior === 'smooth' ? 520 : 60);
  }

  function select(id, opts) {
    opts = opts || {};
    if (ids.indexOf(id) < 0) return;
    var tab = document.getElementById('tab-' + id);

    /* Mobile: all panels stay in the DOM carousel; "selecting" scrolls to one. */
    if (narrow.matches && stage) {
      prepCarousel();
      setTabStates(id);
      current = id;
      setActiveProject(id);
      fitStage(id);
      scrollToPanel(id, opts.smooth !== false);
      revealTab(id, true);
      if (opts.focus && tab) tab.focus({ preventScroll: true });
      return;
    }

    /* Desktop: one panel at a time, with a short enter animation. */
    if (id !== current) {
      tabs.forEach(function (t) {
        var on = t === tab;
        var p = panelOf(t.id.slice(4));
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        if (!p) return;
        if (on) {
          hydrate(p);
          p.hidden = false;
          if (!reduce.matches) {
            p.classList.remove('is-entering');
            void p.offsetWidth; /* restart the animation */
            p.classList.add('is-entering');
          }
        } else {
          p.hidden = true;
        }
      });
      current = id;
      setActiveProject(id);
    }
    if (opts.focus && tab) tab.focus({ preventScroll: true });
  }

  /* A project id selects that project; an empty hash (e.g. after Back) restores the default;
     other hashes (#halloween, #noseason, #about ...) leave the selection alone. */
  function fromHash() {
    var h = decodeURIComponent(location.hash.slice(1));
    if (ids.indexOf(h) >= 0) select(h);
    else if (h === '' || !current) select(ids[0]);
  }

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function (e) {
      e.preventDefault(); /* no jump to the panel; we set the hash ourselves */
      var id = tab.id.slice(4);
      if (id !== current) history.pushState(null, '', '#' + id);
      select(id);
    });
  });

  rail.addEventListener('keydown', function (e) {
    var i = ids.indexOf(current), n;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowRight': n = (i + 1) % ids.length; break;
      case 'ArrowUp':   case 'ArrowLeft':  n = (i - 1 + ids.length) % ids.length; break;
      case 'Home': n = 0; break;
      case 'End':  n = ids.length - 1; break;
      default: return;
    }
    e.preventDefault();
    history.replaceState(null, '', '#' + ids[n]);
    select(ids[n], { focus: true });
  });

  window.addEventListener('hashchange', fromHash);
  fromHash();
  /* Land exactly on the active panel at load, with no scroll animation. */
  if (narrow.matches && stage && current) {
    requestAnimationFrame(function () { fitStage(current); scrollToPanel(current, false); });
  }

  /* ── Mobile carousel: sync the active tab + hash to the scroll position ──
     Native scroll gives the smooth finger-following swipe; here we just read
     which panel settled into view and update the rail and URL to match. */
  if (stage) {
    var syncRaf;
    stage.addEventListener('scroll', function () {
      if (!narrow.matches || suppressSync) return;
      cancelAnimationFrame(syncRaf);
      syncRaf = requestAnimationFrame(function () {
        var w = stage.clientWidth || 1;
        var idx = Math.max(0, Math.min(ids.length - 1, Math.round(stage.scrollLeft / w)));
        var id = ids[idx];
        if (id && id !== current) {
          current = id;
          setActiveProject(id);
          setTabStates(id);
          fitStage(id);
          revealTab(id, true);
          history.replaceState(null, '', '#' + id);
        }
      });
    }, { passive: true });
  }

  /* Rearrange when crossing the mobile/desktop breakpoint so each mode is consistent. */
  function onModeChange() {
    if (!current) return;
    if (narrow.matches) {
      prepCarousel();
      setTabStates(current);
      requestAnimationFrame(function () { fitStage(current); scrollToPanel(current, false); });
    } else {
      if (stage) stage.style.height = ''; /* desktop uses natural height */
      panelList.forEach(function (p) { if (p) p.hidden = (p.id !== 'panel-' + current); });
      var cp = panelOf(current);
      if (cp) hydrate(cp);
    }
  }
  if (narrow.addEventListener) narrow.addEventListener('change', onModeChange);
  else if (narrow.addListener) narrow.addListener(onModeChange);

  /* Re-measure the active panel's height once media loads and when the width changes. */
  window.addEventListener('load', function () { if (narrow.matches && current) fitStage(current); });
  var fitRaf;
  window.addEventListener('resize', function () {
    if (!narrow.matches || !current) return;
    cancelAnimationFrame(fitRaf);
    fitRaf = requestAnimationFrame(function () { fitStage(current); scrollToPanel(current, false); });
  });

  /* ── Contact form: validate, then POST to the Worker on codev.tacotruckgames.com
     (GitHub Pages has no backend). It stores the message and emails us. If the
     request fails, offer a pre-filled mailto instead. ── */
  var form = document.getElementById('contact-form');
  if (form) {
    var endpoint = form.getAttribute('data-endpoint');
    var hint = form.querySelector('.form-hint');
    var button = form.querySelector('button[type=submit]');
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var rules = {
      name: function (v) { return v.length < 2 ? 'Please enter your name.' : ''; },
      email: function (v) { return EMAIL.test(v) ? '' : 'Enter a valid email address.'; },
      message: function (v) { return v.length < 10 ? 'Please write a short message.' : ''; }
    };

    function val(name) { return (form.elements[name].value || '').trim(); }
    function showError(name, msg) {
      var input = form.elements[name];
      var slot = input.parentNode.querySelector('.field-error');
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      if (slot) slot.textContent = msg || '';
      return !msg;
    }
    function validateField(name) { return showError(name, rules[name](val(name))); }
    function validateAll() {
      var firstBad = null;
      Object.keys(rules).forEach(function (n) { if (!validateField(n) && !firstBad) firstBad = n; });
      if (firstBad) form.elements[firstBad].focus();
      return !firstBad;
    }
    Object.keys(rules).forEach(function (n) {
      var input = form.elements[n];
      input.addEventListener('blur', function () { validateField(n); });
      input.addEventListener('input', function () { if (input.getAttribute('aria-invalid')) validateField(n); });
    });

    function setHint(html, cls) { if (hint) { hint.innerHTML = html; hint.className = 'form-hint' + (cls ? ' ' + cls : ''); } }
    function mailto() {
      var subject = '[tacotruckgames.com] ' + val('subject') + ' — ' + val('name');
      var body = val('message') + '\n\n— ' + val('name') + ' <' + val('email') + '>';
      return 'mailto:Adrian@TacoTruckGames.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!validateAll()) return;
      button.disabled = true;
      button.textContent = 'Sending…';
      setHint('');

      var payload = {};
      ['name', 'email', 'subject', 'message', 'website'].forEach(function (n) { payload[n] = val(n); });

      fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) { return { res: res, data: data }; });
        })
        .then(function (r) {
          if (r.res.ok && r.data.ok) {
            form.innerHTML = '<div class="form-success"><strong>Thanks — we got it.</strong><p>We usually reply within a couple of days from Adrian@TacoTruckGames.com.</p></div>';
            return;
          }
          if (r.res.status === 400 && r.data.errors) {
            Object.keys(r.data.errors).forEach(function (n) { if (rules[n]) showError(n, r.data.errors[n]); });
            setHint('Please fix the highlighted fields.', 'error');
          } else {
            throw new Error(r.data.error || 'Request failed');
          }
        })
        .catch(function (err) {
          setHint((err.message === 'Failed to fetch' ? 'We couldn\'t reach the server.' : err.message) +
            ' <a href="' + mailto() + '">Send it by email instead</a>.', 'error');
        })
        .then(function () {
          if (document.body.contains(button)) { button.disabled = false; button.textContent = 'Send message'; }
        });
    });
  }

  /* ── Lightbox: trailers + screenshots, with prev/next (buttons, arrow keys, swipe) ── */
  var lb = document.getElementById('lightbox');
  if (!lb) return;
  var lbBody = lb.querySelector('.lightbox-body');
  var lbClose = lb.querySelector('.lightbox-close');
  var lbPrev = lb.querySelector('.lightbox-nav.prev');
  var lbNext = lb.querySelector('.lightbox-nav.next');
  var lastFocus = null;
  var group = [];  /* the .media tiles of the strip we opened from */
  var gi = 0;      /* index of the item on screen */

  /* Build the enlarged node (video, YouTube embed, or image) for a .media tile. */
  function mediaNode(btn) {
    var label = btn.getAttribute('aria-label') || 'Trailer';
    if (btn.getAttribute('data-video')) {
      var v = document.createElement('video');
      v.src = btn.getAttribute('data-video');
      if (btn.getAttribute('data-poster')) v.poster = btn.getAttribute('data-poster');
      v.controls = true;
      v.setAttribute('playsinline', '');
      if (!reduce.matches) v.autoplay = true;
      return v;
    }
    if (btn.getAttribute('data-youtube')) {
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + btn.getAttribute('data-youtube') +
              '?rel=0' + (reduce.matches ? '' : '&autoplay=1');
      f.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture';
      f.allowFullscreen = true;
      f.title = label;
      return f;
    }
    var img = btn.querySelector('img');
    if (!img || !img.getAttribute('src')) return null;
    var n = document.createElement('img');
    n.src = img.getAttribute('src');
    n.alt = img.alt;
    return n;
  }

  function showAt(i) {
    if (!group.length) return;
    gi = (i + group.length) % group.length; /* wrap around */
    var node = mediaNode(group[gi]);
    if (!node) return;
    lbBody.innerHTML = ''; /* removes any playing video or iframe */
    lbBody.appendChild(node);
    var multi = group.length > 1;
    lbPrev.hidden = !multi;
    lbNext.hidden = !multi;
  }

  function openFrom(btn) {
    var strip = btn.closest ? btn.closest('.media-strip') : null;
    group = strip ? Array.prototype.slice.call(strip.querySelectorAll('.media')) : [btn];
    var idx = group.indexOf(btn);
    if (idx < 0) { group = [btn]; idx = 0; }
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.classList.add('no-scroll');
    showAt(idx);
    lbClose.focus();
  }

  function closeLightbox() {
    lb.hidden = true;
    lbBody.innerHTML = '';
    document.body.classList.remove('no-scroll');
    group = [];
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.media') : null;
    if (!btn) return;
    openFrom(btn);
  });

  lbPrev.addEventListener('click', function (e) { e.stopPropagation(); showAt(gi - 1); });
  lbNext.addEventListener('click', function (e) { e.stopPropagation(); showAt(gi + 1); });

  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target === lbClose) closeLightbox();
  });

  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft') showAt(gi - 1);
    else if (e.key === 'ArrowRight') showAt(gi + 1);
  });

  /* Swipe left/right to move between items (mobile). */
  var tsx = 0, tsy = 0, tracking = false;
  lbBody.addEventListener('touchstart', function (e) {
    if (e.touches.length !== 1) { tracking = false; return; }
    tsx = e.touches[0].clientX;
    tsy = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  lbBody.addEventListener('touchend', function (e) {
    if (!tracking) return;
    tracking = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - tsx, dy = t.clientY - tsy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      showAt(gi + (dx < 0 ? 1 : -1)); /* swipe left → next */
    }
  }, { passive: true });
})();
