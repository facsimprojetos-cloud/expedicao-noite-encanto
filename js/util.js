// Utilidades compartilhadas
export const h = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const num = (n, d = 0) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
export const moeda = (n) => (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const moedaCurta = (n) => {
  const v = Number(n) || 0, a = Math.abs(v);
  if (a >= 1e6) return 'R$ ' + num(v / 1e6, 2) + ' mi';
  if (a >= 1e4) return 'R$ ' + num(v / 1e3, 1) + ' mil';
  return moeda(v);
};

export function data(d) {
  if (!d) return '';
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(d);
}
export function dataHora(d) {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}
export const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export function mesAno(d) {
  const m = String(d || '').match(/^(\d{4})-(\d{2})/);
  return m ? `${MESES[+m[2] - 1]}/${m[1].slice(2)}` : '';
}

export function toast(msg, tipo = '') {
  const raiz = document.getElementById('toast-raiz');
  const t = document.createElement('div');
  t.className = 'toast ' + tipo; t.textContent = msg;
  raiz.appendChild(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 7000 : 3500);
}

export function chip(texto, tipo = '') { return `<span class="chip ${tipo}">${h(texto)}</span>`; }

export const SITUACOES = {
  a_entregar: { nome: 'A entregar', tipo: 'info' },
  atrasado:   { nome: 'Entrega atrasada', tipo: 'erro' },
  a_receber:  { nome: 'A receber', tipo: 'alerta' },
  vencido:    { nome: 'Vencido', tipo: 'erro' },
  recebido:   { nome: 'Recebido', tipo: 'ok' },
  zerado:     { nome: 'Zerado', tipo: '' },
};
export const chipSituacao = (s) => { const x = SITUACOES[s] || { nome: s, tipo: '' }; return chip(x.nome, x.tipo); };

export function msgErro(e) {
  const m = (e && (e.message || e.details || e.hint)) || String(e);
  if (/JWT expired/i.test(m)) return 'Sua sessão expirou. Recarregue a página e entre novamente.';
  if (/Acesso não liberado/i.test(m)) return 'Seu acesso ainda não foi liberado. Fale com o administrador.';
  if (/permission denied/i.test(m)) return 'Você não tem permissão para esta consulta.';
  if (/schema cache|Could not find the function/i.test(m)) return 'O site foi atualizado. Recarregue a página (Ctrl+F5) para usar a versão nova.';
  return m;
}

// Chama uma função do banco; lança erro com mensagem amigável
export async function rpc(db, fn, params) {
  const { data, error } = await db.rpc(fn, params);
  if (error) throw new Error(msgErro(error));
  return data;
}

// ---------- Modal ----------
export function modal({ titulo, corpo, largo = false }) {
  const raiz = document.getElementById('modal-raiz');
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo';
  fundo.innerHTML = `<div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true">
    <div class="modal-cab"><h2>${h(titulo)}</h2><button type="button" data-fechar aria-label="Fechar">×</button></div>
    <div class="modal-corpo">${corpo}</div></div>`;
  const fechar = () => { fundo.remove(); document.removeEventListener('keydown', esc); };
  const esc = (e) => { if (e.key === 'Escape') fechar(); };
  document.addEventListener('keydown', esc);
  fundo.querySelector('[data-fechar]').onclick = fechar;
  fundo.addEventListener('mousedown', (e) => { if (e.target === fundo) fechar(); });
  raiz.appendChild(fundo);
  return fechar;
}

// ---------- CSV (abre certinho no Excel em português) ----------
export function baixarCSV(nome, colunas, linhas) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    const s = String(v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const txt = [colunas.map(c => c.titulo).join(';')]
    .concat(linhas.map(l => colunas.map(c => esc(c.valor ? c.valor(l) : l[c.campo])).join(';'))).join('\r\n');
  const blob = new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
