// Expedição — cronograma do dia: o operador marca o que fez, a quantidade e as pausas.
// A gerência usa a mesma tela para ver (e corrigir) o dia de qualquer operador e de outras datas.
import { db, ctx } from '../app.js';
import { h, num, toast, rpc, msgErro, data as fData } from '../util.js';
import { MOTIVOS, hojeSP, mapa, padrao, calcDia, carregando, caixaErro } from '../exp.js';

export async function render(el, _preset, ativa) {
  const ger = ctx.exp.perfil === 'gerente';
  let dataSel = hojeSP(), opSel = ger ? null : ctx.exp.operador_id, cfg = null, dia = null, pausaAberta = null;
  let fila = Promise.resolve();

  el.innerHTML = `
    <div class="cab">
      <div><h1>${ger ? 'Cronograma do dia' : 'Meu dia'}</h1><p>${h(ctx.exp.setor_nome)} · marque o que fez, a quantidade e as pausas</p></div>
      <div class="acoes">${ger ? `<input type="date" class="inp" id="exp-data" value="${dataSel}" aria-label="Data" style="margin:0">` : ''}
        <button class="btn" id="exp-atualizar">↻ Atualizar</button></div>
    </div>
    <div id="res">${carregando}</div>`;
  const res = el.querySelector('#res');
  el.querySelector('#exp-atualizar').onclick = carregar;
  const inpData = el.querySelector('#exp-data');
  if (inpData) inpData.onchange = () => { if (inpData.value) { dataSel = inpData.value; carregar(); } };

  async function carregar() {
    try {
      [cfg, dia] = await Promise.all([rpc(db, 'noite_encanto_exp_config'), rpc(db, 'noite_encanto_exp_dia', { p_data: dataSel })]);
    } catch (e) { if (ativa()) res.innerHTML = caixaErro(msgErro(e)); return; }
    if (!ativa()) return;
    const ativos = cfg.operadores.filter(o => o.ativo);
    if (ger && !ativos.some(o => o.id === opSel)) opSel = ativos[0]?.id ?? null;
    desenhar();
  }

  function desenhar() {
    const M = mapa(cfg), op = M.op[opSel];
    if (!op) { res.innerHTML = `<div class="card vazio">${ger ? 'Cadastre um operador em Cadastros.' : 'Seu acesso não está ligado a um operador ativo. Fale com a gerência.'}</div>`; return; }
    const C = calcDia(dia, opSel);
    const porItem = Object.fromEntries(C.L.filter(l => l.item_id).map(l => [l.item_id, l]));
    const blocos = cfg.horarios.map(H => ({ H, itens: H.itens.filter(i => i.operadores.includes(opSel) && M.atv[i.atividade_id]) })).filter(b => b.itens.length);
    const editar = ger || dataSel === cfg.hoje;
    const ativos = cfg.operadores.filter(o => o.ativo);

    res.innerHTML = `
      <div class="exp-opbar">
        ${ger ? `<div class="abas" style="margin:0">${ativos.map(o => `<button data-op="${o.id}" class="${o.id === opSel ? 'ativo' : ''}">${h(o.nome)}</button>`).join('')}</div>`
              : `<div class="forte">${h(op.nome)}</div>`}
        <div class="exp-resumo"><span class="muted peq">${dataSel === cfg.hoje ? 'Produtividade hoje' : 'Produtividade em ' + h(fData(dataSel))}</span>
          <span class="exp-big">${C.pct}%</span><span class="muted peq">meta ${op.meta_pct}%</span></div>
      </div>
      ${editar ? '' : '<div class="aviso-box">Dias anteriores só podem ser alterados pela gerência.</div>'}
      ${blocos.length ? '' : '<div class="card vazio">Nenhuma atividade atribuída a este operador. A gerência marca as atividades em “Montar cronograma”.</div>'}
      ${blocos.map(({ H, itens }) => {
        const b = C.porHora[H.hora], P = C.P.filter(p => p.horario_id === H.id);
        return `<section class="exp-blk">
          <div class="exp-tm">${h(H.hora)}<small>${H.janela_min} min</small></div>
          <div class="exp-tarefas">
            ${itens.map(it => tarefa(it, M.atv[it.atividade_id], porItem[it.id] || {}, editar)).join('')}
            ${P.map(p => `<div class="exp-pz"><span><b>Pausa ${p.minutos} min</b> · ${h(p.motivo)}</span>
              ${editar ? `<button class="btn peq" data-dp="${p.id}">remover</button>` : ''}</div>`).join('')}
            ${pausaAberta === H.id ? `<form class="exp-pform" data-ph="${H.id}">
                <select class="inp" name="motivo" aria-label="Motivo">${MOTIVOS.map(m => `<option>${h(m)}</option>`).join('')}</select>
                <input class="inp num" name="min" inputmode="numeric" value="10" aria-label="Minutos" style="max-width:80px"> min
                <button class="btn pri">Registrar</button><button type="button" class="btn" data-cp>Cancelar</button></form>` : ''}
            <div class="exp-bfoot">
              <div class="exp-meter">${!b ? '<span class="muted peq">não iniciado</span>' : b.pct == null ? '<span class="muted peq">horário todo em pausa</span>'
                : `<div class="exp-bar"><b class="${b.pct >= op.meta_pct ? 'bate' : ''}" style="width:${Math.min(100, b.pct)}%"></b></div><b>${b.pct}%</b>`}</div>
              ${editar ? `<button class="btn peq" data-ap="${H.id}">+ Pausa / intercorrência</button>` : ''}
            </div>
          </div></section>`;
      }).join('')}`;
  }

  function tarefa(it, a, l, editar) {
    const dis = editar ? '' : 'disabled';
    const ctl = a.tipo === 'qtd'
      ? `<div class="exp-qtd"><button data-q="-1" data-it="${it.id}" aria-label="Menos" ${dis}>−</button>
           <input inputmode="numeric" data-qi="${it.id}" value="${l.quantidade || 0}" aria-label="Quantidade de ${h(a.unidade)}" ${dis}>
           <i>${h(a.unidade)}</i><button data-q="${a.tempo_padrao_seg < 60 ? 10 : 1}" data-it="${it.id}" aria-label="Mais" ${dis}>+</button></div>`
      : `<label class="exp-rt">tempo real<input inputmode="numeric" data-ri="${it.id}" value="${l.tempo_real_min ?? ''}" placeholder="min" aria-label="Tempo real em minutos" ${dis}></label>`;
    return `<div class="exp-tarefa ${l.status || ''}">
      <div><div class="forte">${h(a.nome)}</div><div class="muted peq">${h(padrao(a))}${a.fonte ? ' · quantidade vem do ' + h(a.fonte) : ''}</div></div>
      <div class="exp-ctl">${ctl}
        <button class="btn exp-st ${l.status === 'ok' ? 'ok' : ''}" data-s="ok" data-it="${it.id}" ${dis}>Realizada</button>
        <button class="btn exp-st ${l.status === 'pend' ? 'pend' : ''}" data-s="pend" data-it="${it.id}" ${dis}>Pendente</button></div></div>`;
  }

  // grava um lançamento: atualiza a tela na hora e envia ao banco em fila (na ordem dos toques)
  function salvar(itemId, mudanca) {
    const M = mapa(cfg);
    const H = cfg.horarios.find(x => x.itens.some(i => i.id === itemId));
    const it = H.itens.find(i => i.id === itemId), a = M.atv[it.atividade_id];
    let l = dia.lancamentos.find(x => x.item_id === itemId && x.operador_id === opSel);
    const novo = { status: null, quantidade: 0, tempo_real_min: null, ...(l || {}), ...mudanca };
    if (novo.quantidade > 0 && !novo.status && a.tipo === 'qtd' && !('status' in mudanca)) novo.status = 'ok';
    const vazio = !novo.status && !novo.quantidade && novo.tempo_real_min == null;
    dia.lancamentos = dia.lancamentos.filter(x => !(x.item_id === itemId && x.operador_id === opSel));
    if (!vazio) dia.lancamentos.push({ operador_id: opSel, item_id: itemId, atividade_id: a.id, hora: H.hora,
      janela_min: l?.janela_min ?? H.janela_min, tipo: l?.tipo ?? a.tipo, tempo_padrao_seg: l?.tempo_padrao_seg ?? a.tempo_padrao_seg, ...novo });
    desenhar();
    const op = opSel, d = dataSel;
    fila = fila.then(() => rpc(db, 'noite_encanto_exp_lancar', { p_data: d, p_item: itemId, p_operador: op,
      p_status: novo.status || null, p_quantidade: novo.quantidade || 0, p_tempo_real: novo.tempo_real_min ?? null }))
      .catch(e => { toast(msgErro(e), 'erro'); return carregar(); });
  }

  res.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.op) { opSel = +d.op; pausaAberta = null; desenhar(); }
    else if (d.q) {
      const it = +d.it, l = dia.lancamentos.find(x => x.item_id === it && x.operador_id === opSel);
      salvar(it, { quantidade: Math.max(0, (l?.quantidade || 0) + +d.q) });
    }
    else if (d.s) {
      const it = +d.it, l = dia.lancamentos.find(x => x.item_id === it && x.operador_id === opSel);
      salvar(it, { status: l?.status === d.s ? null : d.s });
    }
    else if (d.ap) { pausaAberta = +d.ap; desenhar(); }
    else if ('cp' in d) { pausaAberta = null; desenhar(); }
    else if (d.dp) {
      b.disabled = true;
      try { await rpc(db, 'noite_encanto_exp_pausa_excluir', { p_id: +d.dp }); toast('Pausa removida.'); await carregar(); }
      catch (err) { toast(msgErro(err), 'erro'); b.disabled = false; }
    }
  });
  res.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, hid = +f.dataset.ph, min = parseInt(f.min.value, 10);
    if (!(min > 0)) return toast('Informe os minutos da pausa.', 'erro');
    f.querySelector('.pri').disabled = true;
    try {
      await rpc(db, 'noite_encanto_exp_pausa_salvar', { p_data: dataSel, p_operador: opSel, p_horario: hid, p_motivo: f.motivo.value, p_minutos: min });
      pausaAberta = null; toast('Pausa registrada.', 'ok'); await carregar();
    } catch (err) { toast(msgErro(err), 'erro'); f.querySelector('.pri').disabled = false; }
  });
  res.addEventListener('change', (e) => {
    const d = e.target.dataset;
    if (d.qi) salvar(+d.qi, { quantidade: Math.max(0, parseInt(e.target.value, 10) || 0) });
    else if (d.ri) { const v = parseInt(e.target.value, 10); salvar(+d.ri, { tempo_real_min: v >= 0 ? v : null }); }
  });

  await carregar();
}
