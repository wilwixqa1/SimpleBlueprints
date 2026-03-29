/**
 * SimpleBlueprints - Event Tracking (S55)
 * Fire-and-forget event tracking with batch queue.
 *
 * Usage:
 *   window._trackEvent('survey_upload', { file_type: 'pdf', file_size: 1234 })
 *   window._trackEvent('step_change', { from_step: 0, to_step: 1, duration_on_prev_step_ms: 45000 })
 *
 * Identity:
 *   anonymous_id: persists in localStorage, bridges pre-login events
 *   session_id: generated per page load (tab close = new session)
 *   user_id: set server-side from auth cookie
 */

(function() {
  'use strict';

  // --- Identity ---
  var ANON_KEY = 'sb_anon_id';
  var anonymousId = localStorage.getItem(ANON_KEY);
  if (!anonymousId) {
    anonymousId = 'anon_' + crypto.randomUUID();
    localStorage.setItem(ANON_KEY, anonymousId);
  }

  var sessionId = 'sess_' + crypto.randomUUID();

  // Expose for AI helper to pass to backend
  window._sbAnonymousId = anonymousId;
  window._sbSessionId = sessionId;

  // --- Event queue ---
  var queue = [];
  var flushTimer = null;
  var FLUSH_INTERVAL_MS = 5000;
  var MAX_QUEUE_SIZE = 20;

  function getStep() {
    // Try to read current step from app state
    if (typeof window.p !== 'undefined' && window.p && typeof window.p.currentStep === 'number') {
      return window.p.currentStep;
    }
    // Fallback: try to detect from URL or DOM
    return null;
  }

  function getGuidePhase() {
    if (typeof window._currentGuidePhase === 'string') {
      return window._currentGuidePhase;
    }
    return null;
  }

  /**
   * Track a single event. Fire-and-forget.
   * @param {string} eventType - e.g. 'survey_upload', 'step_change'
   * @param {object} eventData - arbitrary JSON payload
   */
  function trackEvent(eventType, eventData) {
    var evt = {
      anonymous_id: anonymousId,
      session_id: sessionId,
      event_type: eventType,
      event_data: eventData || {},
      step: getStep(),
      guide_phase: getGuidePhase(),
      ts: Date.now()
    };

    queue.push(evt);

    // Flush immediately for critical events
    var immediate = ['checkout_start', 'checkout_complete', 'pdf_generate_complete', 'pdf_generate_error'];
    if (immediate.indexOf(eventType) >= 0 || queue.length >= MAX_QUEUE_SIZE) {
      flushQueue();
    } else if (!flushTimer) {
      flushTimer = setTimeout(flushQueue, FLUSH_INTERVAL_MS);
    }
  }

  function flushQueue() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (queue.length === 0) return;

    var batch = queue.splice(0);

    if (batch.length === 1) {
      // Single event: use simple endpoint
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(batch[0]),
        keepalive: true
      }).catch(function() {});
    } else {
      // Batch
      fetch('/api/track-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true
      }).catch(function() {});
    }
  }

  /**
   * Link anonymous events to authenticated user (call after login).
   */
  function linkToUser() {
    fetch('/api/track-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonymous_id: anonymousId }),
      keepalive: true
    }).catch(function() {});
  }

  // Flush on page unload
  window.addEventListener('beforeunload', function() {
    flushQueue();
  });

  // Flush on visibility change (tab switch on mobile)
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
      flushQueue();
    }
  });

  // --- Expose globally ---
  window._trackEvent = trackEvent;
  window._linkTrackingToUser = linkToUser;
  window._flushTracking = flushQueue;

  // --- Auto-track session start ---
  var startData = {};
  try {
    var sp = new URLSearchParams(window.location.search);
    if (sp.get('utm_source')) startData.utm_source = sp.get('utm_source');
    if (sp.get('utm_medium')) startData.utm_medium = sp.get('utm_medium');
    if (sp.get('utm_campaign')) startData.utm_campaign = sp.get('utm_campaign');
    if (document.referrer) startData.referrer = document.referrer.substring(0, 200);
  } catch(e) {}
  trackEvent('session_start', startData);

})();
