// Expedição — painel da gerência: produtividade do dia por operador, por horário, últimos dias, pendências e pausas.
import { db } from '../app.js';
import { h, num, rpc, msgErro, data as fData } from '../util.js';
import { somaDias, ddmm } from '../matriz.js';
import { hojeSP, mapa, calcDia, quantidades, medidor, CORES, carregando, caixaErro } from '../exp.js';

export async function render(el, _preset, ativa) {
  let dataSel = hojeSP(), timer = null;
  el.innerHTML = `
    <div class="cab">
      <div><h1>Painel da Expedição</h1><p>Tempo padrão das tarefas feitas ÷ tempo trabalhado, já descontadas as pausas</p></div>
      <div class="acoes"><input type="date" class="inp" id="exp-data" value="${dataSel}" aria-label="Data" style="margin:0">
        <button class="btn" id="exp-atualizar">↻ Atualizar</button></div>
    </div>
    <div id="res">${carregando}</div>`;
  const res = el.querySelector('#res');
  el.querySelector('#exp-atualizar').onclick = () => carregar();
  el.querySelector('#exp-data').onchange = (e) => { if (e.target.value) { dataSel = e.target.value; carregar(); } };

  async function carregar() {
    let cfg, dia, hist;
    try {
      [cfg, dia, hist] = await Promise.all([
        rpc(db, 'noite_encanto_exp_config'),
        rpc(db, 'noite_encanto_exp_dia', { p_data: dataSel }),
        rpc(db, 'noite_encanto_exp_historico', { p_de: somaDias(dataSel, -20), p_ate: dataSel })]);
    } catch (e) { if (ativa()) res.innerHTML = caixaErro(msgErro(e)); return; }
    if (!ativa()) return;
    desenhar(cfg, dia, hist);
    clearTimeout(timer);
    if (dataSel === cfg.hoje) timer = setTimeout(() => { if (ativa() && !document.hidden) carregar(); }, 60000);
  }

  function desenhar(cfg, dia, dias0) {
    const hist = dias0.flatMap(d => d.operadores);
    const naoFin = dias0.filter(d => !d.finalizado_em && d.data < cfg.hoje).map(d => d.data);
    const M = mapa(cfg);
    const ops = cfg.operadores.filter(o => o.ativo || dia.lancamentos.some(l => l.operador_id === o.id));
    if (!ops.length) { res.innerHTML = '<div class="card vazio">Nenhum operador cadastrado.</div>'; return; }
    const cor = (o) => CORES[ops.indexOf(o) % CORES.length];
    const C = Object.fromEntries(ops.map(o => [o.id, calcDia(dia, o.id)]));
    const rk = [...ops].sort((a, b) => C[b.id].pct - C[a.id].pct);
    const algum = ops.some(o => C[o.id].L.length);
    const titulo = !algum ? 'Nenhum lançamento neste dia ainda'
      : rk.length === 2 ? `${h(rk[0].nome)} está à frente: ${C[rk[0].id].pct}% contra ${C[rk[1].id].pct}%`
      : `${h(rk[0].nome)} lidera com ${C[rk[0].id].pct}%`;

    const horas = cfg.horarios.map(x => x.hora).concat(dia.lancamentos.map(l => l.hora))
      .filter((v, i, a) => a.indexOf(v) === i && ops.some(o => C[o.id].porHora[v])).sort();
    const max = 120;

    // últimos dias (até 10 com lançamento)
    const dias = [...new Set(hist.map(r => r.data))].sort().slice(-10);
    const metaMed = Math.round(ops.reduce((s, o) => s + o.meta_pct, 0) / ops.length);

    const pend = [];
    cfg.horarios.forEach(Hh => Hh.itens.forEach(it => ops.forEach(o => {
      const l = C[o.id].L.find(x => x.item_id === it.id);
      if (l?.status === 'pend') pend.push([Hh.hora, o.nome, M.atv[it.atividade_id]?.nome || '']);
    })));
    const pausas = dia.pausas.slice().sort((a, b) => a.hora.localeCompare(b.hora));
    const legenda = `<div class="legenda">${ops.map(o => `<span><i style="background:${cor(o)}"></i>${h(o.nome)}</span>`).join('')}<span><i style="background:var(--erro);width:3px"></i>meta ${metaMed}%</span></div>`;

    res.innerHTML = `
      ${naoFin.length ? `<div class="aviso-box">Dias ainda não finalizados: ${naoFin.map(d => h(fData(d))).join(', ')}. Veja em <a href="#/historico">Histórico</a>.</div>` : ''}
      ${dia.finalizado ? `<div class="ok-box">Dia finalizado por ${h(dia.finalizado.por || '')}.</div>` : ''}
      <h2 class="exp-titulo">${titulo}</h2>
      <div class="exp-cards">${ops.map(o => {
        const c = C[o.id], q = Object.entries(quantidades(c.L, M.atv));
        return `<div class="card exp-oc">
          <div class="exp-oc-cab"><h2>${h(o.nome)}</h2><span class="exp-big">${c.pct}%</span></div>
          <div class="muted peq">${num(c.prodMin)} min produzidos em ${num(c.dispMin)} min trabalhados</div>
          ${medidor(c.pct, o.meta_pct)}
          <div class="peq">${c.ok} realizadas · <b class="${c.pend ? 'txt-erro' : ''}">${c.pend} pendentes</b> · ${c.pausaMin} min de pausa</div>
          ${q.length ? `<div class="exp-kv">${q.map(([u, n]) => `<div><b>${num(n)}</b>${h(u)}</div>`).join('')}</div>` : ''}
        </div>`;
      }).join('')}</div>

      <div class="exp-duas">
        <div class="card"><h2>Produtividade por horário</h2>${legenda}
          ${horas.length ? horas.map(hr => `<div class="exp-hr"><span class="forte">${h(hr)}</span><div class="exp-hb">
            ${ops.map(o => { const b = C[o.id].porHora[hr]; return `<div><span class="exp-trilho"><s style="width:${b?.pct ? Math.min(100, b.pct / max * 100) : 0}%;background:${cor(o)}"></s>
              <span class="exp-m" style="left:${Math.min(100, o.meta_pct / max * 100)}%"></span></span><span class="exp-v">${b?.pct == null ? '–' : b.pct + '%'}</span></div>`; }).join('')}
          </div></div>`).join('') : '<div class="vazio">Sem lançamentos neste dia.</div>'}
        </div>
        <div class="card"><h2>Últimos dias</h2>${legenda}
          ${dias.length ? `<div class="exp-semana"><div class="exp-mline" style="bottom:${metaMed / max * 100}%"></div>
            ${dias.map(d => `<div class="exp-wd">${ops.map(o => { const r = hist.find(x => x.data === d && x.operador_id === o.id);
              return r && r.pct != null ? `<s style="height:${Math.min(100, r.pct / max * 100)}%;background:${cor(o)}" title="${h(o.nome)} · ${r.pct}%"><em>${r.pct}</em></s>` : '<s style="height:0"></s>'; }).join('')}</div>`).join('')}</div>
            <div class="exp-wl">${dias.map(d => `<span>${d === cfg.hoje ? 'Hoje' : ddmm(d)}</span>`).join('')}</div>`
          : '<div class="vazio">O histórico aparece conforme os operadores lançam.</div>'}
        </div>
      </div>

      <div class="exp-duas">
        <div class="card"><h2>Pendências</h2>${pend.length ? `<div class="tabela-wrap"><table><thead><tr><th>Horário</th><th>Operador</th><th>Atividade</th></tr></thead>
          <tbody>${pend.map(p => `<tr><td>${h(p[0])}</td><td>${h(p[1])}</td><td>${h(p[2])}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vazio">Nenhuma tarefa marcada como pendente.</div>'}</div>
        <div class="card"><h2>Pausas e intercorrências</h2>${pausas.length ? `<div class="tabela-wrap"><table><thead><tr><th>Horário</th><th>Operador</th><th>Motivo</th><th class="n">Min</th></tr></thead>
          <tbody>${pausas.map(p => `<tr><td>${h(p.hora)}</td><td>${h(M.op[p.operador_id]?.nome || '')}</td><td>${h(p.motivo)}</td><td class="n">${p.minutos}</td></tr>`).join('')}</tbody></table></div>` : '<div class="vazio">Nenhuma pausa registrada.</div>'}</div>
      </div>
      <p class="muted peq">${dataSel === cfg.hoje ? 'Atualiza sozinho a cada minuto.' : 'Dia ' + h(fData(dataSel)) + '.'}</p>`;
  }

  await carregar();
}
