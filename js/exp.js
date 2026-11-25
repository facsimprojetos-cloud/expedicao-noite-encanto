// Expedição — utilidades compartilhadas pelas telas do cronograma de capacidade produtiva.
// Regra (igual à da função noite_encanto_exp_resumo no banco):
//   produzido = quantidade × tempo padrão (atividades por quantidade) ou o tempo padrão (tempo fixo, se realizada)
//   disponível = soma das janelas dos horários trabalhados − pausas desses horários
//   % produtivo = produzido ÷ disponível
import { h } from './util.js';

export const MOTIVOS = ['Falta de material', 'Equipamento com defeito', 'Aguardando lote/mercadoria', 'Apoio a outro setor',
  'Pausa pessoal / banheiro', 'Reunião / orientação', 'Outro'];

export const hojeSP = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });

export function hhmm(v) {
  const r = /^(\d{1,2})[:h.]?(\d{2})$/.exec(String(v || '').trim());
  if (!r) return '';
  const a = +r[1], b = +r[2];
  return a < 24 && b < 60 ? String(a).padStart(2, '0') + ':' + r[2] : '';
}

export function mapa(cfg) {
  return {
    atv: Object.fromEntries(cfg.atividades.map(a => [a.id, a])),
    op: Object.fromEntries(cfg.operadores.map(o => [o.id, o])),
  };
}

const singular = (u) => String(u || '').replace(/s$/, '');
const minTxt = (s) => (s / 60).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' min';
export const padrao = (a) => a.tipo === 'qtd'
  ? (a.tempo_padrao_seg >= 60 ? minTxt(a.tempo_padrao_seg) : a.tempo_padrao_seg + ' s') + ' por ' + singular(a.unidade)
  : 'Tempo padrão ' + minTxt(a.tempo_padrao_seg);

export const prodSeg = (l) => l.tipo === 'qtd' ? (l.quantidade || 0) * l.tempo_padrao_seg : (l.status === 'ok' ? l.tempo_padrao_seg : 0);

export function calcDia(dia, opId) {
  const L = dia.lancamentos.filter(l => l.operador_id === opId);
  const P = dia.pausas.filter(p => p.operador_id === opId);
  const pmH = {};
  P.forEach(p => { pmH[p.hora] = (pmH[p.hora] || 0) + p.minutos; });
  const H = {};
  L.forEach(l => {
    const b = H[l.hora] || (H[l.hora] = { jan: 0, prod: 0 });
    b.jan = Math.max(b.jan, l.janela_min); b.prod += prodSeg(l);
  });
  let prod = 0, disp = 0;
  Object.entries(H).forEach(([k, b]) => {
    b.pm = pmH[k] || 0; b.disp = Math.max(0, b.jan - b.pm);
    b.pct = b.disp ? Math.round(b.prod / 60 / b.disp * 100) : null;
    prod += b.prod; disp += b.disp;
  });
  return {
    L, P, porHora: H,
    pct: disp ? Math.round(prod / 60 / disp * 100) : 0,
    prodMin: Math.round(prod / 60), dispMin: disp,
    ok: L.filter(l => l.status === 'ok').length, pend: L.filter(l => l.status === 'pend').length,
    pausaMin: P.reduce((s, p) => s + p.minutos, 0),
  };
}

// totais por unidade (peças, lotes, fardos…)
export function quantidades(L, atv) {
  const q = {};
  L.forEach(l => { const a = atv[l.atividade_id]; if (l.tipo === 'qtd' && l.quantidade) { const u = a?.unidade || 'unidades'; q[u] = (q[u] || 0) + l.quantidade; } });
  return q;
}

export const medidor = (pct, meta, max = 120) => `<div class="exp-gauge">
  <b class="${pct >= meta ? 'bate' : ''}" style="width:${Math.min(100, pct / max * 100)}%"></b>
  <u style="left:${Math.min(100, meta / max * 100)}%"><span>meta ${meta}%</span></u></div>`;

export const CORES = ['var(--pri)', '#a78bfa', '#0891b2', '#d97706', '#db2777', '#059669'];

export const carregando = '<div class="vazio"><div class="spinner" style="margin:auto"></div></div>';
export const caixaErro = (m) => `<div class="card erro-box">${h(m)}</div>`;
