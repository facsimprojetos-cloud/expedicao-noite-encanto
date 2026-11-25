// Tabela matricial: colunas fixas à esquerda, uma coluna por item (produto, semana...), linhas de total
// no topo (fixas ao rolar) e cabeçalho fixo.
import { h } from './util.js';

const ALT_CAB = 42, ALT_TOT = 31;

// fixas: [{ titulo, largura, html(linha), classe }]   colunas: [chave]   valor(linha, chave) -> número
// fmt(n) formata uma célula; totalFixas: html das células fixas na linha de total
// extras: linhas adicionais no topo [{ fixas: [html...], valor: (chave, i) => número, classe }]
// titulo(chave) -> html do cabeçalho; aoClicar(linha) torna as linhas clicáveis
export function tabelaMatriz({ fixas, colunas, linhas, valor, fmt, totalFixas, extras = [], titulo, classeColuna, classeLinha, aoClicar, id = 'mtz' }) {
  let esq = 0;
  const pos = fixas.map(f => { const p = esq; esq += f.largura; return p; });
  const fixa = (i, extra = '') => `class="fixa ${i === fixas.length - 1 ? 'ultima' : ''} ${extra}" style="left:${pos[i]}px;min-width:${fixas[i].largura}px;max-width:${fixas[i].largura}px"`;
  const cc = (c) => classeColuna ? classeColuna(c) : '';

  const totCol = colunas.map(c => linhas.reduce((s, l) => s + (Number(valor(l, c)) || 0), 0));
  const topo = (i) => `style="top:${ALT_CAB + ALT_TOT * i}px"`;

  const cab = `<tr>${fixas.map((f, i) => `<th ${fixa(i)}>${h(f.titulo)}</th>`).join('')}
    ${colunas.map(c => `<th class="n prod ${cc(c)}" title="${h(c)}"><span>${titulo ? titulo(c) : h(c)}</span></th>`).join('')}</tr>`;
  const tot = `<tr class="total">${fixas.map((f, i) => `<td ${fixa(i, f.classe || '')} ${topo(0)}>${totalFixas[i] ?? ''}</td>`).join('')}
    ${totCol.map((v, i) => `<td class="n ${cc(colunas[i])}" ${topo(0)}>${v ? fmt(v) : ''}</td>`).join('')}</tr>`;
  const ext = extras.map((x, k) => `<tr class="total ${x.classe || ''}">${fixas.map((f, i) => `<td ${fixa(i, f.classe || '')} ${topo(k + 1)}>${x.fixas[i] ?? ''}</td>`).join('')}
    ${colunas.map((c, i) => { const v = x.valor(c, i); return `<td class="n ${cc(c)}" ${topo(k + 1)}>${v ? fmt(v) : ''}</td>`; }).join('')}</tr>`).join('');
  const corpo = linhas.map((l, li) => `<tr class="${classeLinha ? classeLinha(l) : ''} ${aoClicar ? 'clicavel' : ''}" data-i="${li}">
      ${fixas.map((f, i) => `<td ${fixa(i, f.classe || '')}>${f.html(l)}</td>`).join('')}
      ${colunas.map(c => { const v = Number(valor(l, c)) || 0; return `<td class="n ${cc(c)}">${v ? fmt(v) : ''}</td>`; }).join('')}
    </tr>`).join('');

  if (aoClicar) setTimeout(() => {
    const t = document.getElementById(id);
    if (t) t.querySelector('tbody').onclick = (e) => { const tr = e.target.closest('tr[data-i]'); if (tr) aoClicar(linhas[+tr.dataset.i]); };
  });

  return `<div class="matriz-wrap"><table class="matriz" id="${id}">
      <thead>${cab}${tot}${ext}</thead>
      <tbody>${corpo || `<tr><td class="vazio" colspan="${fixas.length + colunas.length}">Nada encontrado com esses filtros.</td></tr>`}</tbody>
    </table></div>`;
}

// Colunas com algum valor nas linhas visíveis
export function colunasComValor(colunas, linhas, valor) {
  return colunas.filter(c => linhas.some(l => Number(valor(l, c))));
}

export const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const ordenarTexto = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { sensitivity: 'base' });

// Opções de uma lista suspensa, mantendo a escolha atual
export function opcoes(lista, atual, rotuloTodos = 'Todos') {
  return `<option value="">${h(rotuloTodos)}</option>` +
    lista.map(v => `<option value="${h(v)}" ${v === atual ? 'selected' : ''}>${h(v)}</option>`).join('');
}

// Datas sem fuso: 'aaaa-mm-dd' <-> Date UTC
export const dt = (s) => new Date(s + 'T00:00:00Z');
export const iso = (d) => d.toISOString().slice(0, 10);
export const somaDias = (s, n) => { const d = dt(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const ddmm = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
