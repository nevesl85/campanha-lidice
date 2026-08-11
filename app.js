/* ============================================================
   Campanha Lídice da Mata, aplicação
   HTML/JS puro + Supabase. Sem build, sem framework.
   ============================================================ */

const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

const estado = {
  usuario: null,      // auth user
  perfil: null,       // linha de profiles
  pessoas: [],        // todos os perfis
  tarefas: [],
  eventos: [],
  fotos: [],
  notas: [],
  projetos: [],
  noticias: [],
  entregas: [],
  filtroAreaEnt: '',
  filtroAnoEnt: '',
  filtroSituacao: '',
  filtroAreaProj: '',
  filtroVeiculo: '',
  indicadores: [],
  areaBahia: 'economia',
  filtroResp: '',
  buscaNotas: '',
  temaNota: '',
  canalComentarios: null,
  canalTarefas: null,
  graficos: []
};

const COLUNAS = [
  { id: 'backlog',   nome: 'A fazer'    },
  { id: 'fazendo',   nome: 'Em andamento' },
  { id: 'revisao',   nome: 'Em revisão' },
  { id: 'concluida', nome: 'Concluída'  }
];

const PRIORIDADES = { baixa: 'Baixa', media: 'Média', alta: 'Alta', urgente: 'Urgente' };

const SIT_EVENTO = {
  a_confirmar: 'A confirmar', confirmado: 'Confirmado',
  cumprido: 'Cumprido', cancelado: 'Cancelado'
};

const AREAS_BAHIA = [
  { id: 'economia',  nome: 'Economia'          },
  { id: 'emprego',   nome: 'Emprego e renda'   },
  { id: 'educacao',  nome: 'Educação'          },
  { id: 'saude',     nome: 'Saúde'             },
  { id: 'seguranca', nome: 'Segurança pública' },
  { id: 'cultura',   nome: 'Cultura'           }
];

/* ============================================================
   Utilidades
   ============================================================ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

function esc(t) {
  if (t === null || t === undefined) return '';
  return String(t).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function iniciais(nome) {
  if (!nome) return '?';
  const p = nome.trim().split(/\s+/);
  return ((p[0][0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
}

function toast(msg, erro = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = erro ? 'on erro' : 'on';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.className = ''; }, 3600);
}

function nomeDe(id) {
  const p = estado.pessoas.find(x => x.id === id);
  return p ? (p.nome || p.email) : 'Desconhecido';
}

function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

function dataHoraBR(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });
}

function quandoRelativo(iso) {
  const seg = (Date.now() - new Date(iso)) / 1000;
  if (seg < 60)    return 'agora';
  if (seg < 3600)  return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86400) return `há ${Math.floor(seg / 3600)} h`;
  if (seg < 604800) return `há ${Math.floor(seg / 86400)} d`;
  return dataHoraBR(iso);
}

function numeroBR(v, unidade = '') {
  if (v === null || v === undefined) return '—';
  const n = Number(v);
  let casas = 0;
  if (Math.abs(n) < 10)   casas = 2;
  else if (Math.abs(n) < 1000) casas = 1;
  if (Number.isInteger(n) && Math.abs(n) >= 100) casas = 0;
  if (unidade.includes('nota')) casas = 1;
  return n.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function abrirModal(html, largo = false) {
  const div = document.createElement('div');
  div.className = 'fundo-modal';
  div.innerHTML = `<div class="modal${largo ? ' largo' : ''}">${html}</div>`;
  div.addEventListener('mousedown', e => { if (e.target === div) fecharModal(); });
  $('#modais').appendChild(div);
  document.body.style.overflow = 'hidden';
  const foco = div.querySelector('input,textarea,select');
  if (foco) setTimeout(() => foco.focus(), 60);
  return div;
}

function fecharModal() {
  if (estado.canalComentarios) { sb.removeChannel(estado.canalComentarios); estado.canalComentarios = null; }
  $('#modais').innerHTML = '';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharModal(); });

/* ============================================================
   Autenticação
   ============================================================ */
let modoCadastro = false;

$('#ab-entrar').onclick = () => trocarModo(false);
$('#ab-criar').onclick  = () => trocarModo(true);

function trocarModo(cadastro) {
  modoCadastro = cadastro;
  $('#ab-entrar').classList.toggle('on', !cadastro);
  $('#ab-criar').classList.toggle('on', cadastro);
  $('#campo-nome').classList.toggle('oculto', !cadastro);
  $('#in-nome').required = cadastro;
  $('#bt-login').textContent = cadastro ? 'Criar conta' : 'Entrar';
  $('#in-senha').autocomplete = cadastro ? 'new-password' : 'current-password';
  $('#msg-login').innerHTML = '';
}

function msgLogin(texto, tipo = 'erro') {
  $('#msg-login').innerHTML = `<div class="aviso ${tipo}">${esc(texto)}</div>`;
}

$('#form-login').onsubmit = async e => {
  e.preventDefault();
  const email = $('#in-email').value.trim();
  const senha = $('#in-senha').value;
  const nome  = $('#in-nome').value.trim();
  const bt = $('#bt-login');
  bt.disabled = true;
  bt.textContent = 'Aguarde…';

  try {
    if (modoCadastro) {
      const { error } = await sb.auth.signUp({
        email, password: senha, options: { data: { nome } }
      });
      if (error) throw error;
      msgLogin('Conta criada. Agora um administrador da campanha precisa liberar seu acesso.', 'ok');
      trocarModo(false);
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
    }
  } catch (err) {
    const m = String(err.message || err);
    if (m.includes('Invalid login'))            msgLogin('E-mail ou senha incorretos.');
    else if (m.includes('already registered'))  msgLogin('Este e-mail já tem conta. Use "Entrar".');
    else if (m.includes('Email not confirmed')) msgLogin('Confirme seu e-mail antes de entrar.');
    else if (m.includes('at least'))            msgLogin('A senha precisa ter pelo menos 8 caracteres.');
    else msgLogin(m);
  } finally {
    bt.disabled = false;
    bt.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
  }
};

$('#bt-sair').onclick = async () => { await sb.auth.signOut(); location.reload(); };
$('#bt-sair-espera').onclick = async () => { await sb.auth.signOut(); location.reload(); };

sb.auth.onAuthStateChange((evento, sessao) => {
  if (evento === 'SIGNED_IN' && !estado.usuario) iniciar(sessao);
  if (evento === 'SIGNED_OUT') location.reload();
});

async function iniciar(sessao) {
  if (!sessao) {
    $('#tela-login').classList.remove('oculto');
    return;
  }
  estado.usuario = sessao.user;

  const { data: perfil, error } = await sb
    .from('profiles').select('*').eq('id', sessao.user.id).maybeSingle();

  if (error || !perfil) {
    msgLogin('Não foi possível carregar seu perfil. Tente sair e entrar de novo.');
    $('#tela-login').classList.remove('oculto');
    return;
  }
  estado.perfil = perfil;

  $('#tela-login').classList.add('oculto');

  if (!perfil.aprovado) {
    $('#tela-espera').classList.remove('oculto');
    return;
  }

  $('#app').classList.remove('oculto');
  $('#meu-nome').textContent   = perfil.nome || perfil.email;
  $('#meu-papel').textContent  = perfil.papel;
  $('#meu-avatar').textContent = iniciais(perfil.nome || perfil.email);
  if (perfil.papel !== 'admin') $('#nav-equipe').classList.add('oculto');

  await carregarPessoas();
  await Promise.all([carregarTarefas(), carregarEventos(), carregarFotos(),
                     carregarNotas(), carregarProjetos(),
                     carregarNoticias(), carregarEntregas(),
                     carregarDemandas(), carregarIndicadores()]);
  escutarTarefas();
}

(async () => {
  const { data } = await sb.auth.getSession();
  iniciar(data.session);
})();

/* ============================================================
   Navegação
   ============================================================ */
$$('nav button').forEach(b => {
  b.onclick = () => {
    $$('nav button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    $$('main > section').forEach(s => s.classList.add('oculto'));
    $('#tela-' + b.dataset.tela).classList.remove('oculto');
    $('#lateral').classList.remove('aberto');
  };
});
$('#bt-menu').onclick = () => $('#lateral').classList.toggle('aberto');

/* ============================================================
   Pessoas / equipe
   ============================================================ */
async function carregarPessoas() {
  const { data } = await sb.from('profiles').select('*').order('nome');
  estado.pessoas = data || [];

  const sel = $('#filtro-resp');
  sel.innerHTML = '<option value="">Todos os responsáveis</option>'
    + '<option value="__eu">Só as minhas</option>'
    + '<option value="__sem">Sem responsável</option>'
    + estado.pessoas.filter(p => p.aprovado)
        .map(p => `<option value="${p.id}">${esc(p.nome || p.email)}</option>`).join('');
  sel.onchange = () => { estado.filtroResp = sel.value; desenharKanban(); };

  if (estado.perfil.papel === 'admin') desenharEquipe();
}

function desenharEquipe() {
  const pendentes = estado.pessoas.filter(p => !p.aprovado).length;
  $('#resumo-equipe').textContent =
    `${estado.pessoas.length} pessoa(s)` + (pendentes ? ` · ${pendentes} aguardando liberação` : ' · nenhuma pendência');

  $('#tab-equipe').innerHTML = `
    <thead><tr>
      <th>Pessoa</th><th>E-mail</th><th>Papel</th><th>Acesso</th><th style="text-align:right">Ações</th>
    </tr></thead>
    <tbody>${estado.pessoas.map(p => `
      <tr>
        <td><div style="display:flex;align-items:center;gap:9px">
          <div class="bolinha">${esc(iniciais(p.nome || p.email))}</div>
          <strong>${esc(p.nome || '—')}</strong></div></td>
        <td style="color:var(--texto-2);font-size:13px">${esc(p.email)}</td>
        <td>
          <select class="campo" style="padding:5px 8px;font-size:13px;width:auto"
                  data-papel="${p.id}" ${p.id === estado.perfil.id ? 'disabled' : ''}>
            ${['equipe', 'candidata', 'admin'].map(r =>
              `<option value="${r}" ${p.papel === r ? 'selected' : ''}>${r}</option>`).join('')}
          </select>
        </td>
        <td><span class="tag ${p.aprovado ? 'sim' : 'nao'}">${p.aprovado ? 'liberado' : 'bloqueado'}</span></td>
        <td style="text-align:right">
          ${p.id === estado.perfil.id ? '<span style="color:var(--texto-2);font-size:12.5px">você</span>' : `
            <button class="btn mini ${p.aprovado ? 'sec' : ''}" data-alternar="${p.id}">
              ${p.aprovado ? 'Bloquear' : 'Liberar'}
            </button>`}
        </td>
      </tr>`).join('')}</tbody>`;

  $$('[data-alternar]').forEach(b => {
    b.onclick = async () => {
      const p = estado.pessoas.find(x => x.id === b.dataset.alternar);
      const { error } = await sb.from('profiles').update({ aprovado: !p.aprovado }).eq('id', p.id);
      if (error) return toast(error.message, true);
      toast(p.aprovado ? 'Acesso bloqueado.' : 'Acesso liberado.');
      await carregarPessoas();
    };
  });

  $$('[data-papel]').forEach(s => {
    s.onchange = async () => {
      const { error } = await sb.from('profiles').update({ papel: s.value }).eq('id', s.dataset.papel);
      if (error) { toast(error.message, true); return carregarPessoas(); }
      toast('Papel atualizado.');
      await carregarPessoas();
    };
  });
}

/* ============================================================
   Tarefas
   ============================================================ */
async function carregarTarefas() {
  const { data, error } = await sb.from('tarefas').select('*').order('created_at', { ascending: false });
  if (error) return toast(error.message, true);
  estado.tarefas = data || [];
  desenharKanban();
}

function tarefasFiltradas() {
  const f = estado.filtroResp;
  if (!f) return estado.tarefas;
  if (f === '__eu')  return estado.tarefas.filter(t => t.responsavel_id === estado.perfil.id);
  if (f === '__sem') return estado.tarefas.filter(t => !t.responsavel_id);
  return estado.tarefas.filter(t => t.responsavel_id === f);
}

function desenharKanban() {
  const lista = tarefasFiltradas();
  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = lista.filter(t => t.prazo && t.prazo < hoje && t.status !== 'concluida').length;
  const abertas = lista.filter(t => t.status !== 'concluida').length;

  $('#resumo-tarefas').innerHTML =
    `${abertas} em aberto · ${lista.length - abertas} concluída(s)` +
    (atrasadas ? ` · <strong style="color:var(--vermelho)">${atrasadas} com prazo vencido</strong>` : '');

  $('#kanban').innerHTML = COLUNAS.map(c => {
    const desta = lista.filter(t => t.status === c.id);
    return `
      <div class="coluna" data-coluna="${c.id}">
        <h3>${c.nome} <span>${desta.length}</span></h3>
        ${desta.map(cartaoTarefa).join('') ||
          '<div style="padding:14px 4px;color:var(--texto-2);font-size:12.5px">Nada por aqui</div>'}
      </div>`;
  }).join('');

  // clique abre detalhe
  $$('.tarefa').forEach(el => {
    el.onclick = () => abrirTarefa(el.dataset.id);
    el.ondragstart = e => { e.dataTransfer.setData('text/plain', el.dataset.id); el.classList.add('arrastando'); };
    el.ondragend = () => el.classList.remove('arrastando');
  });

  // arrastar entre colunas
  $$('.coluna').forEach(col => {
    col.ondragover  = e => { e.preventDefault(); col.classList.add('alvo'); };
    col.ondragleave = () => col.classList.remove('alvo');
    col.ondrop = async e => {
      e.preventDefault();
      col.classList.remove('alvo');
      const id = e.dataTransfer.getData('text/plain');
      const t = estado.tarefas.find(x => x.id === id);
      if (!t || t.status === col.dataset.coluna) return;
      const antes = t.status;
      t.status = col.dataset.coluna;
      desenharKanban();
      const { error } = await sb.from('tarefas').update({ status: col.dataset.coluna }).eq('id', id);
      if (error) { t.status = antes; desenharKanban(); toast(error.message, true); }
    };
  });
}

function cartaoTarefa(t) {
  const hoje = new Date().toISOString().slice(0, 10);
  const vencida = t.prazo && t.prazo < hoje && t.status !== 'concluida';
  const resp = t.responsavel_id ? estado.pessoas.find(p => p.id === t.responsavel_id) : null;
  return `
    <div class="tarefa" draggable="true" data-id="${t.id}">
      <h4>${esc(t.titulo)}</h4>
      <div class="meta">
        <span class="pastilha p-${t.prioridade}">${PRIORIDADES[t.prioridade]}</span>
        ${t.prazo ? `<span class="${vencida ? 'prazo-vencido' : ''}">${vencida ? '⚠ ' : ''}${dataBR(t.prazo)}</span>` : ''}
        ${t.area ? `<span>· ${esc(t.area)}</span>` : ''}
        ${resp ? `<span class="chip-resp" style="margin-left:auto">
                    <span class="bolinha">${esc(iniciais(resp.nome || resp.email))}</span></span>` : ''}
      </div>
    </div>`;
}

$('#bt-nova-tarefa').onclick = () => formularioTarefa();

function formularioTarefa(t = null) {
  const ed = !!t;
  const opcoesPessoas = estado.pessoas.filter(p => p.aprovado)
    .map(p => `<option value="${p.id}" ${t && t.responsavel_id === p.id ? 'selected' : ''}>${esc(p.nome || p.email)}</option>`).join('');

  const m = abrirModal(`
    <header>
      <h3>${ed ? 'Editar tarefa' : 'Nova tarefa'}</h3>
      <button class="fechar" data-x>&times;</button>
    </header>
    <div class="corpo">
      <div class="bloco">
        <label class="rot">Título</label>
        <input class="campo" id="f-titulo" maxlength="200" value="${esc(t?.titulo || '')}" placeholder="O que precisa ser feito">
      </div>
      <div class="bloco">
        <label class="rot">Descrição</label>
        <textarea class="campo" id="f-desc" placeholder="Detalhes, contexto, links">${esc(t?.descricao || '')}</textarea>
      </div>
      <div class="bloco linha-campos">
        <div>
          <label class="rot">Responsável</label>
          <select class="campo" id="f-resp"><option value="">Sem responsável</option>${opcoesPessoas}</select>
        </div>
        <div>
          <label class="rot">Prazo</label>
          <input class="campo" id="f-prazo" type="date" value="${t?.prazo || ''}">
        </div>
      </div>
      <div class="bloco linha-campos">
        <div>
          <label class="rot">Prioridade</label>
          <select class="campo" id="f-prio">
            ${Object.entries(PRIORIDADES).map(([k, v]) =>
              `<option value="${k}" ${(t?.prioridade || 'media') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="rot">Frente de trabalho</label>
          <input class="campo" id="f-area" maxlength="60" value="${esc(t?.area || '')}" placeholder="Ex.: Comunicação, Jurídico">
        </div>
      </div>
      <div class="bloco">
        <label class="rot">Situação</label>
        <select class="campo" id="f-status">
          ${COLUNAS.map(c => `<option value="${c.id}" ${(t?.status || 'backlog') === c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <footer>
      <span></span>
      <div style="display:flex;gap:8px">
        <button class="btn sec" data-x>Cancelar</button>
        <button class="btn" id="f-salvar">${ed ? 'Salvar' : 'Criar tarefa'}</button>
      </div>
    </footer>`);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);

  $('#f-salvar', m).onclick = async () => {
    const titulo = $('#f-titulo', m).value.trim();
    if (!titulo) return toast('Dê um título à tarefa.', true);

    const dados = {
      titulo,
      descricao: $('#f-desc', m).value.trim(),
      responsavel_id: $('#f-resp', m).value || null,
      prazo: $('#f-prazo', m).value || null,
      prioridade: $('#f-prio', m).value,
      area: $('#f-area', m).value.trim() || null,
      status: $('#f-status', m).value
    };

    const bt = $('#f-salvar', m); bt.disabled = true; bt.textContent = 'Salvando…';
    const { error } = ed
      ? await sb.from('tarefas').update(dados).eq('id', t.id)
      : await sb.from('tarefas').insert({ ...dados, criado_por: estado.perfil.id });

    if (error) { bt.disabled = false; bt.textContent = 'Salvar'; return toast(error.message, true); }
    fecharModal();
    toast(ed ? 'Tarefa atualizada.' : 'Tarefa criada.');
    carregarTarefas();
  };
}

async function abrirTarefa(id) {
  const t = estado.tarefas.find(x => x.id === id);
  if (!t) return;
  const podeApagar = t.criado_por === estado.perfil.id || estado.perfil.papel === 'admin';
  const hoje = new Date().toISOString().slice(0, 10);
  const vencida = t.prazo && t.prazo < hoje && t.status !== 'concluida';

  const m = abrirModal(`
    <header>
      <div>
        <h3>${esc(t.titulo)}</h3>
        <div style="margin-top:7px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:12px;color:var(--texto-2)">
          <span class="pastilha p-${t.prioridade}">${PRIORIDADES[t.prioridade]}</span>
          <span>${COLUNAS.find(c => c.id === t.status).nome}</span>
          ${t.prazo ? `<span class="${vencida ? 'prazo-vencido' : ''}">· prazo ${dataBR(t.prazo)}</span>` : ''}
          ${t.area ? `<span>· ${esc(t.area)}</span>` : ''}
        </div>
      </div>
      <button class="fechar" data-x>&times;</button>
    </header>
    <div class="corpo">
      ${t.descricao ? `<div class="bloco" style="white-space:pre-wrap;font-size:14.5px">${esc(t.descricao)}</div>` : ''}
      <div class="bloco" style="font-size:13px;color:var(--texto-2)">
        Responsável: <strong style="color:var(--texto)">${t.responsavel_id ? esc(nomeDe(t.responsavel_id)) : 'ninguém ainda'}</strong><br>
        Criada por ${esc(nomeDe(t.criado_por))} em ${dataHoraBR(t.created_at)}
        ${t.concluida_em ? `<br>Concluída em ${dataHoraBR(t.concluida_em)}` : ''}
      </div>
      <div class="comentarios">
        <h4>Comentários</h4>
        <div id="lista-coment"><div class="carregando">Carregando…</div></div>
        <div class="escrever">
          <textarea class="campo" id="novo-coment" placeholder="Escreva um comentário…" rows="1"></textarea>
          <button class="btn" id="bt-comentar">Enviar</button>
        </div>
      </div>
    </div>
    <footer>
      ${podeApagar ? '<button class="btn sec perigo" id="bt-apagar" style="background:transparent;color:var(--vermelho);border-color:#f0c8c3">Excluir</button>' : '<span></span>'}
      <div style="display:flex;gap:8px">
        <button class="btn sec" data-x>Fechar</button>
        <button class="btn" id="bt-editar">Editar</button>
      </div>
    </footer>`, true);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);
  $('#bt-editar', m).onclick = () => { fecharModal(); formularioTarefa(t); };

  if (podeApagar) {
    $('#bt-apagar', m).onclick = async () => {
      if (!confirm('Excluir esta tarefa e todos os seus comentários?')) return;
      const { error } = await sb.from('tarefas').delete().eq('id', t.id);
      if (error) return toast(error.message, true);
      fecharModal(); toast('Tarefa excluída.'); carregarTarefas();
    };
  }

  const ta = $('#novo-coment', m);
  ta.oninput = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'; };
  ta.onkeydown = e => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); enviarComentario(); }
  };
  $('#bt-comentar', m).onclick = enviarComentario;

  async function enviarComentario() {
    const texto = ta.value.trim();
    if (!texto) return;
    ta.value = ''; ta.style.height = 'auto';
    const { error } = await sb.from('comentarios')
      .insert({ tarefa_id: t.id, texto, autor_id: estado.perfil.id });
    if (error) { ta.value = texto; toast(error.message, true); }
  }

  await pintarComentarios(t.id);

  estado.canalComentarios = sb.channel('coment-' + t.id)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'comentarios', filter: `tarefa_id=eq.${t.id}` },
      () => pintarComentarios(t.id))
    .subscribe();
}

async function pintarComentarios(tarefaId) {
  const alvo = $('#lista-coment');
  if (!alvo) return;
  const { data, error } = await sb.from('comentarios')
    .select('*').eq('tarefa_id', tarefaId).order('created_at');
  if (error) { alvo.innerHTML = `<div class="vazio">${esc(error.message)}</div>`; return; }

  alvo.innerHTML = (data || []).length
    ? data.map(c => `
      <div class="coment">
        <div class="bolinha">${esc(iniciais(nomeDe(c.autor_id)))}</div>
        <div class="balao">
          <div class="quem">${esc(nomeDe(c.autor_id))}<span class="quando">${quandoRelativo(c.created_at)}</span></div>
          <p>${esc(c.texto)}</p>
        </div>
      </div>`).join('')
    : '<div style="color:var(--texto-2);font-size:13px;padding:4px 0">Ninguém comentou ainda. Comece a conversa.</div>';
  alvo.scrollTop = alvo.scrollHeight;
}

function escutarTarefas() {
  estado.canalTarefas = sb.channel('tarefas-geral')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tarefas' }, carregarTarefas)
    .subscribe();
}

/* ============================================================
   Agenda
   ============================================================ */
async function carregarEventos() {
  const { data, error } = await sb.from('eventos')
    .select('*, evento_participantes(profile_id, nome)').order('inicio');
  if (error) return toast(error.message, true);
  estado.eventos = data || [];
  desenharAgenda();
}

function desenharAgenda() {
  const agora = new Date();
  const futuros = estado.eventos.filter(e => new Date(e.fim || e.inicio) >= agora);
  const passados = estado.eventos.filter(e => new Date(e.fim || e.inicio) < agora).reverse();

  $('#resumo-agenda').textContent = futuros.length
    ? `${futuros.length} compromisso(s) pela frente`
    : 'Nenhum compromisso futuro na agenda';

  const linha = e => {
    const d = new Date(e.inicio);
    const passou = new Date(e.fim || e.inicio) < agora;
    const podeApagar = estado.perfil.papel === 'admin';
    return `
      <div class="evento ${passou ? 'passado' : ''} ${e.situacao}">
        <div class="data-caixa">
          <div class="dia">${String(d.getDate()).padStart(2, '0')}</div>
          <div class="mes">${d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</div>
        </div>
        <div class="det">
          <strong>${esc(e.titulo)} <span class="tag ${e.situacao}">${SIT_EVENTO[e.situacao] || e.situacao}</span></strong>
          <div class="sub">
            ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            ${e.local ? ' · ' + esc(e.local) : ''}${e.cidade ? ', ' + esc(e.cidade) : ''}
            ${e.tipo ? ' · ' + esc(e.tipo) : ''}
          </div>
          ${e.descricao ? `<div class="sub" style="margin-top:5px;white-space:pre-wrap">${esc(e.descricao)}</div>` : ''}
          ${(e.evento_participantes || []).length ? `<div class="participantes">
            ${e.evento_participantes.map(p => `<span class="chip-pessoa"><span class="bolinha">${esc(iniciais(p.nome))}</span>${esc(p.nome)}</span>`).join('')}
          </div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn sec mini" data-ed-ev="${e.id}">Editar</button>
          ${podeApagar ? `<button class="btn sec mini" data-del-ev="${e.id}">Excluir</button>` : ''}
        </div>
      </div>`;
  };

  $('#lista-eventos').innerHTML =
    (futuros.length || passados.length)
      ? (futuros.length ? futuros.map(linha).join('') : '')
        + (passados.length ? `<div style="padding:11px 16px;font-size:11.5px;text-transform:uppercase;
             letter-spacing:.6px;color:var(--texto-2);background:var(--areia);border-top:1px solid var(--borda);
             border-bottom:1px solid var(--borda)">Já aconteceram</div>` + passados.map(linha).join('') : '')
      : '<div class="vazio"><span class="big">▤</span>Nenhum compromisso cadastrado ainda.</div>';

  $$('[data-ed-ev]').forEach(b => b.onclick = () =>
    formularioEvento(estado.eventos.find(e => e.id === b.dataset.edEv)));
  $$('[data-del-ev]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir de vez, sem deixar registro? Para manter o histórico, marque como cancelado em vez de excluir.')) return;
    const { error } = await sb.from('eventos').delete().eq('id', b.dataset.delEv);
    if (error) return toast(error.message, true);
    toast('Compromisso excluído.'); carregarEventos();
  });
}

$('#bt-novo-evento').onclick = () => formularioEvento();

function formularioEvento(e = null) {
  const ed = !!e;
  const jaEstao = new Set((e?.evento_participantes || []).map(x => x.profile_id));
  const paraInput = iso => iso ? new Date(new Date(iso).getTime()
    - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';

  const m = abrirModal(`
    <header>
      <h3>${ed ? 'Editar compromisso' : 'Novo compromisso'}</h3>
      <button class="fechar" data-x>&times;</button>
    </header>
    <div class="corpo">
      <div class="bloco">
        <label class="rot">Título</label>
        <input class="campo" id="e-titulo" maxlength="200" value="${esc(e?.titulo || '')}" placeholder="Ex.: Caminhada no Subúrbio">
      </div>
      <div class="bloco linha-campos">
        <div><label class="rot">Início</label>
          <input class="campo" id="e-inicio" type="datetime-local" value="${paraInput(e?.inicio)}"></div>
        <div><label class="rot">Término (opcional)</label>
          <input class="campo" id="e-fim" type="datetime-local" value="${paraInput(e?.fim)}"></div>
      </div>
      <div class="bloco linha-campos">
        <div><label class="rot">Local</label>
          <input class="campo" id="e-local" maxlength="120" value="${esc(e?.local || '')}" placeholder="Praça, rádio, comitê…"></div>
        <div><label class="rot">Cidade</label>
          <input class="campo" id="e-cidade" maxlength="80" value="${esc(e?.cidade || '')}" placeholder="Salvador"></div>
      </div>
      <div class="bloco linha-campos">
        <div><label class="rot">Tipo</label>
          <select class="campo" id="e-tipo">
            ${['compromisso', 'ato público', 'entrevista', 'debate', 'reunião', 'viagem', 'gravação']
              .map(x => `<option ${e?.tipo === x ? 'selected' : ''}>${x}</option>`).join('')}
          </select></div>
        <div><label class="rot">Situação</label>
          <select class="campo" id="e-sit">
            ${Object.entries(SIT_EVENTO).map(([k, v]) =>
              `<option value="${k}" ${(e?.situacao || 'a_confirmar') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select></div>
      </div>
      <div class="bloco">
        <label class="rot">Quem participa</label>
        <div class="lista-pessoas">
          ${estado.pessoas.map(p => `
            <label class="pessoa-op">
              <input type="checkbox" value="${p.id}" ${jaEstao.has(p.id) ? 'checked' : ''}>
              <span class="bolinha">${esc(iniciais(p.nome || p.email))}</span>
              <span>${esc(p.nome || p.email)}</span>
            </label>`).join('')}
        </div>
      </div>
      <div class="bloco">
        <label class="rot">Observações</label>
        <textarea class="campo" id="e-desc" placeholder="Quem acompanha, o que levar, contatos">${esc(e?.descricao || '')}</textarea>
      </div>
    </div>
    <footer>
      <span></span>
      <div style="display:flex;gap:8px">
        <button class="btn sec" data-x>Cancelar</button>
        <button class="btn" id="e-salvar">${ed ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </footer>`);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);

  $('#e-salvar', m).onclick = async () => {
    const titulo = $('#e-titulo', m).value.trim();
    const inicio = $('#e-inicio', m).value;
    if (!titulo)  return toast('Dê um título ao compromisso.', true);
    if (!inicio)  return toast('Informe a data e a hora de início.', true);

    const dados = {
      titulo,
      inicio: new Date(inicio).toISOString(),
      fim: $('#e-fim', m).value ? new Date($('#e-fim', m).value).toISOString() : null,
      local: $('#e-local', m).value.trim() || null,
      cidade: $('#e-cidade', m).value.trim() || null,
      tipo: $('#e-tipo', m).value,
      situacao: $('#e-sit', m).value,
      descricao: $('#e-desc', m).value.trim()
    };

    const marcados = $$('.lista-pessoas input:checked', m).map(x => x.value);
    let idEvento = ed ? e.id : null;

    if (ed) {
      const { error } = await sb.from('eventos').update(dados).eq('id', e.id);
      if (error) return toast(error.message, true);
    } else {
      const { data: criado, error } = await sb.from('eventos')
        .insert({ ...dados, criado_por: estado.perfil.id }).select('id').single();
      if (error) return toast(error.message, true);
      idEvento = criado.id;
    }

    // acerta a lista de presentes: entra quem foi marcado, sai quem foi desmarcado
    const agora = new Set(marcados);
    const entram = marcados.filter(id => !jaEstao.has(id));
    const saem = [...jaEstao].filter(id => !agora.has(id));

    if (entram.length) {
      const { error } = await sb.from('evento_participantes')
        .insert(entram.map(pid => ({ evento_id: idEvento, profile_id: pid, nome: nomeDe(pid) })));
      if (error) toast('Compromisso salvo, mas os participantes falharam: ' + error.message, true);
    }
    if (saem.length) {
      await sb.from('evento_participantes').delete()
        .eq('evento_id', idEvento).in('profile_id', saem);
    }

    fecharModal(); toast(ed ? 'Compromisso atualizado.' : 'Compromisso adicionado.'); carregarEventos();
  };
}

/* ============================================================
   Fotos
   ============================================================ */
async function carregarFotos() {
  const { data, error } = await sb.from('fotos').select('*')
    .order('data_evento', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) return toast(error.message, true);
  estado.fotos = data || [];

  // URLs assinadas: o bucket é privado
  if (estado.fotos.length) {
    const { data: urls } = await sb.storage.from(CONFIG.BUCKET_FOTOS)
      .createSignedUrls(estado.fotos.map(f => f.storage_path), 3600);
    (urls || []).forEach(u => {
      const f = estado.fotos.find(x => x.storage_path === u.path);
      if (f) f.url = u.signedUrl;
    });
  }
  desenharFotos();
}

function desenharFotos() {
  $('#resumo-fotos').textContent = estado.fotos.length
    ? `${estado.fotos.length} foto(s) no acervo` : 'Nenhuma foto ainda';

  if (!estado.fotos.length) {
    $('#grade-fotos').innerHTML =
      '<div class="vazio" style="grid-column:1/-1"><span class="big">▣</span>Nenhuma foto enviada ainda.</div>';
    return;
  }

  $('#grade-fotos').innerHTML = estado.fotos.map(f => {
    const podeApagar = f.enviado_por === estado.perfil.id || estado.perfil.papel === 'admin';
    return `
      <div class="foto">
        <img src="${esc(f.url || '')}" alt="${esc(f.titulo || 'Foto da campanha')}" loading="lazy" data-zoom="${esc(f.url || '')}">
        <div class="info">
          <strong>${esc(f.titulo || 'Sem legenda')}</strong>
          <small>${[f.evento, f.cidade, f.data_evento ? dataBR(f.data_evento) : ''].filter(Boolean).map(esc).join(' · ') || '—'}</small>
          <div style="margin-top:7px;display:flex;gap:6px">
            <a class="btn sec mini" href="${esc(f.url || '')}" download target="_blank" rel="noopener">Baixar</a>
            ${podeApagar ? `<button class="btn sec mini" data-del-foto="${f.id}">Excluir</button>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  $$('[data-zoom]').forEach(img => img.onclick = () => {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML = `<img src="${esc(img.dataset.zoom)}" alt="">`;
    lb.onclick = () => lb.remove();
    document.body.appendChild(lb);
  });

  $$('[data-del-foto]').forEach(b => b.onclick = async () => {
    const f = estado.fotos.find(x => x.id === b.dataset.delFoto);
    if (!confirm('Excluir esta foto do acervo?')) return;
    await sb.storage.from(CONFIG.BUCKET_FOTOS).remove([f.storage_path]);
    const { error } = await sb.from('fotos').delete().eq('id', f.id);
    if (error) return toast(error.message, true);
    toast('Foto excluída.'); carregarFotos();
  });
}

$('#bt-nova-foto').onclick = () => {
  const m = abrirModal(`
    <header><h3>Enviar fotos</h3><button class="fechar" data-x>&times;</button></header>
    <div class="corpo">
      <div class="bloco">
        <label class="rot">Arquivos (pode selecionar várias)</label>
        <input class="campo" id="ft-arq" type="file" accept="image/*" multiple>
        <div style="font-size:11.5px;color:var(--texto-2);margin-top:6px">
          JPG, PNG, WEBP ou HEIC. Até 15 MB por arquivo.
        </div>
      </div>
      <div class="bloco linha-campos">
        <div><label class="rot">Evento</label>
          <input class="campo" id="ft-evento" maxlength="120" placeholder="Ex.: Caminhada na Liberdade"></div>
        <div><label class="rot">Cidade</label>
          <input class="campo" id="ft-cidade" maxlength="80" placeholder="Salvador"></div>
      </div>
      <div class="bloco linha-campos">
        <div><label class="rot">Data do evento</label>
          <input class="campo" id="ft-data" type="date" value="${new Date().toISOString().slice(0, 10)}"></div>
        <div><label class="rot">Legenda (opcional)</label>
          <input class="campo" id="ft-titulo" maxlength="140" placeholder="Aplicada a todas"></div>
      </div>
      <div id="ft-progresso" style="font-size:13px;color:var(--texto-2)"></div>
    </div>
    <footer>
      <span></span>
      <div style="display:flex;gap:8px">
        <button class="btn sec" data-x>Cancelar</button>
        <button class="btn" id="ft-enviar">Enviar</button>
      </div>
    </footer>`);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);

  $('#ft-enviar', m).onclick = async () => {
    const arquivos = Array.from($('#ft-arq', m).files || []);
    if (!arquivos.length) return toast('Escolha pelo menos uma foto.', true);

    const bt = $('#ft-enviar', m); bt.disabled = true;
    const prog = $('#ft-progresso', m);
    let ok = 0, falhas = [];

    for (let i = 0; i < arquivos.length; i++) {
      const arq = arquivos[i];
      prog.textContent = `Enviando ${i + 1} de ${arquivos.length}…`;
      const ext = (arq.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const caminho = `${estado.perfil.id}/${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: eUp } = await sb.storage.from(CONFIG.BUCKET_FOTOS)
        .upload(caminho, arq, { contentType: arq.type, upsert: false });
      if (eUp) { falhas.push(`${arq.name}: ${eUp.message}`); continue; }

      const { error: eDb } = await sb.from('fotos').insert({
        storage_path: caminho,
        titulo: $('#ft-titulo', m).value.trim() || arq.name.replace(/\.[^.]+$/, ''),
        evento: $('#ft-evento', m).value.trim() || null,
        cidade: $('#ft-cidade', m).value.trim() || null,
        data_evento: $('#ft-data', m).value || null,
        enviado_por: estado.perfil.id
      });
      if (eDb) { falhas.push(`${arq.name}: ${eDb.message}`); continue; }
      ok++;
    }

    fecharModal();
    if (ok) toast(`${ok} foto(s) enviada(s).`);
    if (falhas.length) toast(`${falhas.length} falharam. ${falhas[0]}`, true);
    carregarFotos();
  };
};

/* ============================================================
   Painel Bahia
   ============================================================ */
async function carregarIndicadores() {
  const { data, error } = await sb.from('indicadores').select('*')
    .order('ordem').order('indicador').order('ano');
  if (error) return toast(error.message, true);
  estado.indicadores = data || [];

  $('#abas-bahia').innerHTML = AREAS_BAHIA.map(a =>
    `<button data-area="${a.id}" class="${a.id === estado.areaBahia ? 'on' : ''}">${a.nome}</button>`).join('');
  $$('#abas-bahia button').forEach(b => b.onclick = () => {
    estado.areaBahia = b.dataset.area;
    $$('#abas-bahia button').forEach(x => x.classList.toggle('on', x === b));
    desenharBahia();
  });

  desenharBahia();
}

function desenharBahia() {
  estado.graficos.forEach(g => { try { g.destroy(); } catch (_) {} });
  estado.graficos = [];

  const daArea = estado.indicadores.filter(i => i.area === estado.areaBahia);

  // agrupa por nome do indicador, preservando a ordem definida no banco
  const grupos = [];
  daArea.forEach(i => {
    let g = grupos.find(x => x.nome === i.indicador);
    if (!g) { g = { nome: i.indicador, ordem: i.ordem, itens: [] }; grupos.push(g); }
    g.itens.push(i);
  });
  grupos.sort((a, b) => a.ordem - b.ordem);

  if (!grupos.length) {
    $('#grade-ind').innerHTML = '<div class="vazio" style="grid-column:1/-1">Nenhum indicador cadastrado nesta área.</div>';
    return;
  }

  $('#grade-ind').innerHTML = grupos.map((g, idx) => {
    const itens = g.itens.slice().sort((a, b) => a.ano - b.ano);
    const ultimo = itens[itens.length - 1];
    const anterior = itens[itens.length - 2];
    const base = itens[0];

    let delta = '', classe = 'neutro';
    if (anterior && ultimo.valor !== null && anterior.valor !== null && Number(anterior.valor) !== 0) {
      const v = ((Number(ultimo.valor) - Number(anterior.valor)) / Math.abs(Number(anterior.valor))) * 100;
      const subiu = v > 0;
      const bom = (ultimo.melhor === 'maior' && subiu) || (ultimo.melhor === 'menor' && !subiu);
      classe = Math.abs(v) < 0.05 ? 'neutro' : (bom ? 'bom' : 'ruim');
      delta = `${subiu ? '▲' : '▼'} ${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
    }

    let acumulado = '';
    if (base && base !== ultimo && base.valor !== null && Number(base.valor) !== 0) {
      const v = ((Number(ultimo.valor) - Number(base.valor)) / Math.abs(Number(base.valor))) * 100;
      acumulado = `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% desde ${base.ano}`;
    }

    return `
      <div class="ind">
        <div class="cab">
          <h4>${esc(g.nome)}</h4>
          <span class="selo ${ultimo.confianca}">${ultimo.confianca === 'oficial' ? 'oficial' : 'parcial'}</span>
        </div>
        <div class="un">${esc(ultimo.unidade)}</div>
        <div class="numeros">
          <span class="atual">${numeroBR(ultimo.valor, ultimo.unidade)}</span>
          <span class="ano-atual">em ${ultimo.ano}</span>
          ${delta ? `<span class="delta ${classe}">${delta}</span>` : ''}
          ${acumulado ? `<span class="ano-atual">${acumulado}</span>` : ''}
        </div>
        <canvas id="g${idx}"></canvas>
        ${ultimo.nota ? `<div class="nota">${esc(ultimo.nota)}</div>` : ''}
        <div class="fonte">
          Fonte: ${ultimo.url_fonte
            ? `<a href="${esc(ultimo.url_fonte)}" target="_blank" rel="noopener">${esc(ultimo.fonte)}</a>`
            : esc(ultimo.fonte)}
        </div>
      </div>`;
  }).join('');

  // desenha os gráficos
  grupos.forEach((g, idx) => {
    const itens = g.itens.slice().sort((a, b) => a.ano - b.ano);
    const cv = document.getElementById('g' + idx);
    if (!cv) return;
    const bom = itens[itens.length - 1].melhor;
    const primeiro = Number(itens[0].valor), ultimo = Number(itens[itens.length - 1].valor);
    const subiu = ultimo >= primeiro;
    const positivo = (bom === 'maior' && subiu) || (bom === 'menor' && !subiu);
    const cor = positivo ? '#7B2A8D' : '#c0392b';

    estado.graficos.push(new Chart(cv, {
      type: 'bar',
      data: {
        labels: itens.map(i => i.ano),
        datasets: [{
          data: itens.map(i => i.valor === null ? null : Number(i.valor)),
          backgroundColor: itens.map((_, k) =>
            k === itens.length - 1 ? cor : (positivo ? 'rgba(123,42,141,.30)' : 'rgba(192,57,43,.25)')),
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: c => `${numeroBR(c.parsed.y, itens[0].unidade)} ${itens[0].unidade}`,
              afterLabel: c => {
                const it = itens[c.dataIndex];
                return it.confianca === 'parcial' ? 'Dado parcial, conferir na fonte' : '';
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 }, color: '#7B6274' } },
          y: {
            grid: { color: 'rgba(0,0,0,.05)' },
            ticks: { font: { size: 10 }, color: '#7B6274', maxTicksLimit: 4,
                     callback: v => numeroBR(v, '') },
            beginAtZero: false
          }
        }
      }
    }));
  });
}

/* ============================================================
   Notas de discurso
   ============================================================ */
const TEMAS_SUGERIDOS = [
  'Economia', 'Emprego e renda', 'Educação', 'Saúde', 'Segurança pública',
  'Cultura', 'Mulheres', 'Juventude', 'Periferia', 'Meio ambiente',
  'Direitos humanos', 'Abertura', 'Encerramento'
];

async function carregarNotas() {
  const { data, error } = await sb.from('notas_discurso').select('*')
    .order('updated_at', { ascending: false });
  if (error) return toast(error.message, true);
  estado.notas = data || [];
  desenharNotas();
}

function temasExistentes() {
  return [...new Set(estado.notas.map(n => (n.tema || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function notasFiltradas() {
  const t = estado.buscaNotas.trim().toLowerCase();
  return estado.notas.filter(n => {
    if (estado.temaNota && (n.tema || '') !== estado.temaNota) return false;
    if (!t) return true;
    return `${n.titulo} ${n.corpo} ${n.tema || ''}`.toLowerCase().includes(t);
  });
}

// Realça o termo buscado num texto JÁ escapado.
function realca(textoEscapado) {
  const t = estado.buscaNotas.trim();
  if (!t) return textoEscapado;
  const alvo = esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return textoEscapado.replace(new RegExp(alvo, 'gi'), m => `<mark class="marca-busca">${m}</mark>`);
}

function desenharNotas() {
  const lista = notasFiltradas();
  const total = estado.notas.length;

  $('#resumo-notas').textContent = !total
    ? 'Nenhuma nota escrita ainda'
    : (lista.length === total
        ? `${total} nota(s). O texto fica disponível para toda a equipe`
        : `${lista.length} de ${total} nota(s)`);

  // opções de tema, preservando a seleção
  const sel = $('#filtro-tema');
  const temas = temasExistentes();
  sel.innerHTML = '<option value="">Todos os temas</option>'
    + temas.map(x => `<option ${estado.temaNota === x ? 'selected' : ''}>${esc(x)}</option>`).join('');

  if (!lista.length) {
    $('#grade-notas').innerHTML = total
      ? '<div class="vazio"><span class="big">✎</span>Nenhuma nota corresponde ao filtro.</div>'
      : '<div class="vazio"><span class="big">✎</span>Nenhuma nota ainda. Guarde aqui os trechos de discurso, dados e respostas prontas.</div>';
    return;
  }

  $('#grade-notas').innerHTML = lista.map(n => `
    <article class="nota" data-abre-nota="${n.id}">
      ${n.tema ? `<span class="tema">${esc(n.tema)}</span>` : ''}
      <h4>${realca(esc(n.titulo))}</h4>
      <div class="trecho">${realca(esc(n.corpo)) || '<em>Sem texto.</em>'}</div>
      <div class="pe">
        <span>${esc(nomeDe(n.autor_id))}</span>
        <span>${quandoRelativo(n.updated_at || n.created_at)}</span>
      </div>
    </article>`).join('');

  $$('[data-abre-nota]').forEach(c => c.onclick = () => abrirNota(c.dataset.abreNota));
}

$('#busca-notas').oninput = e => { estado.buscaNotas = e.target.value; desenharNotas(); };
$('#filtro-tema').onchange = e => { estado.temaNota = e.target.value; desenharNotas(); };
$('#bt-nova-nota').onclick = () => formularioNota();

function abrirNota(id) {
  const n = estado.notas.find(x => x.id === id);
  if (!n) return;
  const podeApagar = n.autor_id === estado.perfil.id || estado.perfil.papel === 'admin';

  const m = abrirModal(`
    <header>
      <h3>${esc(n.titulo)}</h3>
      <button class="fechar" data-x>&times;</button>
    </header>
    <div class="corpo">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:14px;
                  font-size:12px;color:var(--texto-2)">
        ${n.tema ? `<span class="tema">${esc(n.tema)}</span>` : ''}
        <span>${esc(nomeDe(n.autor_id))}</span>
        <span>·</span>
        <span>atualizada ${quandoRelativo(n.updated_at || n.created_at)}</span>
      </div>
      <div class="leitura">${esc(n.corpo) || '<em>Sem texto.</em>'}</div>
    </div>
    <footer>
      <button class="btn sec" id="n-copiar">Copiar texto</button>
      <div style="display:flex;gap:8px">
        ${podeApagar ? '<button class="btn sec perigo" id="n-apagar">Excluir</button>' : ''}
        <button class="btn" id="n-editar">Editar</button>
      </div>
    </footer>`, true);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);

  $('#n-copiar', m).onclick = async () => {
    try {
      await navigator.clipboard.writeText(n.corpo || '');
      toast('Texto copiado.');
    } catch {
      toast('Não foi possível copiar automaticamente. Selecione o texto e use Ctrl+C.', true);
    }
  };

  $('#n-editar', m).onclick = () => { fecharModal(); formularioNota(n); };

  if (podeApagar) $('#n-apagar', m).onclick = async () => {
    if (!confirm('Excluir esta nota? Não dá para desfazer.')) return;
    const { error } = await sb.from('notas_discurso').delete().eq('id', n.id);
    if (error) return toast(error.message, true);
    fecharModal(); toast('Nota excluída.'); carregarNotas();
  };
}

function formularioNota(n = null) {
  const ed = !!n;
  const temas = [...new Set([...temasExistentes(), ...TEMAS_SUGERIDOS])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const m = abrirModal(`
    <header>
      <h3>${ed ? 'Editar nota' : 'Nova nota de discurso'}</h3>
      <button class="fechar" data-x>&times;</button>
    </header>
    <div class="corpo">
      <div class="bloco linha-campos">
        <div>
          <label class="rot">Título</label>
          <input class="campo" id="n-titulo" maxlength="160"
                 value="${esc(n?.titulo || '')}" placeholder="Ex.: Abertura do debate na TV">
        </div>
        <div>
          <label class="rot">Tema</label>
          <input class="campo" id="n-tema" list="lista-temas" maxlength="60"
                 value="${esc(n?.tema || '')}" placeholder="Ex.: Emprego e renda">
          <datalist id="lista-temas">${temas.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
        </div>
      </div>
      <div class="bloco">
        <label class="rot">Texto</label>
        <textarea class="campo" id="n-corpo" style="min-height:300px;line-height:1.65"
          placeholder="Escreva o trecho do jeito que vai ser falado. Números e fontes ajudam na hora do debate.">${esc(n?.corpo || '')}</textarea>
        <div style="font-size:12px;color:var(--texto-2);margin-top:6px" id="n-conta">—</div>
      </div>
    </div>
    <footer>
      <span></span>
      <div style="display:flex;gap:8px">
        <button class="btn sec" data-x>Cancelar</button>
        <button class="btn" id="n-salvar">${ed ? 'Salvar' : 'Criar nota'}</button>
      </div>
    </footer>`, true);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);

  // contador de palavras e tempo estimado de fala (~130 palavras por minuto)
  const conta = () => {
    const p = $('#n-corpo', m).value.trim().split(/\s+/).filter(Boolean).length;
    const seg = Math.round(p / 130 * 60);
    $('#n-conta', m).textContent = p
      ? `${p} palavra(s) · cerca de ${seg < 60 ? seg + ' s' : Math.round(seg / 60) + ' min'} de fala`
      : '—';
  };
  $('#n-corpo', m).oninput = conta;
  conta();

  $('#n-salvar', m).onclick = async () => {
    const titulo = $('#n-titulo', m).value.trim();
    const corpo  = $('#n-corpo', m).value.trim();
    if (!titulo) return toast('Dê um título à nota.', true);
    if (!corpo)  return toast('A nota está sem texto.', true);

    const dados = { titulo, corpo, tema: $('#n-tema', m).value.trim() || null };

    const { error } = ed
      ? await sb.from('notas_discurso').update(dados).eq('id', n.id)
      : await sb.from('notas_discurso').insert({ ...dados, autor_id: estado.perfil.id });
    if (error) return toast(error.message, true);
    fecharModal(); toast(ed ? 'Nota atualizada.' : 'Nota criada.'); carregarNotas();
  };
}


/* ============================================================
   Projetos de Lei
   Fonte: dados abertos da Camara dos Deputados. So entra o que
   virou lei ou ja foi aprovado pela Camara e esta no Senado.
   ============================================================ */
const SITUACOES = { lei: 'Virou lei', senado: 'Aprovado, no Senado' };

async function carregarProjetos() {
  const { data, error } = await sb.from('projetos').select('*')
    .order('data_situacao', { ascending: false, nullsFirst: false });
  if (error) return toast(error.message, true);
  estado.projetos = data || [];
  desenharProjetos();
}

function projetosFiltrados() {
  return estado.projetos.filter(p =>
    (!estado.filtroSituacao || p.situacao === estado.filtroSituacao) &&
    (!estado.filtroAreaProj || p.area === estado.filtroAreaProj));
}

function desenharProjetos() {
  const lista = projetosFiltrados();
  const leis = estado.projetos.filter(p => p.situacao === 'lei').length;
  const sen = estado.projetos.length - leis;

  $('#resumo-projetos').textContent = estado.projetos.length
    ? `${leis} viraram lei, ${sen} aprovados e no Senado`
    : 'Nada cadastrado ainda';

  const sel = $('#filtro-area-proj');
  const areas = [...new Set(estado.projetos.map(p => p.area))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  sel.innerHTML = '<option value="">Todas as áreas</option>'
    + areas.map(a => `<option ${estado.filtroAreaProj === a ? 'selected' : ''}>${esc(a)}</option>`).join('');

  if (!lista.length) {
    $('#grade-proj').innerHTML = '<div class="vazio"><span class="big">&sect;</span>Nenhum projeto neste filtro.</div>';
    return;
  }

  $('#grade-proj').innerHTML = lista.map(p => `
    <article class="proj">
      <div class="cab">
        <span class="ref">${esc(p.tipo)} ${p.numero}/${p.ano}</span>
        <span class="selo-sit ${p.situacao}">${SITUACOES[p.situacao] || p.situacao}</span>
      </div>
      <span class="selo-area" style="align-self:flex-start">${esc(p.area)}</span>
      <p>${esc(p.ementa)}</p>
      <div class="pe">
        <span>${p.data_situacao ? dataBR(p.data_situacao) : ''}</span>
        <a href="${esc(p.url)}" target="_blank" rel="noopener">Ver na Câmara</a>
      </div>
    </article>`).join('');
}

$('#filtro-situacao').onchange = e => { estado.filtroSituacao = e.target.value; desenharProjetos(); };
$('#filtro-area-proj').onchange = e => { estado.filtroAreaProj = e.target.value; desenharProjetos(); };

/* ============================================================
   Noticias
   Uma tarefa no banco le os feeds de hora em hora e grava so
   manchete, veiculo, data e link. O texto da materia fica no portal.
   ============================================================ */
async function carregarNoticias() {
  const { data, error } = await sb.from('noticias').select('*')
    .order('publicado_em', { ascending: false, nullsFirst: false })
    .limit(300);
  if (error) return toast(error.message, true);
  estado.noticias = data || [];
  desenharNoticias();
}

function desenharNoticias() {
  const lista = estado.noticias.filter(n => !estado.filtroVeiculo || n.veiculo === estado.filtroVeiculo);

  $('#resumo-noticias').textContent = estado.noticias.length
    ? `${estado.noticias.length} matéria(s) sobre a eleição, atualizadas de hora em hora`
    : 'Nada capturado ainda';

  const sel = $('#filtro-veiculo');
  const veics = [...new Set(estado.noticias.map(n => n.veiculo))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  sel.innerHTML = '<option value="">Todos os veículos</option>'
    + veics.map(v => `<option ${estado.filtroVeiculo === v ? 'selected' : ''}>${esc(v)}</option>`).join('');

  if (!lista.length) {
    $('#lista-noticias').innerHTML = '<div class="vazio"><span class="big">&#9673;</span>Nenhuma notícia neste filtro.</div>';
    return;
  }

  $('#lista-noticias').innerHTML = lista.map(n => `
    <div class="noticia${n.figura ? ' destaque' : ''}">
      <span class="veic">${esc(n.veiculo)}</span>
      <a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.titulo)}</a>
      ${n.figura ? `<span class="selo-figura">${esc(n.figura)}</span>` : ''}
      <span class="quando">${n.publicado_em ? quandoRelativo(n.publicado_em) : ''}</span>
    </div>`).join('');
}

$('#filtro-veiculo').onchange = e => { estado.filtroVeiculo = e.target.value; desenharNoticias(); };
$('#bt-recarregar-noticias').onclick = async () => {
  const b = $('#bt-recarregar-noticias');
  b.disabled = true; b.textContent = 'Buscando…';
  await carregarNoticias();
  b.disabled = false; b.textContent = 'Recarregar';
  toast('Lista atualizada.');
};


/* ============================================================
   Entregas do Governo do Estado
   Cada item precisa de link para pagina oficial do estado.
   Selo "parcial" marca o que ainda deve ser conferido na fonte.
   ============================================================ */
async function carregarEntregas() {
  const { data, error } = await sb.from('entregas').select('*')
    .order('area').order('ano', { ascending: false, nullsFirst: false });
  if (error) return toast(error.message, true);
  estado.entregas = data || [];
  desenharEntregas();
}

function desenharEntregas() {
  const todas = estado.entregas;
  const lista = todas.filter(e =>
    (!estado.filtroAreaEnt || e.area === estado.filtroAreaEnt) &&
    (!estado.filtroAnoEnt || String(e.ano) === estado.filtroAnoEnt));

  $('#resumo-entregas').textContent = todas.length
    ? `${todas.length} entrega(s) com fonte oficial do Governo da Bahia`
    : 'Nada cadastrado ainda';

  const areas = [...new Set(todas.map(e => e.area))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('#filtro-area-ent').innerHTML = '<option value="">Todas as áreas</option>'
    + areas.map(a => `<option ${estado.filtroAreaEnt === a ? 'selected' : ''}>${esc(a)}</option>`).join('');

  const anos = [...new Set(todas.map(e => e.ano).filter(Boolean))].sort((a, b) => b - a);
  $('#filtro-ano-ent').innerHTML = '<option value="">Todos os anos</option>'
    + anos.map(a => `<option ${estado.filtroAnoEnt === String(a) ? 'selected' : ''}>${a}</option>`).join('');

  if (!lista.length) {
    $('#lista-entregas').innerHTML = '<div class="cartao"><div class="vazio">Nenhuma entrega neste filtro.</div></div>';
    return;
  }

  const grupos = {};
  lista.forEach(e => { (grupos[e.area] = grupos[e.area] || []).push(e); });

  $('#lista-entregas').innerHTML = Object.keys(grupos)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    .map(area => `
      <div class="grupo-ent">
        <h3>${esc(area)}</h3>
        <div class="cartao">
          ${grupos[area].map(e => `
            <div class="ent">
              <span class="ano">${e.ano || ''}</span>
              <div class="corpo">
                <strong>${esc(e.titulo)}${e.municipio ? ' · ' + esc(e.municipio) : ''}${e.situacao === 'em_obras' ? ' <span class="selo obras">em obras</span>' : ''}</strong>
                <p>${esc(e.descricao)}</p>
                ${e.numeros ? `<p class="numeros"><b>Números.</b> ${esc(e.numeros)}</p>` : ''}
                ${e.importa ? `<p class="importa"><b>Por que importa.</b> ${esc(e.importa)}</p>` : ''}
                <div class="rodape">
                  <a href="${esc(e.url_fonte)}" target="_blank" rel="noopener">${esc(e.fonte)}</a>
                  ${e.confianca === 'parcial' ? '<span class="selo parcial">conferir</span>' : ''}
                  ${e.nota ? '<span>' + esc(e.nota) + '</span>' : ''}
                </div>
              </div>
            </div>`).join('')}
        </div>
      </div>`).join('');
}

$('#filtro-area-ent').onchange = e => { estado.filtroAreaEnt = e.target.value; desenharEntregas(); };
$('#filtro-ano-ent').onchange = e => { estado.filtroAnoEnt = e.target.value; desenharEntregas(); };


/* ============================================================
   Demandas de liderancas
   Quem pediu, de onde veio, o que foi prometido e em que pe esta.
   ============================================================ */

const SIT_DEMANDA = {
  registrada: 'Registrada', em_analise: 'Em análise', encaminhada: 'Encaminhada',
  atendida: 'Atendida', inviavel: 'Inviável'
};

const AREAS_DEMANDA = [
  'Educação', 'Saúde', 'Infraestrutura', 'Segurança', 'Cultura',
  'Emprego e renda', 'Assistência social', 'Esporte e lazer', 'Meio ambiente'
];

const hojeISO = () => new Date().toISOString().slice(0, 10);
const demandaAberta = d => d.situacao !== 'atendida' && d.situacao !== 'inviavel';

async function carregarDemandas() {
  const { data, error } = await sb.from('demandas').select('*')
    .order('created_at', { ascending: false });
  if (error) return toast(error.message, true);
  estado.demandas = data || [];
  desenharDemandas();
}

function demandasFiltradas() {
  const b = (estado.buscaDem || '').trim().toLowerCase();
  return estado.demandas.filter(d =>
    (!estado.filtroSitDem || d.situacao === estado.filtroSitDem) &&
    (!b || [d.solicitante, d.organizacao, d.municipio, d.pedido, d.compromisso, d.area]
      .filter(Boolean).join(' ').toLowerCase().includes(b)));
}

function desenharDemandas() {
  const todas = estado.demandas || [];
  const hoje = hojeISO();
  const abertas = todas.filter(demandaAberta);
  const vencidas = abertas.filter(d => d.prazo && d.prazo < hoje).length;

  $('#resumo-demandas').textContent = todas.length
    ? `${todas.length} demanda(s), ${abertas.length} em aberto`
      + (vencidas ? `, ${vencidas} com prazo vencido` : '')
    : 'Nenhuma demanda registrada ainda';

  const sel = $('#filtro-sit-dem');
  if (sel.options.length <= 1) {
    sel.innerHTML = '<option value="">Todas as situações</option>'
      + Object.entries(SIT_DEMANDA)
          .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  }

  const lista = demandasFiltradas();
  if (!lista.length) {
    $('#grade-dem').innerHTML =
      '<div class="cartao"><div class="vazio">' + (todas.length
        ? 'Nenhuma demanda neste filtro.'
        : 'Nenhuma demanda registrada. Use o botão Nova demanda para começar.')
      + '</div></div>';
    return;
  }

  $('#grade-dem').innerHTML = lista.map(d => {
    const atrasada = d.prazo && d.prazo < hoje && demandaAberta(d);
    const origem = [d.organizacao, d.municipio].filter(Boolean).map(esc).join(' · ');
    const prazo = d.prazo
      ? (atrasada ? 'venceu em ' : 'prazo ') + dataBR(d.prazo)
      : 'sem prazo';
    return `
      <div class="dem" data-id="${d.id}">
        <div class="cab">
          <div>
            <div class="quem">${esc(d.solicitante)}</div>
            <div class="onde">${origem || 'Origem não informada'}</div>
          </div>
          <span class="sit-dem ${d.situacao}">${SIT_DEMANDA[d.situacao]}</span>
        </div>
        <p class="pedido">${esc(d.pedido)}</p>
        ${d.compromisso ? `<div class="promessa"><b>Compromisso.</b> ${esc(d.compromisso)}</div>` : ''}
        <div class="pe">
          <span>${d.area ? esc(d.area) + ' · ' : ''}prioridade ${PRIORIDADES[d.prioridade].toLowerCase()}</span>
          <span${atrasada ? ' style="color:var(--vermelho);font-weight:600"' : ''}>${prazo}</span>
        </div>
      </div>`;
  }).join('');

  $$('#grade-dem .dem').forEach(el => {
    el.onclick = () => abrirDemanda(el.dataset.id);
  });
}

function abrirDemanda(id) {
  const d = estado.demandas.find(x => String(x.id) === String(id));
  if (!d) return;
  const podeApagar = d.criado_por === estado.perfil.id || estado.perfil.papel === 'admin';
  const ev = d.evento_id ? (estado.eventos || []).find(x => x.id === d.evento_id) : null;
  const atrasada = d.prazo && d.prazo < hojeISO() && demandaAberta(d);

  const item = (rot, val) => val
    ? `<div style="margin-bottom:12px">
         <div class="rot">${rot}</div>
         <div style="font-size:14px;line-height:1.55">${val}</div>
       </div>`
    : '';

  const m = abrirModal(`
    <header>
      <h3>${esc(d.solicitante)}</h3>
      <button class="fechar" data-x>&times;</button>
    </header>
    <div class="corpo">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;
                  font-size:12px;color:var(--texto-2)">
        <span class="sit-dem ${d.situacao}">${SIT_DEMANDA[d.situacao]}</span>
        ${d.area ? `<span class="tema">${esc(d.area)}</span>` : ''}
        <span>prioridade ${PRIORIDADES[d.prioridade].toLowerCase()}</span>
        <span>·</span>
        <span>registrada ${quandoRelativo(d.created_at)}</span>
      </div>

      ${item('Origem', [d.organizacao, d.municipio].filter(Boolean).map(esc).join(' · '))}
      ${item('Contato', esc(d.contato || ''))}
      ${item('O que foi pedido', `<div class="leitura">${esc(d.pedido)}</div>`)}
      ${item('O que foi prometido', d.compromisso
          ? `<div class="promessa">${esc(d.compromisso)}</div>` : '')}
      ${item('Responsável', d.responsavel_id ? esc(nomeDe(d.responsavel_id)) : '')}
      ${item('Prazo', d.prazo
          ? `<span style="${atrasada ? 'color:var(--vermelho);font-weight:600' : ''}">${dataBR(d.prazo)}${atrasada ? ' (vencido)' : ''}</span>` : '')}
      ${item('Compromisso da agenda', ev ? esc(ev.titulo) : '')}

      <div class="bloco" style="margin-top:4px">
        <label class="rot">Mudar a situação</label>
        <select class="campo" id="d-sit">
          ${Object.entries(SIT_DEMANDA).map(([k, v]) =>
            `<option value="${k}" ${d.situacao === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
      </div>
    </div>
    <footer>
      <div style="display:flex;gap:8px">
        <button class="btn sec" id="d-editar">Editar</button>
        ${podeApagar ? '<button class="btn perigo" id="d-apagar">Excluir</button>' : ''}
      </div>
      <button class="btn" data-x>Fechar</button>
    </footer>`, true);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);

  $('#d-sit', m).onchange = async e => {
    const { error } = await sb.from('demandas')
      .update({ situacao: e.target.value }).eq('id', d.id);
    if (error) return toast(error.message, true);
    const selo = $('.sit-dem', m);
    selo.className = 'sit-dem ' + e.target.value;
    selo.textContent = SIT_DEMANDA[e.target.value];
    d.situacao = e.target.value;
    toast('Situação atualizada.');
    carregarDemandas();
  };

  $('#d-editar', m).onclick = () => { fecharModal(); formularioDemanda(d); };

  if (podeApagar) $('#d-apagar', m).onclick = async () => {
    if (!confirm('Excluir esta demanda? Não dá para desfazer.')) return;
    const { error } = await sb.from('demandas').delete().eq('id', d.id);
    if (error) return toast(error.message, true);
    fecharModal(); toast('Demanda excluída.'); carregarDemandas();
  };
}

function formularioDemanda(d = null) {
  const ed = !!d;
  const pessoas = (estado.pessoas || []).filter(p => p.aprovado);
  const eventos = (estado.eventos || [])
    .filter(e => e.situacao !== 'cancelado')
    .slice(0, 60);
  const areas = [...new Set([...AREAS_DEMANDA,
    ...(estado.demandas || []).map(x => x.area).filter(Boolean)])]
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

  const m = abrirModal(`
    <header>
      <h3>${ed ? 'Editar demanda' : 'Nova demanda'}</h3>
      <button class="fechar" data-x>&times;</button>
    </header>
    <div class="corpo">
      <div class="bloco linha-campos">
        <div>
          <label class="rot">Quem pediu</label>
          <input class="campo" id="d-solicitante" maxlength="120"
                 value="${esc(d?.solicitante || '')}" placeholder="Ex.: Dona Marlene, do bairro">
        </div>
        <div>
          <label class="rot">Organização</label>
          <input class="campo" id="d-org" maxlength="120"
                 value="${esc(d?.organizacao || '')}" placeholder="Associação, sindicato, igreja">
        </div>
      </div>

      <div class="bloco linha-campos">
        <div>
          <label class="rot">Município ou bairro</label>
          <input class="campo" id="d-municipio" maxlength="90"
                 value="${esc(d?.municipio || '')}" placeholder="Ex.: Ilhéus">
        </div>
        <div>
          <label class="rot">Contato</label>
          <input class="campo" id="d-contato" maxlength="120"
                 value="${esc(d?.contato || '')}" placeholder="Telefone ou e-mail">
        </div>
      </div>

      <div class="bloco">
        <label class="rot">O que foi pedido</label>
        <textarea class="campo" id="d-pedido" rows="4"
                  placeholder="Descreva o pedido com as palavras de quem pediu">${esc(d?.pedido || '')}</textarea>
      </div>

      <div class="bloco">
        <label class="rot">O que a campanha prometeu</label>
        <textarea class="campo" id="d-compromisso" rows="3"
                  placeholder="Deixe em branco se nada foi prometido">${esc(d?.compromisso || '')}</textarea>
      </div>

      <div class="bloco linha-campos">
        <div>
          <label class="rot">Área</label>
          <input class="campo" id="d-area" list="lista-areas-dem" maxlength="60"
                 value="${esc(d?.area || '')}" placeholder="Ex.: Saúde">
          <datalist id="lista-areas-dem">
            ${areas.map(a => `<option value="${esc(a)}">`).join('')}
          </datalist>
        </div>
        <div>
          <label class="rot">Prioridade</label>
          <select class="campo" id="d-prioridade">
            ${Object.entries(PRIORIDADES).map(([k, v]) =>
              `<option value="${k}" ${(d?.prioridade || 'media') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="bloco linha-campos">
        <div>
          <label class="rot">Situação</label>
          <select class="campo" id="d-situacao">
            ${Object.entries(SIT_DEMANDA).map(([k, v]) =>
              `<option value="${k}" ${(d?.situacao || 'registrada') === k ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="rot">Prazo</label>
          <input class="campo" id="d-prazo" type="date" value="${d?.prazo || ''}">
        </div>
      </div>

      <div class="bloco linha-campos">
        <div>
          <label class="rot">Responsável</label>
          <select class="campo" id="d-resp">
            <option value="">Sem responsável</option>
            ${pessoas.map(p =>
              `<option value="${p.id}" ${d?.responsavel_id === p.id ? 'selected' : ''}>${esc(p.nome || p.email)}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="rot">Surgiu em qual compromisso</label>
          <select class="campo" id="d-evento">
            <option value="">Nenhum</option>
            ${eventos.map(e =>
              `<option value="${e.id}" ${d?.evento_id === e.id ? 'selected' : ''}>${esc(e.titulo)} (${dataBR(e.inicio)})</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <footer>
      <span style="font-size:12px;color:var(--texto-2)">Quem pediu e o pedido são obrigatórios</span>
      <div style="display:flex;gap:8px">
        <button class="btn sec" data-x>Cancelar</button>
        <button class="btn" id="d-salvar">${ed ? 'Salvar' : 'Registrar demanda'}</button>
      </div>
    </footer>`, true);

  $$('[data-x]', m).forEach(b => b.onclick = fecharModal);

  $('#d-salvar', m).onclick = async () => {
    const solicitante = $('#d-solicitante', m).value.trim();
    const pedido = $('#d-pedido', m).value.trim();
    if (!solicitante) return toast('Diga quem fez o pedido.', true);
    if (!pedido) return toast('Descreva o que foi pedido.', true);

    const dados = {
      solicitante,
      pedido,
      organizacao: $('#d-org', m).value.trim() || null,
      municipio: $('#d-municipio', m).value.trim() || null,
      contato: $('#d-contato', m).value.trim() || null,
      compromisso: $('#d-compromisso', m).value.trim() || null,
      area: $('#d-area', m).value.trim() || null,
      prioridade: $('#d-prioridade', m).value,
      situacao: $('#d-situacao', m).value,
      prazo: $('#d-prazo', m).value || null,
      responsavel_id: $('#d-resp', m).value || null,
      evento_id: $('#d-evento', m).value || null
    };

    const { error } = ed
      ? await sb.from('demandas').update(dados).eq('id', d.id)
      : await sb.from('demandas').insert(dados);
    if (error) return toast(error.message, true);
    fecharModal();
    toast(ed ? 'Demanda atualizada.' : 'Demanda registrada.');
    carregarDemandas();
  };
}

$('#bt-nova-demanda').onclick = () => formularioDemanda();
$('#busca-demandas').oninput = e => { estado.buscaDem = e.target.value; desenharDemandas(); };
$('#filtro-sit-dem').onchange = e => { estado.filtroSitDem = e.target.value; desenharDemandas(); };
