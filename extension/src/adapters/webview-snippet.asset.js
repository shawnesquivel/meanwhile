/*<<MEANWHILE_SNIPPET>>*/
/**
 * Meanwhile webview runtime — appended to Claude Code's webview/index.js by
 * the Meanwhile extension. The spinner already shows sponsor lines via the
 * spinnerVerbs setting; this runtime adds what plain verbs can't:
 *   - impression + viewable-threshold metrics for the line on screen
 *   - click-through (delegated to the extension via the local loopback)
 *   - hover affordance on the spinner text
 *
 * Placeholders (__MW_PORT__ / __MW_TOKEN__ / __MW_TEXT_CLASS__) are
 * substituted at patch time. Everything is wrapped and best-effort: any
 * failure leaves Claude Code exactly as stock.
 */
(function () {
  "use strict";
  try {
    var PORT = "__MW_PORT__";
    var TOKEN = "__MW_TOKEN__";
    var TEXT_CLASS = "__MW_TEXT_CLASS__"; // spinner text class, e.g. text_hc5dvw
    var BASE = "http://127.0.0.1:" + PORT;
    var SURFACE = "cc_webview";
    var POLL_MS = 60000;
    var TICK_MS = 1000;

    var sponsors = []; // [{sponsorId, campaignId, text, brand, clickUrl, sessionToken, label}]
    var viewThresholdMs = 3000;
    var seen = {}; // sponsorId -> { visibleMs, impressionSent, thresholdSent }
    var lastLabel = null;

    function label(s) {
      var t = s.brand ? s.text + " \u2014 " + s.brand : s.text;
      return t.slice(0, 60);
    }

    function send(path, body) {
      try {
        fetch(BASE + path + "?t=" + TOKEN, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }).catch(function () {});
      } catch (e) {
        /* ignore */
      }
    }

    function metric(event, s, visibleMs) {
      send("/v1/metrics", {
        event: event,
        sponsorId: s.sponsorId,
        campaignId: s.campaignId,
        surface: SURFACE,
        sessionToken: s.sessionToken,
        visibleMs: visibleMs,
      });
    }

    function refreshSponsors() {
      try {
        fetch(BASE + "/v1/sponsors?t=" + TOKEN)
          .then(function (r) {
            return r.ok ? r.json() : null;
          })
          .then(function (j) {
            if (!j || !j.sponsors) return;
            viewThresholdMs = j.viewThresholdMs || 3000;
            sponsors = j.sponsors.map(function (s) {
              s.label = label(s);
              return s;
            });
          })
          .catch(function () {});
      } catch (e) {
        /* ignore */
      }
    }

    function findSponsorByText(text) {
      if (!text) return null;
      for (var i = 0; i < sponsors.length; i++) {
        if (text.indexOf(sponsors[i].label) === 0) return sponsors[i];
      }
      return null;
    }

    function visibleSpinnerText() {
      var els = document.getElementsByClassName(TEXT_CLASS);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el && el.offsetParent !== null && el.textContent) {
          return el.textContent;
        }
      }
      return null;
    }

    function tick() {
      var text = visibleSpinnerText();
      var s = findSponsorByText(text || "");
      var l = s ? s.label : null;
      if (l !== lastLabel) {
        // New appearance: reset that sponsor's accumulation window.
        if (s && seen[s.sponsorId]) {
          seen[s.sponsorId].visibleMs = 0;
          seen[s.sponsorId].thresholdSent = false;
        }
        lastLabel = l;
      }
      if (!s) return;
      var st = seen[s.sponsorId] || (seen[s.sponsorId] = {
        visibleMs: 0,
        impressionSent: false,
        thresholdSent: false,
      });
      if (!st.impressionSent) {
        st.impressionSent = true;
        metric("impression", s, 0);
      }
      st.visibleMs += TICK_MS;
      if (!st.thresholdSent && st.visibleMs >= viewThresholdMs) {
        st.thresholdSent = true;
        metric("view_threshold_met", s, st.visibleMs);
      }
    }

    document.addEventListener(
      "click",
      function (ev) {
        try {
          var t = ev.target;
          if (!t || !t.closest) return;
          var el = t.closest("." + TEXT_CLASS);
          if (!el) return;
          var s = findSponsorByText(el.textContent || "");
          if (!s) return;
          send("/v1/click", {
            event: "click",
            sponsorId: s.sponsorId,
            campaignId: s.campaignId,
            surface: SURFACE,
            sessionToken: s.sessionToken,
            clickUrl: s.clickUrl,
            visibleMs: (seen[s.sponsorId] || { visibleMs: 0 }).visibleMs,
          });
        } catch (e) {
          /* ignore */
        }
      },
      true,
    );

    try {
      var style = document.createElement("style");
      style.textContent =
        "." + TEXT_CLASS + ":hover{cursor:pointer;text-decoration:underline;}";
      (document.head || document.documentElement).appendChild(style);
    } catch (e) {
      /* ignore */
    }

    refreshSponsors();
    setInterval(refreshSponsors, POLL_MS);
    setInterval(tick, TICK_MS);
  } catch (e) {
    /* never break the webview */
  }
})();
/*<</MEANWHILE_SNIPPET>>*/
