// Expedição — montar o cronograma padrão do setor: horários, atividades de cada horário e quais operadores fazem cada uma.
import { db } from '../app.js';
import { h, toast, rpc, msgErro } from '../util.js';
import { mapa, padrao, hhmm, carregando, caixaErro } from '../exp.js';

export async function render(el, _preset, ativa) {
  let cfg = null, confirmar = null;
  el.innerHTML = `
    <div class="cab">
      <div><h1>Montar cronograma</h1><p>O roteiro se repete todo dia. Cada operador vê na tela dele só as atividades em que o nome dele está marcado.</p></div>
    </div>
    <div id="res">${carregando}</div>`;
  const res = el.querySelector('#res');

  async function carregar() {
    try { cfg = await rpc(db, 'noite_encanto_exp_config'); }
    catch (e) { if (ativa()) res.innerHTML = caixaErro(msgErro(e)); return; }
    if (ativa()) desenhar();
  }

  function desenhar() {
    const M = mapa(cfg), ops = cfg.operadores.filter(o => o.ativo);
    const atvs = cfg.atividades.filter(a => a.ativo);
    const opcoes = atvs.map(a => `<option value="${a.id}">${h(a.nome)}</option>`).join('');
    res.innerHTML = `
      <p class="muted peq">Toque no nome do operador para colocar ou tirar ele da atividade. Para mudar um horário, edite a hora e saia do campo.</p>
      ${cfg.horarios.map(H => `<section class="exp-blk">
        <div class="exp-tm"><input class="inp exp-hora" data-hora="${H.id}" value="${h(H.hora)}" inputmode="numeric" maxlength="5" aria-label="Horário">
          <small>${H.janela_min} min até o próximo</small>
          <button class="btn peq perigo" data-rh="${H.id}">${confirmar === 'h' + H.id ? 'Confirmar remoção' : 'Remover horário'}</button></div>
        <div class="exp-tarefas">
          ${H.itens.map(it => { const a = M.atv[it.atividade_id]; if (!a) return ''; return `<div class="exp-tarefa">
            <div><div class="forte">${h(a.nome)}</div><div class="muted peq">${h(padrao(a))}${it.operadores.length ? '' : ' · <span class="chip alerta">sem operador</span>'}</div></div>
            <div class="exp-ctl">${ops.map(o => `<button class="exp-chip ${it.operadores.includes(o.id) ? 'on' : ''}" aria-pressed="${it.operadores.includes(o.id)}"
                data-tg="${it.id}" data-op="${o.id}">${h(o.nome)}</button>`).join('')}
              <button class="btn peq perigo" data-ri="${it.id}">Remover</button></div></div>`; }).join('')}
          <div class="exp-add"><select class="inp" data-sel="${H.id}" aria-label="Atividade para adicionar">${opcoes}</select>
            <button class="btn" data-ai="${H.id}">+ Adicionar atividade</button></div>
        </div></section>`).join('') || '<div class="card vazio">Nenhum horário ainda. Crie o primeiro abaixo.</div>'}
      <div class="card" style="margin-top:16px"><h2>Novo horário</h2>
        <form id="f-hora" class="filtros" style="margin:0"><label class="campo" style="max-width:160px;flex:none">Horário (HH:MM)
          <input name="hora" inputmode="numeric" maxlength="5" placeholder="15:20" required></label>
          <button class="btn pri">Adicionar horário</button></form>
        <p class="muted peq">Para uma atividade que não está na lista, cadastre primeiro em “Cadastros e acessos”.</p></div>`;
  }

  async function acao(fn, params, msg) {
    try { await rpc(db, fn, params); if (msg) toast(msg, 'ok'); }
    catch (e) { toast(msgErro(e), 'erro'); }
    await carregar();
  }

  res.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if (d.tg) {
      const it = cfg.horarios.flatMap(x => x.itens).find(x => x.id === +d.tg), marcar = !it.operadores.includes(+d.op);
      it.operadores = marcar ? [...it.operadores, +d.op] : it.operadores.filter(x => x !== +d.op);
      desenhar();
      try { await rpc(db, 'noite_encanto_exp_item_operador', { p_item: +d.tg, p_operador: +d.op, p_marcar: marcar }); }
      catch (err) { toast(msgErro(err), 'erro'); carregar(); }
    } else if (d.ri) {
      b.disabled = true; await acao('noite_encanto_exp_item_excluir', { p_id: +d.ri }, 'Atividade tirada do horário.');
    } else if (d.ai) {
      const sel = res.querySelector(`select[data-sel="${d.ai}"]`);
      if (!sel.value) return toast('Cadastre uma atividade primeiro.', 'erro');
      b.disabled = true; await acao('noite_encanto_exp_item_adicionar', { p_horario: +d.ai, p_atividade: +sel.value }, 'Atividade adicionada para todos os operadores. Desmarque quem não faz.');
    } else if (d.rh) {
      if (confirmar !== 'h' + d.rh) { confirmar = 'h' + d.rh; desenhar(); return; }
      confirmar = null; b.disabled = true; await acao('noite_encanto_exp_horario_excluir', { p_id: +d.rh }, 'Horário removido.');
    }
  });
  res.addEventListener('change', (e) => {
    const id = e.target.dataset.hora; if (!id) return;
    const v = hhmm(e.target.value);
    if (!v) { toast('Use o formato HH:MM, por exemplo 07:30.', 'erro'); return carregar(); }
    acao('noite_encanto_exp_horario_salvar', { p_id: +id, p_hora: v }, 'Horário alterado.');
  });
  res.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = hhmm(e.target.hora.value);
    if (!v) return toast('Use o formato HH:MM, por exemplo 15:20.', 'erro');
    acao('noite_encanto_exp_horario_salvar', { p_id: null, p_hora: v }, `Horário ${v} criado. Agora adicione as atividades nele.`);
  });

  await carregar();
}
