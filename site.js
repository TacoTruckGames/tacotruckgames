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

  function select(id, opts) {
    opts = opts || {};
    if (ids.indexOf(id) < 0) return;
    var tab = document.getElementById('tab-' + id);
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
    }
    if (opts.focus) tab.focus({ preventScroll: true });
    if (narrow.matches && tab.scrollIntoView) {
      tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce.matches ? 'auto' : 'smooth' });
    }
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

  /* ── Swipe left/right to move between projects (mobile) ──
     Handled over the hero and the showcase, but not the rail or a screenshot
     strip (those scroll horizontally on their own), nor the lightbox. */
  function stepProject(dir) {
    var i = ids.indexOf(current);
    if (i < 0) return;
    var n = (i + dir + ids.length) % ids.length;
    history.replaceState(null, '', '#' + ids[n]);
    select(ids[n]);
  }

  (function () {
    var sx = 0, sy = 0, track = false;
    function onStart(e) {
      if (e.touches.length !== 1) { track = false; return; }
      var t = e.target;
      if (t.closest && t.closest('.rail, .media-strip, .lightbox')) { track = false; return; }
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; track = true;
    }
    function onEnd(e) {
      if (!track) return;
      track = false;
      var t = e.changedTouches[0];
      var dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        stepProject(dx < 0 ? 1 : -1); /* swipe left → next project */
      }
    }
    ['.cine', '.showcase'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      el.addEventListener('touchstart', onStart, { passive: true });
      el.addEventListener('touchend', onEnd, { passive: true });
    });
  })();

  /* ── Contact form: no backend on a static site, so build a pre-filled email ── */
  var form = document.getElementById('contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var subject = '[tacotruckgames.com] ' + f.subject.value + ' — ' + f.name.value;
      var body = f.message.value + '\n\n— ' + f.name.value + ' <' + f.email.value + '>';
      location.href = 'mailto:Adrian@TacoTruckGames.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
      var hint = form.querySelector('.form-hint');
      if (hint) { hint.textContent = 'Your mail app should open with the message filled in.'; hint.classList.add('sent'); }
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
