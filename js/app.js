import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY, EMPRESA, SUBTITULO } from './config.js';
import { h, toast, rpc } from './util.js';

export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true }
});

// ctx.exp = { email, nome, perfil: 'gerente'|'operador', setor_id, setor_nome, operador_id }
export const ctx = { email: '', nome: '', perfil: '', exp: null };

// ---------- Menu / rotas ----------
const ROTAS = [
  { hash: '#/painel', nome: 'Painel', ico: '📦', modulo: 'exp_painel', gerente: true },
  { hash: '#/dia', nome: 'Cronograma do dia', nomeOperador: 'Meu dia', ico: '✅', modulo: 'exp_dia' },
  { hash: '#/historico', nome: 'Histórico', ico: '📚', modulo: 'exp_historico', gerente: true },
  { hash: '#/cronograma', nome: 'Montar cronograma', ico: '🗓️', modulo: 'exp_cronograma', gerente: true },
  { hash: '#/cadastros', nome: 'Cadastros e acessos', ico: '⚙️', modulo: 'exp_cadastros', gerente: true },
];
const visiveis = () => ROTAS.filter(r => !r.gerente || ctx.exp?.perfil === 'gerente');
const nomeRota = (r) => (ctx.exp?.perfil === 'operador' && r.nomeOperador) || r.nome;

const cache = {};
async function carregarModulo(nome) {
  if (!cache[nome]) cache[nome] = await import(`./telas/${nome}.js`);
  return cache[nome];
}

function montarLayout() {
  const operador = ctx.exp.perfil === 'operador';
  const itens = visiveis().map(r =>
    `<a href="${r.hash}" data-hash="${r.hash}" title="${h(nomeRota(r))}"><span class="ico">${r.ico}</span><span class="txt">${h(nomeRota(r))}</span></a>`).join('');
  document.getElementById('app').innerHTML = `
    <div class="topo-mobile">${operador ? '' : '<button id="abre-menu" aria-label="Abrir menu">☰</button>'}<span class="t">${h(EMPRESA)}</span>
      ${operador ? '<button id="sair-m" class="btn peq" style="margin-left:auto;font-size:.8rem">Sair</button>' : ''}</div>
    <div class="layout">
      <aside class="lateral" id="lateral">
        <div class="marca"><div class="marca-txt">${h(EMPRESA)}<small>${h(SUBTITULO)}</small></div>
          <button class="recolher" id="recolher" title="Recolher menu" aria-label="Recolher menu">«</button></div>
        <nav class="menu"><div class="grupo">${h(ctx.exp.setor_nome)}</div>${itens}</nav>
        <div class="usuario-box">
          <div class="nome">${h(ctx.nome || ctx.email)}</div>
          <div class="muted peq">${operador ? 'operador' : 'gerência'}</div>
          <button class="btn peq" id="sair" title="Sair"><span class="sair-ico">⎋</span><span class="txt">Sair</span></button>
        </div>
      </aside>
      <main class="conteudo" id="conteudo"></main>
    </div>`;
  const sair = async () => { await db.auth.signOut(); location.hash = ''; location.reload(); };
  document.getElementById('sair').onclick = sair;
  const sm = document.getElementById('sair-m'); if (sm) sm.onclick = sair;
  const lateral = document.getElementById('lateral');
  const layout = document.querySelector('.layout'), btRec = document.getElementById('recolher');
  const aplicar = (rec) => {
    layout.classList.toggle('recolhido', rec);
    btRec.textContent = rec ? '»' : '«';
    btRec.title = btRec.ariaLabel = rec ? 'Expandir menu' : 'Recolher menu';
  };
  let recolhido = false;
  try { recolhido = localStorage.getItem('exp_menu_recolhido') === '1'; } catch (_) {}
  aplicar(recolhido);
  btRec.onclick = () => {
    recolhido = !recolhido; aplicar(recolhido);
    try { localStorage.setItem('exp_menu_recolhido', recolhido ? '1' : '0'); } catch (_) {}
  };
  const abre = document.getElementById('abre-menu');
  if (abre) abre.onclick = () => {
    lateral.classList.add('aberta');
    const f = document.createElement('div'); f.className = 'fundo-menu';
    f.onclick = () => { lateral.classList.remove('aberta'); f.remove(); };
    document.body.appendChild(f);
  };
  lateral.querySelectorAll('.menu a[href]').forEach(a => a.addEventListener('click', () => {
    lateral.classList.remove('aberta'); document.querySelector('.fundo-menu')?.remove();
  }));
}

let navSeq = 0;
async function navegar() {
  const hash = (location.hash || '').split('?')[0];
  const lista = visiveis();
  const rota = lista.find(r => r.hash === hash) || lista[0];
  document.querySelectorAll('.menu a[href]').forEach(a => a.classList.toggle('ativo', a.dataset.hash === rota.hash));
  const el = document.getElementById('conteudo');
  const seq = ++navSeq;
  el.innerHTML = '<div class="vazio"><div class="spinner" style="margin:auto"></div></div>';
  try {
    const mod = await carregarModulo(rota.modulo);
    if (seq !== navSeq) return;
    await mod.render(el, null, () => seq === navSeq);
  } catch (e) {
    console.error(e);
    if (seq === navSeq) el.innerHTML = `<div class="card erro-box">Erro ao abrir a tela: ${h(e.message || e)}</div>`;
  }
}

// ---------- Autenticação ----------
function telaLogin(msg = '', tipo = 'erro') {
  document.getElementById('app').innerHTML = `
    <div class="login"><div class="card">
      <div class="marca-login">${h(EMPRESA)}</div>
      <div class="sub">${h(SUBTITULO)}</div>
      ${msg ? `<div class="${tipo}-box">${h(msg)}</div>` : ''}
      <form id="f-login" class="grade">
        <label class="campo">E-mail<input type="email" name="email" required autocomplete="username"></label>
        <label class="campo">Senha<input type="password" name="senha" required minlength="6" autocomplete="current-password"></label>
        <button class="btn pri" type="submit">Entrar</button>
        <button class="btn" type="button" id="criar">Criar conta</button>
        <button class="btn peq" type="button" id="esqueci" style="border:0">Esqueci minha senha</button>
      </form>
      <p class="muted peq" style="text-align:center;margin:12px 0 0"><b>Primeiro acesso?</b> Digite o e-mail liberado pela gerência, crie uma senha e toque em <b>Criar conta</b>. Depois confirme pelo link que chega no seu e-mail.</p>
    </div></div>`;
  const f = document.getElementById('f-login');
  const dados = () => Object.fromEntries(new FormData(f));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const { email, senha } = dados();
    const { error } = await db.auth.signInWithPassword({ email, password: senha });
    if (error) telaLogin(traduzErroAuth(error.message));
  };
  document.getElementById('criar').onclick = async () => {
    const { email, senha } = dados();
    if (!email || !senha || senha.length < 6) return telaLogin('Preencha e-mail e uma senha de pelo menos 6 caracteres para criar a conta.');
    const { data, error } = await db.auth.signUp({ email, password: senha, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) return telaLogin(traduzErroAuth(error.message));
    if (!data.session) telaLogin('Conta criada. Confirme pelo link enviado ao seu e-mail e depois entre.', 'ok');
  };
  document.getElementById('esqueci').onclick = async () => {
    const { email } = dados();
    if (!email) return telaLogin('Digite seu e-mail para receber o link de redefinição.');
    const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    telaLogin(error ? traduzErroAuth(error.message) : 'Se o e-mail existir, enviamos um link de redefinição.', error ? 'erro' : 'ok');
  };
}

function traduzErroAuth(m) {
  if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos. Se é o seu primeiro acesso, você precisa primeiro tocar em "Criar conta" com o e-mail liberado pela gerência.';
  if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail pelo link recebido antes de entrar.';
  if (/already registered/i.test(m)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/Password should be/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  return m;
}

function telaSemAcesso(email) {
  document.getElementById('app').innerHTML = `
    <div class="login"><div class="card">
      <div class="marca-login">${h(EMPRESA)}</div>
      <div class="sub">${h(email)}</div>
      <div class="aviso-box">Sua conta existe, mas o acesso à Expedição ainda não foi liberado. Peça à gerência para incluir este e-mail.</div>
      <button class="btn" id="sair2" style="margin-top:10px;width:100%">Sair</button>
    </div></div>`;
  document.getElementById('sair2').onclick = async () => { await db.auth.signOut(); location.reload(); };
}

function telaNovaSenha() {
  document.getElementById('app').innerHTML = `
    <div class="login"><div class="card">
      <div class="marca-login">${h(EMPRESA)}</div><div class="sub">Crie a nova senha</div>
      <form id="f-senha" class="grade">
        <label class="campo">Nova senha<input type="password" name="senha" required minlength="6" autocomplete="new-password"></label>
        <button class="btn pri" type="submit">Salvar senha</button>
      </form></div></div>`;
  document.getElementById('f-senha').onsubmit = async (ev) => {
    ev.preventDefault();
    const { error } = await db.auth.updateUser({ password: ev.target.senha.value });
    toast(error ? error.message : 'Senha alterada.', error ? 'erro' : 'ok');
    if (!error) { iniciado = false; iniciar(); }
  };
}

let iniciado = false;
async function iniciar() {
  if (iniciado) return;
  const { data: { session } } = await db.auth.getSession();
  if (!session) return telaLogin();
  iniciado = true;
  let exp;
  try { exp = await rpc(db, 'noite_encanto_exp_eu'); }
  catch (e) {
    iniciado = false;
    document.getElementById('app').innerHTML = `<div class="login"><div class="card"><div class="erro-box">${h(e.message)}</div>
      <button class="btn" onclick="location.reload()">Tentar novamente</button></div></div>`;
    return;
  }
  if (!exp) { iniciado = false; return telaSemAcesso(session.user.email); }
  Object.assign(ctx, { email: exp.email, nome: exp.nome, perfil: exp.perfil, exp });
  document.body.classList.toggle('so-operador', exp.perfil === 'operador');
  montarLayout();
  window.addEventListener('hashchange', navegar);
  navegar();
}

db.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') { iniciado = true; return setTimeout(telaNovaSenha, 0); }
  if (evento === 'SIGNED_IN') setTimeout(iniciar, 0);
});

iniciar();
