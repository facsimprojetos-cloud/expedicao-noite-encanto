// Expedição — cadastros da gerência: operadores e metas, atividades e tempos padrão, jornada e quem tem acesso.
import { db, ctx } from '../app.js';
import { h, toast, rpc, msgErro } from '../util.js';
import { padrao, hhmm, carregando, caixaErro } from '../exp.js';

export async function render(el, _preset, ativa) {
  let cfg = null, acessos = [];
  el.innerHTML = `
    <div class="cab"><div><h1>Cadastros e acessos</h1><p>${h(ctx.exp.setor_nome)} · operadores, atividades, jornada e quem entra no app</p></div></div>
    <div id="res">${carregando}</div>`;
  const res = el.querySelector('#res');

  async function carregar() {
    try { [cfg, acessos] = await Promise.all([rpc(db, 'noite_encanto_exp_config'), rpc(db, 'noite_encanto_exp_acessos_listar')]); }
    catch (e) { if (ativa()) res.innerHTML = caixaErro(msgErro(e)); return; }
    if (ativa()) desenhar();
  }

  function desenhar() {
    const s = cfg.setor, nomeOp = Object.fromEntries(cfg.operadores.map(o => [o.id, o.nome]));
    res.innerHTML = `
      <div class="card"><h2>Operadores e metas</h2>
        <div class="tabela-wrap"><table class="exp-form"><thead><tr><th>Nome</th><th>Meta diária (%)</th><th>Ativo</th><th></th></tr></thead><tbody>
        ${cfg.operadores.map(o => `<tr data-linha="op" data-id="${o.id}">
          <td><input class="inp" name="nome" value="${h(o.nome)}" maxlength="40"></td>
          <td><input class="inp num" name="meta" inputmode="numeric" value="${o.meta_pct}"></td>
          <td><input type="checkbox" name="ativo" ${o.ativo ? 'checked' : ''} aria-label="Ativo"></td>
          <td class="n"><button class="btn peq" data-salvar="op">Salvar</button></td></tr>`).join('')}
        <tr data-linha="op" data-id=""><td><input class="inp" name="nome" placeholder="Novo operador" maxlength="40"></td>
          <td><input class="inp num" name="meta" inputmode="numeric" value="85"></td><td><input type="checkbox" name="ativo" checked aria-label="Ativo"></td>
          <td class="n"><button class="btn peq pri" data-salvar="op">Adicionar</button></td></tr>
        </tbody></table></div>
        <p class="muted peq">Operador desativado sai do cronograma, mas o histórico dele continua. Um operador novo entra no cronograma quando você marca o nome dele em “Montar cronograma”.</p></div>

      <div class="card"><h2>Atividades e tempo padrão</h2>
        <div class="tabela-wrap"><table class="exp-form"><thead><tr><th>Atividade</th><th>Como mede</th><th>Unidade</th><th>Tempo padrão (s)</th><th>Ativa</th><th>Equivale</th><th></th></tr></thead><tbody>
        ${cfg.atividades.map(a => linhaAtv(a)).join('')}
        ${linhaAtv({ id: '', nome: '', tipo: 'qtd', unidade: '', tempo_padrao_seg: '', ativo: true })}
        </tbody></table></div>
        <p class="muted peq">Por quantidade: o tempo vale para cada unidade (ex.: 13 s por peça). Tempo fixo: o tempo da tarefa inteira (ex.: 2700 s = 45 min).
          Mudar um tempo padrão vale dali para frente; os dias já lançados guardam o tempo da época.</p></div>

      <div class="card"><h2>Jornada</h2>
        <form id="f-jornada" class="filtros" style="margin:0">
          <label class="campo" style="max-width:150px">Fim do expediente<input name="fim" value="${h(s.jornada_fim)}" inputmode="numeric" maxlength="5"></label>
          <label class="campo" style="max-width:150px">Início do almoço<input name="a1" value="${h(s.almoco_ini)}" inputmode="numeric" maxlength="5"></label>
          <label class="campo" style="max-width:150px">Fim do almoço<input name="a2" value="${h(s.almoco_fim)}" inputmode="numeric" maxlength="5"></label>
          <button class="btn pri">Salvar jornada</button></form>
        <p class="muted peq">O fim do expediente fecha o último horário. O almoço é descontado do horário em que cai.</p></div>

      <div class="card"><h2>Quem tem acesso</h2>
        <div class="tabela-wrap"><table><thead><tr><th>E-mail</th><th>Nome</th><th>Perfil</th><th>Operador</th><th>Situação</th><th></th></tr></thead><tbody>
          ${acessos.map(x => `<tr><td>${h(x.email)}</td><td>${h(x.nome || '')}</td><td>${x.perfil === 'gerente' ? 'Gerência' : 'Operador'}</td>
            <td>${h(nomeOp[x.operador_id] || '')}</td><td>${x.ativo ? '<span class="chip ok">ativo</span>' : '<span class="chip">bloqueado</span>'}</td>
            <td class="n"><button class="btn peq" data-editar="${h(x.email)}">Editar</button></td></tr>`).join('')
            || '<tr><td colspan="6" class="muted">Ninguém liberado ainda (os administradores da plataforma já entram como gerência).</td></tr>'}
        </tbody></table></div>
        <form id="f-acesso" class="filtros" style="margin-top:12px">
          <label class="campo">E-mail<input name="email" type="email" required></label>
          <label class="campo">Nome<input name="nome" maxlength="60"></label>
          <label class="campo" style="max-width:170px">Perfil<select name="perfil"><option value="operador">Operador</option><option value="gerente">Gerência</option></select></label>
          <label class="campo" style="max-width:170px">É o operador<select name="operador">${cfg.operadores.filter(o => o.ativo).map(o => `<option value="${o.id}">${h(o.nome)}</option>`).join('')}</select></label>
          <label class="campo" style="max-width:120px;flex:none">Ativo<select name="ativo"><option value="1">Sim</option><option value="0">Não</option></select></label>
          <button class="btn pri">Liberar acesso</button></form>
        <p class="muted peq">A pessoa abre <b>${h(location.host)}</b>, toca em <b>Criar conta</b> com este mesmo e-mail e confirma pelo link recebido.
          O operador vê só as próprias tarefas do dia. A gerência vê tudo e altera o cronograma.</p></div>`;

    const fa = res.querySelector('#f-acesso');
    const ajustar = () => { fa.operador.closest('label').hidden = fa.perfil.value !== 'operador'; };
    fa.perfil.onchange = ajustar; ajustar();
  }

  const linhaAtv = (a) => `<tr data-linha="atv" data-id="${a.id}">
    <td><input class="inp" name="nome" value="${h(a.nome)}" maxlength="120" placeholder="Nova atividade" style="min-width:220px"></td>
    <td><select class="inp" name="tipo"><option value="qtd" ${a.tipo === 'qtd' ? 'selected' : ''}>Por quantidade</option><option value="fixo" ${a.tipo === 'fixo' ? 'selected' : ''}>Tempo fixo</option></select></td>
    <td><input class="inp" name="unidade" value="${h(a.unidade || '')}" maxlength="20" placeholder="peças" style="max-width:110px"></td>
    <td><input class="inp num" name="seg" inputmode="numeric" value="${a.tempo_padrao_seg}"></td>
    <td><input type="checkbox" name="ativo" ${a.ativo ? 'checked' : ''} aria-label="Ativa"></td>
    <td class="muted peq">${a.id ? h(padrao(a)) : ''}</td>
    <td class="n"><button class="btn peq ${a.id ? '' : 'pri'}" data-salvar="atv">${a.id ? 'Salvar' : 'Adicionar'}</button></td></tr>`;

  async function enviar(fn, params, msg, botao) {
    if (botao) botao.disabled = true;
    try { await rpc(db, fn, params); toast(msg, 'ok'); await carregar(); }
    catch (e) { toast(msgErro(e), 'erro'); if (botao) botao.disabled = false; }
  }

  res.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.editar) {
      const x = acessos.find(a => a.email === b.dataset.editar), f = res.querySelector('#f-acesso');
      f.email.value = x.email; f.nome.value = x.nome || ''; f.perfil.value = x.perfil; f.ativo.value = x.ativo ? '1' : '0';
      if (x.operador_id) f.operador.value = x.operador_id;
      f.perfil.onchange(); f.scrollIntoView({ behavior: 'smooth', block: 'center' }); return;
    }
    const tr = b.closest('tr'); if (!tr || !b.dataset.salvar) return;
    const v = (n) => tr.querySelector(`[name="${n}"]`), id = tr.dataset.id ? +tr.dataset.id : null;
    if (b.dataset.salvar === 'op') {
      enviar('noite_encanto_exp_operador_salvar', { p_id: id, p_nome: v('nome').value, p_meta: parseInt(v('meta').value, 10), p_ativo: v('ativo').checked },
        id ? 'Operador salvo.' : 'Operador cadastrado. Marque o nome dele no cronograma.', b);
    } else {
      enviar('noite_encanto_exp_atividade_salvar', { p_id: id, p_nome: v('nome').value, p_tipo: v('tipo').value, p_unidade: v('unidade').value,
        p_tempo_seg: parseInt(v('seg').value, 10), p_ativo: v('ativo').checked }, id ? 'Atividade salva.' : 'Atividade cadastrada. Ela já aparece em “Montar cronograma”.', b);
    }
  });
  res.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target, bt = f.querySelector('.pri');
    if (f.id === 'f-jornada') {
      const fim = hhmm(f.fim.value), a1 = hhmm(f.a1.value), a2 = hhmm(f.a2.value);
      if (!fim || !a1 || !a2) return toast('Use o formato HH:MM nos três horários.', 'erro');
      enviar('noite_encanto_exp_setor_salvar', { p_jornada_fim: fim, p_almoco_ini: a1, p_almoco_fim: a2 }, 'Jornada salva.', bt);
    } else if (f.id === 'f-acesso') {
      enviar('noite_encanto_exp_acesso_salvar', { p_email: f.email.value, p_nome: f.nome.value, p_perfil: f.perfil.value,
        p_operador: f.perfil.value === 'operador' ? +f.operador.value : null, p_ativo: f.ativo.value === '1' }, 'Acesso salvo.', bt);
    }
  });

  await carregar();
}
