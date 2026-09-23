/* ==========================================================================
   form-handler.js — Marrakesh Beauty
   Validates and POSTs form data from any <form data-form="sheet"> to a
   Google Sheets web app (Google Apps Script).

   HOW TO CONNECT A SHEET
   ----------------------
   1. Create a Google Sheet with headers matching the field names below
      (e.g. timestamp, page_url, product, full_name, email, ...).
   2. In the sheet: Extensions → Apps Script. Paste:

        function doPost(e) {
          var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
          var data  = JSON.parse(e.postData.contents);
          var row   = ['timestamp' in data ? data.timestamp : new Date()].concat(
            ['page_url','product','unit_price','currency','full_name','email',
             'phone','country','quantity','format','notes'].map(function (k) {
              return data[k] === undefined ? '' : data[k];
            })
          );
          sheet.appendRow(row);
          return ContentService.createTextOutput(
            JSON.stringify({ result: 'success' })
          ).setMimeType(ContentService.MimeType.JSON);
        }

   3. Deploy → New deployment → Web app → "Anyone" → copy the URL.
   4. Paste that URL into SHEETS_URL below.
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   *  CONFIG: paste your Google Apps Script web app URL here.
   *  Leave empty to run the demo in "simulation" mode.
   * ------------------------------------------------------------------ */
  var SHEETS_URL = "";

  /* Which field names to still log even if the Apps Script has no column */
  var EXTRA_FIELDS = ["subject", "message", "notes"];

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /* ------------------------- Small form helpers ------------------------- */

  function setGroupError(input, hasError) {
    var group = input.closest(".form__group");
    if (!group) return;
    group.classList.toggle("has-error", hasError);
    input.classList.toggle("is-error", hasError);
  }

  function validateField(input) {
    var value = input.value.trim();
    var valid = true;

    if (input.required && !value) valid = false;
    if (valid && input.type === "email" && value && !EMAIL_RE.test(value)) valid = false;

    setGroupError(input, !valid);
    return valid;
  }

  function clearFieldError(input) {
    setGroupError(input, false);
  }

  function validateForm(form) {
    var fields = form.querySelectorAll("[required]");
    var firstInvalid = null;

    fields.forEach(function (input) {
      var ok = validateField(input);
      if (!ok && !firstInvalid) firstInvalid = input;
    });

    return firstInvalid;
  }

  /* ------------------------- Status panel ------------------------- */

  function setStatus(form, type, message) {
    var box = form.querySelector(".form__status");
    if (!box) return;

    box.className = "form__status";
    box.classList.add("form__status--" + type, "is-visible");
    box.textContent = message;

    window.MB && window.MB.toast
      ? window.MB.toast(message)
      : null;
  }

  /* ------------------------- Submit → Google Sheets ------------------------- */

  function submitToSheets(form, payload) {
    var button = form.querySelector('button[type="submit"]');
    var original = button ? button.textContent : "";
    if (button) {
      button.disabled = true;
      button.textContent = "Sending…";
    }

    // No sheet configured → simulate a successful send so the demo still works.
    if (!SHEETS_URL) {
      console.info(
        "[form-handler.js] SHEETS_URL is empty — running in simulation mode. " +
          "Set SHEETS_URL to your Google Apps Script web app to send real rows."
      );
      setTimeout(function () {
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
        form.reset();
        setStatus(form, "success", "Merci! Your message is in our inbox. We'll reply within one working day.");
      }, 900);
      return;
    }

    // Real push to Apps Script. `no-cors` is used because the web app
    // redirects the response; the request body is sent as plain text JSON.
    fetch(SHEETS_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
        form.reset();
        setStatus(form, "success", "Order received! We'll email you a payment link within one working day.");
      })
      .catch(function (err) {
        console.error("[form-handler.js] Google Sheets request failed:", err);
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
        setStatus(form, "error", "Sorry — something went wrong sending your details. Please try again or email us directly.");
      });
  }

  /* ------------------------- Build payload ------------------------- */

  function buildPayload(form) {
    var data = {
      timestamp: new Date().toISOString(),
      page_url: window.location.href
    };

    var fd = new FormData(form);
    fd.forEach(function (value, key) {
      if (value === "" || value === null || value === undefined) return;
      if (typeof data[key] === "undefined") data[key] = value;
    });

    // Always include "+ any extra" free-text columns first, even unknown ones.
    EXTRA_FIELDS.forEach(function (key) {
      if (fd.has(key) && fd.get(key) !== "" && !data[key]) {
        data[key] = fd.get(key);
      }
    });

    return data;
  }

  /* ------------------------- Attach to all sheet forms ------------------------- */

  function init() {
    var forms = document.querySelectorAll('[data-form="sheet"]');

    forms.forEach(function (form) {
      // Live error clearing once user edits a field
      form.addEventListener("input", function (e) {
        var target = e.target;
        if (target.matches(".form__input, .form__select, .form__textarea")) {
          clearFieldError(target);
        }
      });

      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var firstInvalid = validateForm(form);
        if (firstInvalid) {
          setStatus(
            form,
            "error",
            "Please complete the highlighted fields before sending."
          );
          firstInvalid.focus();
          return;
        }

        submitToSheets(form, buildPayload(form));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();