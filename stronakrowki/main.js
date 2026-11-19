/* Krowki.pl – koncepcja nowej strony. Ilustracje SVG i drobne interakcje. */
(function () {
  "use strict";

  // ---------- Ilustracja: krówka w papierku ----------
  // Papierek krówki: środek (front) + boczne zakładki zagięte na końcach.
  function candy(o) {
    var bg = o.bg || "#f6ecdc", ink = o.ink || "#160602", acc = o.accent || "#b26935";
    var t = o.title || "KRÓWKA", s = o.sub || "z Milanówka", id = "c" + Math.random().toString(36).slice(2, 8);
    var pattern = "";
    if (o.pattern === "stripes") pattern = '<path d="M51 26 L149 26 L154 76 L46 76 Z" fill="url(#' + id + 'p)" opacity=".18"/>';
    if (o.pattern === "dots") pattern = '<path d="M51 26 L149 26 L154 76 L46 76 Z" fill="url(#' + id + 'd)" opacity=".22"/>';
    var photo = o.photo
      ? '<circle cx="100" cy="43" r="10" fill="' + acc + '" opacity=".35"/><circle cx="96" cy="41" r="3.2" fill="' + ink + '" opacity=".55"/><circle cx="104" cy="41" r="3.2" fill="' + ink + '" opacity=".45"/><path d="M93 47 q7 5 14 0" stroke="' + ink + '" stroke-width="1.4" fill="none" opacity=".5"/>'
      : "";
    var ty = o.photo ? 62 : 54, sy = o.photo ? 69 : 66;
    return (
      '<svg viewBox="0 0 200 130" role="img" aria-label="Krówka w papierku: ' + t + '" xmlns="http://www.w3.org/2000/svg">' +
      "<defs>" +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient>' +
      '<pattern id="' + id + 'p" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="' + acc + '"/></pattern>' +
      '<pattern id="' + id + 'd" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="4.5" cy="4.5" r="1.6" fill="' + acc + '"/></pattern>' +
      '<filter id="' + id + 's" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#160602" flood-opacity=".22"/></filter>' +
      "</defs>" +
      '<g filter="url(#' + id + 's)">' +
      // skrzydełka: płaskie, trójkątne, przy podstawie (jak w podglądzie 3D konfiguratora)
      '<path d="M51 52 L5 81 L48 98 Z" fill="#000" opacity=".16" transform="translate(0 2)"/>' +
      '<path d="M149 52 L195 81 L152 98 Z" fill="#000" opacity=".16" transform="translate(0 2)"/>' +
      '<path d="M51 52 L5 81 L48 98 Z" fill="' + bg + '"/>' +
      '<path d="M149 52 L195 81 L152 98 Z" fill="' + bg + '"/>' +
      '<path d="M51 52 L5 81 L48 98 Z M149 52 L195 81 L152 98 Z" fill="#000" opacity=".06"/>' +
      '<path d="M5 81 L48 98 M195 81 L152 98" stroke="#000" stroke-opacity=".18" stroke-width=".8"/>' +
      // bok (ścianka przednia)
      '<path d="M46 76 L154 76 L152 97 L48 97 Z" fill="' + bg + '"/>' +
      '<path d="M46 76 L154 76 L152 97 L48 97 Z" fill="#000" opacity=".13"/>' +
      // front (góra cukierka)
      '<path d="M51 26 L149 26 L154 76 L46 76 Z" fill="' + bg + '"/>' +
      pattern +
      '<path d="M51 26 L149 26 L154 76 L46 76 Z" fill="url(#' + id + 'g)"/>' +
      '<path d="M57 31 L143 31 L147 71 L53 71 Z" fill="none" stroke="' + acc + '" stroke-width=".9"/>' +
      '<path d="M46 76 L154 76" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>' +
      photo +
      '<text x="100" y="' + ty + '" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="' + (o.photo ? 10 : 14) + '" font-weight="600" fill="' + ink + '" letter-spacing=".5">' + t + "</text>" +
      '<text x="100" y="' + sy + '" text-anchor="middle" font-family="Inter, sans-serif" font-size="5.4" fill="' + acc + '" letter-spacing="1.4">' + s.toUpperCase() + "</text>" +
      "</g></svg>"
    );
  }

  // Znak graficzny: krowa w medalionie (uproszczona, własna)
  function cowMark(color) {
    color = color || "#160602";
    return (
      '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="30" fill="none" stroke="' + color + '" stroke-width="1.5"/>' +
      '<circle cx="32" cy="32" r="26" fill="none" stroke="#b26935" stroke-width=".8"/>' +
      '<path d="M19 26 q-5 -6 -1 -9 q4 2 6 6 M45 26 q5 -6 1 -9 q-4 2 -6 6" fill="none" stroke="' + color + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M22 24 q10 -6 20 0 q3 8 0 16 q-2 8 -10 8 q-8 0 -10 -8 q-3 -8 0 -16 Z" fill="none" stroke="' + color + '" stroke-width="1.6"/>' +
      '<ellipse cx="32" cy="42" rx="7" ry="4.5" fill="none" stroke="' + color + '" stroke-width="1.4"/>' +
      '<circle cx="29.5" cy="42" r=".9" fill="' + color + '"/><circle cx="34.5" cy="42" r=".9" fill="' + color + '"/>' +
      '<circle cx="27" cy="31" r="1.3" fill="' + color + '"/><circle cx="37" cy="31" r="1.3" fill="' + color + '"/>' +
      "</svg>"
    );
  }

  // Okrągła pieczęć „od 1921”
  function seal() {
    return (
      '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<defs><path id="sealc" d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0"/></defs>' +
      '<circle cx="60" cy="60" r="57" fill="#160602"/>' +
      '<circle cx="60" cy="60" r="52" fill="none" stroke="#d9a57c" stroke-width=".8"/>' +
      '<text font-family="Inter, sans-serif" font-size="9.2" letter-spacing="3.1" fill="#d9a57c"><textPath href="#sealc">RODZINNA MANUFAKTURA · MILANÓWEK · </textPath></text>' +
      '<text x="60" y="56" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="12" fill="#f4f0e7" font-style="italic">od</text>' +
      '<text x="60" y="76" text-anchor="middle" font-family="Cormorant Garamond, Georgia, serif" font-size="24" font-weight="600" fill="#f4f0e7">1921</text>' +
      "</svg>"
    );
  }

  // Pudełko degustacyjne
  function box() {
    return (
      '<svg viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M30 70 L110 40 L190 70 L110 100 Z" fill="#e9d3b3"/>' +
      '<path d="M30 70 L110 100 L110 165 L30 135 Z" fill="#c99a62"/>' +
      '<path d="M190 70 L110 100 L110 165 L190 135 Z" fill="#b26935"/>' +
      '<path d="M70 55 L150 85" stroke="#160602" stroke-width="10" opacity=".85"/>' +
      '<path d="M150 85 L150 150" stroke="#160602" stroke-width="10" opacity=".7"/>' +
      '<text x="70" y="128" font-family="Cormorant Garamond, Georgia, serif" font-size="13" fill="#160602" transform="rotate(20 70 128)">GRATIS</text>' +
      "</svg>"
    );
  }

  window.KROWKI = { candy: candy, cowMark: cowMark, seal: seal, box: box };

  // Wstawianie ilustracji z atrybutów data-*
  document.querySelectorAll("[data-candy]").forEach(function (el) {
    var d = el.dataset;
    el.insertAdjacentHTML("beforeend", candy({
      bg: d.bg, ink: d.ink, accent: d.accent, title: d.title, sub: d.sub, pattern: d.pattern, photo: d.photo === "1"
    }));
  });
  document.querySelectorAll("[data-cow]").forEach(function (el) { el.innerHTML = cowMark(el.dataset.cow || undefined); });
  document.querySelectorAll("[data-seal]").forEach(function (el) { el.innerHTML = seal(); });
  document.querySelectorAll("[data-box]").forEach(function (el) { el.innerHTML = box(); });

  // ---------- Menu mobilne ----------
  var burger = document.querySelector(".burger"), menu = document.querySelector(".menu");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () { menu.classList.remove("open"); burger.setAttribute("aria-expanded", "false"); });
    });
  }

  // ---------- Animacje wejścia ----------
  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: .12 }) : null;
  document.querySelectorAll(".reveal").forEach(function (el) { io ? io.observe(el) : el.classList.add("in"); });

  // ---------- Liczniki ----------
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var target = +el.dataset.count, suffix = el.dataset.suffix || "", prefix = el.dataset.prefix || "";
    function run() {
      if (reduce) { el.textContent = prefix + target + suffix; return; }
      var t0 = null;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / 1400, 1), v = Math.round(target * (1 - Math.pow(1 - p, 3)));
        el.textContent = prefix + v + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    if (io) {
      var o2 = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { run(); o2.disconnect(); } });
      o2.observe(el);
    } else run();
  });

  // ---------- Toast ----------
  window.krowkiToast = function (msg) {
    var t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.remove("show"); }, 2600);
  };

  // Formularze demonstracyjne
  document.querySelectorAll("form[data-demo]").forEach(function (f) {
    f.addEventListener("submit", function (e) { e.preventDefault(); window.krowkiToast(f.dataset.demo); f.reset(); });
  });
})();

/* ---------- Lightbox galerii i okna (modal) ---------- */
(function () {
  "use strict";
  var lastFocus = null;

  function overlay(cls, inner) {
    var o = document.createElement("div");
    o.className = "ovl " + cls;
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.innerHTML = inner;
    document.body.appendChild(o);
    document.body.classList.add("no-scroll");
    requestAnimationFrame(function () { o.classList.add("open"); });
    return o;
  }
  function closeOverlay(o) {
    if (!o) return;
    o.classList.remove("open");
    document.body.classList.remove("no-scroll");
    setTimeout(function () { o.remove(); }, 200);
    if (lastFocus) lastFocus.focus();
  }

  // Lightbox
  var lb = null, items = [], idx = 0;
  function show(i) {
    idx = (i + items.length) % items.length;
    var a = items[idx], img = a.querySelector("img");
    var big = lb.querySelector(".lb-img");
    big.src = a.getAttribute("href");
    big.alt = img ? img.alt : "";
    lb.querySelector(".lb-count").textContent = (idx + 1) + " / " + items.length;
    lb.querySelector(".lb-cap").textContent = img ? img.alt : "";
  }
  function openLb(a) {
    var g = a.dataset.lb;
    items = Array.prototype.filter.call(document.querySelectorAll('a[data-lb="' + g + '"]'), function (x) { return x.offsetParent !== null || x.hasAttribute("data-lb-first"); });
    lastFocus = a;
    lb = overlay("lb",
      '<button class="ovl-close" type="button" aria-label="Zamknij">×</button>' +
      '<button class="lb-nav lb-prev" type="button" aria-label="Poprzednie zdjęcie">‹</button>' +
      '<figure class="lb-fig"><img class="lb-img" referrerpolicy="no-referrer" alt=""><figcaption><span class="lb-cap"></span><span class="lb-count"></span></figcaption></figure>' +
      '<button class="lb-nav lb-next" type="button" aria-label="Następne zdjęcie">›</button>');
    lb.setAttribute("aria-label", "Galeria zdjęć");
    show(items.indexOf(a));
    if (items.length < 2) lb.querySelectorAll(".lb-nav").forEach(function (b) { b.hidden = true; });
    lb.addEventListener("click", function (e) {
      if (e.target.closest(".lb-prev")) return show(idx - 1);
      if (e.target.closest(".lb-next")) return show(idx + 1);
      if (e.target.closest(".ovl-close") || e.target === lb || e.target.classList.contains("lb-fig")) { closeOverlay(lb); lb = null; }
    });
    lb.querySelector(".ovl-close").focus();
  }

  // Modal (blog, dokumenty)
  var md = null;
  function openModal(trigger) {
    var key = trigger.dataset.modal, tpl = document.getElementById("tpl-" + key);
    if (!tpl) return;
    lastFocus = trigger;
    md = overlay("md", '<div class="md-box"><button class="ovl-close" type="button" aria-label="Zamknij">×</button><div class="md-body"></div></div>');
    var body = md.querySelector(".md-body");
    body.appendChild(tpl.content.cloneNode(true));
    var slot = body.querySelector('[data-slot="title"]');
    if (slot && trigger.dataset.title) slot.textContent = trigger.dataset.title;
    var h = body.querySelector("h2");
    if (h) { h.id = "md-title"; md.setAttribute("aria-labelledby", "md-title"); }
    if (key.indexOf("post-") === 0) body.insertAdjacentHTML("beforeend", '<p class="md-note">Przykładowy artykuł w makiecie. Pełne wpisy pojawią się na blogu po wdrożeniu.</p>');
    md.addEventListener("click", function (e) {
      if (e.target === md || e.target.closest(".ovl-close")) { closeOverlay(md); md = null; }
    });
    md.querySelector(".ovl-close").focus();
  }

  document.addEventListener("click", function (e) {
    var a = e.target.closest("a[data-lb]");
    if (a) { e.preventDefault(); openLb(a); return; }
    var m = e.target.closest("[data-modal]");
    if (m) { e.preventDefault(); openModal(m); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (lb) { closeOverlay(lb); lb = null; } else if (md) { closeOverlay(md); md = null; }
    }
    if (lb && e.key === "ArrowLeft") show(idx - 1);
    if (lb && e.key === "ArrowRight") show(idx + 1);
  });
})();
