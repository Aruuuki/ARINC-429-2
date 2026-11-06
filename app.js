"use strict";

const STORAGE_KEY = "arinc-lab-state-v1";
const DATA_MAX = (1 << 19) - 1;
const $ = (selector) => document.querySelector(selector);

const elements = {
  notice: $("#notice"),
  instrumentForm: $("#instrument-form"),
  instrumentId: $("#instrument-id"),
  instrumentName: $("#instrument-name"),
  instrumentMin: $("#instrument-min"),
  instrumentMax: $("#instrument-max"),
  instrumentLabel: $("#instrument-label"),
  instrumentSdi: $("#instrument-sdi"),
  instrumentSubmit: $("#instrument-submit"),
  instrumentCancel: $("#instrument-cancel"),
  instrumentList: $("#instrument-list"),
  instrumentEmpty: $("#instrument-empty"),
  instrumentCount: $("#instrument-count"),
  sendForm: $("#send-form"),
  sendInstrument: $("#send-instrument"),
  sendValue: $("#send-value"),
  sendId: $("#send-id"),
  rangeHint: $("#range-hint"),
  sendRange: $("#send-range"),
  sendSubmit: $("#send-submit"),
  sendCancel: $("#send-cancel"),
  wordResult: $("#word-result"),
  resultInstrument: $("#result-instrument"),
  resultHex: $("#result-hex"),
  resultBits: $("#result-bits"),
  resultFields: $("#result-fields"),
  sendList: $("#send-list"),
  sendEmpty: $("#send-empty"),
  clearHistory: $("#clear-history"),
};

let state = loadState();
let noticeTimer;

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return { instruments: [], sends: [] };
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.instruments) || !Array.isArray(parsed.sends)) {
      throw new Error("Los datos guardados no tienen el formato esperado.");
    }
    return parsed;
  } catch (error) {
    window.addEventListener("DOMContentLoaded", () => {
      showNotice(`No se pudieron cargar los datos guardados: ${error.message}`, false);
    }, { once: true });
    return { instruments: [], sends: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    showNotice(`No se pudieron guardar los cambios: ${error.message}`, false);
    return false;
  }
}

function showNotice(message, success) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("success", success);
  elements.notice.hidden = false;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => { elements.notice.hidden = true; }, 5000);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function formatNumber(value) {
  return new Intl.NumberFormat("es", { maximumFractionDigits: 6 }).format(value);
}

function reverseByte(value) {
  let reversed = 0;
  for (let bit = 0; bit < 8; bit += 1) {
    reversed = (reversed << 1) | ((value >> bit) & 1);
  }
  return reversed;
}

function countBits(value) {
  let count = 0;
  while (value > 0) {
    count += value & 1;
    value >>>= 1;
  }
  return count;
}

function buildWord(instrument, value) {
  const label = Number.parseInt(instrument.label, 8);
  const scaledData = Math.round(((value - instrument.min) / (instrument.max - instrument.min)) * DATA_MAX);
  const sdi = Number(instrument.sdi);
  const ssm = 0;
  let word = BigInt(reverseByte(label))
    | (BigInt(sdi) << 8n)
    | (BigInt(scaledData) << 10n)
    | (BigInt(ssm) << 29n);
  const parity = countBits(Number(word & 0x7fffffffn)) % 2 === 0 ? 1 : 0;
  word |= BigInt(parity) << 31n;
  return {
    hex: word.toString(16).toUpperCase().padStart(8, "0"),
    bits: word.toString(2).padStart(32, "0"),
    fields: {
      label: `${instrument.label}₈`,
      sdi: sdi.toString(2).padStart(2, "0"),
      data: scaledData.toString(2).padStart(19, "0"),
      ssm: ssm.toString(2).padStart(2, "0"),
      parity: String(parity),
    },
  };
}

function renderInstruments() {
  elements.instrumentCount.textContent = String(state.instruments.length);
  elements.instrumentEmpty.hidden = state.instruments.length > 0;
  elements.instrumentList.innerHTML = state.instruments.map((instrument) => `
    <article class="instrument-card">
      <div class="instrument-info">
        <div class="instrument-name">${escapeHtml(instrument.name)}</div>
        <div class="instrument-meta">${formatNumber(instrument.min)} – ${formatNumber(instrument.max)} · Label ${escapeHtml(instrument.label)}₈ · SDI ${Number(instrument.sdi).toString(2).padStart(2, "0")}</div>
      </div>
      <div class="instrument-actions">
        <button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(instrument.id)}" aria-label="Editar ${escapeHtml(instrument.name)}">Editar</button>
        <button class="icon-button delete" type="button" data-action="delete" data-id="${escapeHtml(instrument.id)}" aria-label="Eliminar ${escapeHtml(instrument.name)}">Borrar</button>
      </div>
    </article>
  `).join("");

  const selected = elements.sendInstrument.value;
  elements.sendInstrument.innerHTML = '<option value="">Selecciona un instrumento</option>'
    + state.instruments.map((instrument) => `
      <option value="${escapeHtml(instrument.id)}">${escapeHtml(instrument.name)}</option>
    `).join("");
  if (state.instruments.some((instrument) => instrument.id === selected)) {
    elements.sendInstrument.value = selected;
  }
  updateRangeHint();
}

function renderSends() {
  elements.sendEmpty.hidden = state.sends.length > 0;
  elements.clearHistory.hidden = state.sends.length === 0;
  elements.sendList.innerHTML = state.sends.slice().reverse().map((send) => `
    <div class="send-entry">
      <div class="send-entry-main">
        <div class="send-entry-title">${escapeHtml(send.instrumentName)} · ${formatNumber(send.value)}</div>
        <div class="send-entry-meta">${escapeHtml(send.createdAt)} · dentro del rango</div>
      </div>
      <code class="send-entry-code">${escapeHtml(send.hex)}</code>
      <div class="send-entry-actions">
        <button class="icon-button" type="button" data-action="edit" data-id="${escapeHtml(send.id)}" ${state.instruments.some((instrument) => instrument.id === send.instrumentId) ? "" : "disabled"}>Editar</button>
        <button class="icon-button delete" type="button" data-action="delete" data-id="${escapeHtml(send.id)}">Borrar</button>
      </div>
    </div>
  `).join("");
}

function render() {
  renderInstruments();
  renderSends();
}

function updateRangeHint() {
  const instrument = state.instruments.find((item) => item.id === elements.sendInstrument.value);
  if (!instrument) {
    elements.rangeHint.textContent = "—";
    elements.sendRange.textContent = "El valor debe estar dentro del rango configurado.";
    elements.sendValue.removeAttribute("min");
    elements.sendValue.removeAttribute("max");
    return;
  }
  elements.rangeHint.textContent = `${formatNumber(instrument.min)} – ${formatNumber(instrument.max)}`;
  elements.sendRange.textContent = `Rango permitido: ${formatNumber(instrument.min)} a ${formatNumber(instrument.max)}.`;
  elements.sendValue.min = String(instrument.min);
  elements.sendValue.max = String(instrument.max);
}

function resetSendForm() {
  elements.sendForm.reset();
  elements.sendId.value = "";
  elements.sendSubmit.innerHTML = 'Generar palabra ARINC 429 <span aria-hidden="true">→</span>';
  elements.sendCancel.hidden = true;
  updateRangeHint();
}

function resetInstrumentForm() {
  elements.instrumentForm.reset();
  elements.instrumentId.value = "";
  elements.instrumentSubmit.textContent = "Agregar instrumento";
  elements.instrumentCancel.hidden = true;
}

elements.instrumentForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.instrumentName.value.trim();
  const min = Number(elements.instrumentMin.value);
  const max = Number(elements.instrumentMax.value);
  const label = elements.instrumentLabel.value.trim();
  const sdi = Number(elements.instrumentSdi.value);

  if (!name || !Number.isFinite(min) || !Number.isFinite(max) || !Number.isFinite(max - min) || min >= max) {
    showNotice("Ingresa un nombre y un rango válido: el mínimo debe ser menor que el máximo.", false);
    return;
  }
  if (!/^[0-7]{1,3}$/.test(label) || Number.parseInt(label, 8) > 0o377) {
    showNotice("El label debe ser un número octal entre 000 y 377.", false);
    return;
  }

  const id = elements.instrumentId.value || crypto.randomUUID();
  const updated = { id, name, min, max, label: label.padStart(3, "0"), sdi };
  const existingIndex = state.instruments.findIndex((instrument) => instrument.id === id);
  const previousInstruments = state.instruments;
  state.instruments = state.instruments.slice();
  if (existingIndex >= 0) state.instruments[existingIndex] = updated;
  else state.instruments.push(updated);

  if (saveState()) {
    resetInstrumentForm();
    render();
    showNotice(existingIndex >= 0 ? "Instrumento actualizado." : "Instrumento agregado.", true);
  } else {
    state.instruments = previousInstruments;
  }
});

elements.instrumentCancel.addEventListener("click", resetInstrumentForm);

elements.instrumentList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const instrument = state.instruments.find((item) => item.id === button.dataset.id);
  if (!instrument) return;

  if (button.dataset.action === "edit") {
    elements.instrumentId.value = instrument.id;
    elements.instrumentName.value = instrument.name;
    elements.instrumentMin.value = String(instrument.min);
    elements.instrumentMax.value = String(instrument.max);
    elements.instrumentLabel.value = instrument.label;
    elements.instrumentSdi.value = String(instrument.sdi);
    elements.instrumentSubmit.textContent = "Guardar cambios";
    elements.instrumentCancel.hidden = false;
    elements.instrumentName.focus();
    return;
  }

  if (button.dataset.action === "delete" && window.confirm(`¿Eliminar el instrumento "${instrument.name}"? El historial de envíos se conservará.`)) {
    const previousInstruments = state.instruments;
    state.instruments = state.instruments.filter((item) => item.id !== instrument.id);
    if (elements.instrumentId.value === instrument.id) resetInstrumentForm();
    if (saveState()) {
      render();
      showNotice("Instrumento eliminado.", true);
    } else {
      state.instruments = previousInstruments;
    }
  }
});

elements.sendInstrument.addEventListener("change", updateRangeHint);

elements.sendForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const instrument = state.instruments.find((item) => item.id === elements.sendInstrument.value);
  const sendId = elements.sendId.value;
  const value = Number(elements.sendValue.value);
  if (!instrument) {
    showNotice("Selecciona un instrumento antes de generar el envío.", false);
    return;
  }
  if (!Number.isFinite(value) || value < instrument.min || value > instrument.max) {
    showNotice(`El valor debe estar entre ${formatNumber(instrument.min)} y ${formatNumber(instrument.max)}.`, false);
    return;
  }

  const word = buildWord(instrument, value);
  const send = {
    id: sendId || crypto.randomUUID(),
    instrumentId: instrument.id,
    instrumentName: instrument.name,
    value,
    hex: word.hex,
    bits: word.bits,
    createdAt: new Intl.DateTimeFormat("es", { dateStyle: "short", timeStyle: "short" }).format(new Date()),
  };
  const previousSends = state.sends;
  state.sends = state.sends.slice();
  const existingIndex = state.sends.findIndex((item) => item.id === sendId);
  if (existingIndex >= 0) state.sends[existingIndex] = send;
  else state.sends.push(send);
  if (!saveState()) {
    state.sends = previousSends;
    return;
  }

  elements.resultInstrument.textContent = `${instrument.name} · valor ${formatNumber(value)}`;
  elements.resultHex.textContent = word.hex;
  elements.resultBits.textContent = word.bits;
  elements.resultFields.innerHTML = [
    ["LABEL", word.fields.label],
    ["SDI · 9–10", word.fields.sdi],
    ["DATO · 11–29", word.fields.data],
    ["SSM · 30–31", word.fields.ssm],
  ].map(([label, fieldValue]) => `
    <div class="result-field"><span>${label}</span><strong>${fieldValue}</strong></div>
  `).join("") + `<div class="result-field"><span>PARIDAD · 32</span><strong>${word.fields.parity}</strong></div>`;
  elements.wordResult.hidden = false;
  resetSendForm();
  renderSends();
  showNotice(existingIndex >= 0 ? "Envío actualizado." : "Palabra ARINC generada y guardada en el historial.", true);
});

elements.sendCancel.addEventListener("click", resetSendForm);

elements.sendList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const send = state.sends.find((item) => item.id === button.dataset.id);
  if (!send) return;

  if (button.dataset.action === "edit") {
    const instrument = state.instruments.find((item) => item.id === send.instrumentId);
    if (!instrument) return;
    elements.sendId.value = send.id;
    elements.sendInstrument.value = instrument.id;
    elements.sendValue.value = String(send.value);
    elements.sendSubmit.textContent = "Guardar cambios del envío";
    elements.sendCancel.hidden = false;
    elements.wordResult.hidden = true;
    updateRangeHint();
    elements.sendValue.focus();
    return;
  }

  if (button.dataset.action === "delete" && window.confirm(`¿Eliminar el envío de "${send.instrumentName}" con valor ${formatNumber(send.value)}?`)) {
    const previousSends = state.sends;
    state.sends = state.sends.filter((item) => item.id !== send.id);
    if (elements.sendId.value === send.id) resetSendForm();
    if (saveState()) {
      renderSends();
      showNotice("Envío eliminado.", true);
    } else {
      state.sends = previousSends;
    }
  }
});

elements.clearHistory.addEventListener("click", () => {
  if (!window.confirm("¿Limpiar todo el historial de envíos?")) return;
  const previous = state.sends;
  state.sends = [];
  if (saveState()) {
    renderSends();
    elements.wordResult.hidden = true;
    resetSendForm();
    showNotice("Historial limpiado.", true);
  } else {
    state.sends = previous;
  }
});

render();
