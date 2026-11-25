// Expedição — histórico de lançamentos: um registro por dia (finalizado ou ainda aberto), com o detalhe de cada operador.
import { db } from '../app.js';
import { h, num, toast, rpc, msgErro, modal, baixarCSV, data as fData, dataHora } from '../util.js';
import { somaDias } from '../matriz.js';
import { hojeSP, mapa, prodSeg, carregando, caixaErro } from '../exp.js';

export async function render(el, _preset, ativa) {
  const hoje = hojeSP();
  let de = somaDias(hoje, -30), ate = hoje, cfg = null, lista = [];
  el.innerHTML = `
    <div class="cab">
      <div><h1>Histórico</h1><p>Tudo o que foi lançado, dia a dia. Clique num dia para ver o detalhe de cada operador.</p></div>
    </div>
    <div class="card filtros">
      <label class="campo">De<input type="date" id="h-de" value="${de}"></label>
      <label class="campo">Até<input type="date" id="h-ate" value="${ate}"></label>
      <div class="acoes"><button class="btn" id="h-csv">⬇️ Exportar CSV</button></div>
    </div>
    <div id="res">${carregando}</div>`;
  const res = el.querySelector('#res');
  el.querySelector('#h-de').onchange = (e) => { if (e.target.value) { de = e.target.value; carregar(); } };
  el.querySelector('#h-ate').onchange = (e) => { if (e.target.value) { ate = e.target.value; carregar(); } };
  el.querySelector('#h-csv').onclick = exportar;

  async function carregar() {
    try { [cfg, lista] = await Promise.all([rpc(db, 'noite_encanto_exp_config'), rpc(db, 'noite_encanto_exp_historico', { p_de: de, p_ate: ate })]); }
    catch (e) { if (ativa()) res.innerHTML = caixaErro(msgErro(e)); return; }
    if (ativa()) desenhar();
  }

  function desenhar() {
    const M = mapa(cfg);
    const ops = cfg.operadores.filter(o => o.ativo || lista.some(d => d.operadores.some(x => x.operador_id === o.id)));
    if (!lista.length) { res.innerHTML = '<div class="card vazio">Nenhum lançamento neste período.</div>'; return; }
    const abertos = lista.filter(d => !d.finalizado_em && d.data < hoje).length;
    res.innerHTML = `
      ${abertos ? `<div class="aviso-box">${abertos} dia(s) anteriores ainda não foram finalizados. Abra o dia e use “Finalizar o dia” no final da tela “Cronograma do dia”.</div>` : ''}
      <div class="tabela-wrap"><table class="exp-hist"><thead><tr><th>Data</th><th>Situação</th>
        ${ops.map(o => `<th class="n">${h(o.nome)}</th>`).join('')}<th>Cronograma</th></tr></thead>
      <tbody>${lista.map(d => `<tr data-dia="${h(d.data)}">
        <td class="forte">${h(fData(d.data))}</td>
        <td>${d.finalizado_em ? `<span class="chip ok">finalizado</span> <span class="muted peq">${h(dataHora(d.finalizado_em))}</span>`
              : d.data === hoje ? '<span class="chip info">em andamento</span>' : '<span class="chip alerta">não finalizado</span>'}</td>
        ${ops.map(o => { const x = d.operadores.find(y => y.operador_id === o.id); const meta = M.op[o.id]?.meta_pct || 0;
          return `<td class="n">${x && x.pct != null ? `<b class="${x.pct >= meta ? '' : 'txt-erro'}">${x.pct}%</b> <span class="muted peq">${x.realizadas} feitas${x.pendentes ? ` · ${x.pendentes} pend.` : ''}</span>` : '<span class="muted">–</span>'}</td>`; }).join('')}
        <td class="peq">${d.alteracao === 'mantida' ? 'alterado (mantido)' : d.alteracao === 'desfeita' ? 'alterado só no dia' : '<span class="muted">padrão</span>'}</td>
      </tr>`).join('')}</tbody></table></div>
      <p class="muted peq">% em vermelho = abaixo da meta do operador.</p>`;
  }

  res.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-dia]'); if (tr) detalhe(tr.dataset.dia); });

  async function detalhe(d) {
    const fechar = modal({ titulo: `Lançamentos de ${fData(d)}`, largo: true, corpo: carregando });
    let dia;
    try { dia = await rpc(db, 'noite_encanto_exp_dia', { p_data: d }); }
    catch (e) { const c = document.querySelector('.modal-corpo'); if (c) c.innerHTML = caixaErro(msgErro(e)); return; }
    const c = document.querySelector('.modal-corpo'); if (!c) return;
    const M = mapa(cfg);
    const ops = cfg.operadores.filter(o => dia.lancamentos.some(l => l.operador_id === o.id) || dia.pausas.some(p => p.operador_id === o.id));
    c.innerHTML = `
      ${dia.finalizado ? `<p class="ok-box">Finalizado por ${h(dia.finalizado.por || '')} em ${h(dataHora(dia.finalizado.em))}.</p>` : '<p class="aviso-box">Dia ainda não finalizado.</p>'}
      ${ops.map(o => `<h3 style="margin-top:14px">${h(o.nome)}</h3>
        <div class="tabela-wrap"><table><thead><tr><th>Horário</th><th>Atividade</th><th>Situação</th><th class="n">Quantidade</th><th class="n">Tempo real</th><th class="n">Produzido</th></tr></thead><tbody>
        ${dia.lancamentos.filter(l => l.operador_id === o.id).map(l => { const a = M.atv[l.atividade_id];
          return `<tr><td>${h(l.hora)}</td><td>${h(a?.nome || '')}</td>
            <td>${l.status === 'ok' ? '<span class="chip ok">realizada</span>' : l.status === 'pend' ? '<span class="chip erro">pendente</span>' : '<span class="muted">–</span>'}</td>
            <td class="n">${l.tipo === 'qtd' ? num(l.quantidade) + ' ' + h(a?.unidade || '') : ''}</td>
            <td class="n">${l.tempo_real_min != null ? l.tempo_real_min + ' min' : ''}</td>
            <td class="n">${num(Math.round(prodSeg(l) / 60))} min</td></tr>`; }).join('') || '<tr><td colspan="6" class="muted">Sem lançamentos.</td></tr>'}
        ${dia.pausas.filter(p => p.operador_id === o.id).map(p => `<tr><td>${h(p.hora)}</td><td colspan="4"><span class="chip alerta">pausa</span> ${h(p.motivo)}</td><td class="n">${p.minutos} min</td></tr>`).join('')}
        </tbody></table></div>`).join('') || '<div class="vazio">Sem lançamentos neste dia.</div>'}`;
    void fechar;
  }

  async function exportar() {
    const bt = el.querySelector('#h-csv'); bt.disabled = true;
    try {
      const M = mapa(cfg), linhas = [];
      for (const d of lista) {
        const dia = await rpc(db, 'noite_encanto_exp_dia', { p_data: d.data });
        dia.lancamentos.forEach(l => linhas.push({ data: fData(d.data), situacao: d.finalizado_em ? 'finalizado' : 'aberto', operador: M.op[l.operador_id]?.nome || '',
          hora: l.hora, atividade: M.atv[l.atividade_id]?.nome || '', status: l.status === 'ok' ? 'realizada' : l.status === 'pend' ? 'pendente' : '',
          quantidade: l.tipo === 'qtd' ? l.quantidade : '', unidade: l.tipo === 'qtd' ? (M.atv[l.atividade_id]?.unidade || '') : '',
          tempo_real: l.tempo_real_min ?? '', tempo_padrao_seg: l.tempo_padrao_seg, produzido_min: Math.round(prodSeg(l) / 6) / 10, pausa: '', pausa_min: '' }));
        dia.pausas.forEach(p => linhas.push({ data: fData(d.data), situacao: d.finalizado_em ? 'finalizado' : 'aberto', operador: M.op[p.operador_id]?.nome || '',
          hora: p.hora, atividade: '', status: '', quantidade: '', unidade: '', tempo_real: '', tempo_padrao_seg: '', produzido_min: '', pausa: p.motivo, pausa_min: p.minutos }));
      }
      const col = (campo, titulo) => ({ campo, titulo });
      baixarCSV(`expedicao_${de}_a_${ate}.csv`, [col('data', 'Data'), col('situacao', 'Situação'), col('operador', 'Operador'), col('hora', 'Horário'),
        col('atividade', 'Atividade'), col('status', 'Situação da tarefa'), col('quantidade', 'Quantidade'), col('unidade', 'Unidade'),
        col('tempo_real', 'Tempo real (min)'), col('tempo_padrao_seg', 'Tempo padrão (s)'), col('produzido_min', 'Produzido (min)'),
        col('pausa', 'Pausa / intercorrência'), col('pausa_min', 'Pausa (min)')], linhas);
    } catch (e) { toast(msgErro(e), 'erro'); }
    bt.disabled = false;
  }

  await carregar();
}
