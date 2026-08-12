/* ============================================================
   Atualizar sem precisar fechar o app

   Ate aqui os dados so eram buscados uma vez, dentro de iniciar().
   Quem deixava o app aberto ficava vendo a agenda e as demandas
   de horas atras. O botao flutuante refaz todas as buscas, e a
   atualizacao tambem acontece sozinha quando o app volta do
   segundo plano.
   ============================================================ */
let atualizando = false;
let ultimaAtualizacao = Date.now();

// Selects que sao remontados a cada carga. Sem repor o valor, a caixa
// volta a mostrar "Todos" enquanto a lista continua filtrada.
const FILTROS_SELECT = [
  ['#filtro-resp',      'filtroResp'],
  ['#filtro-coord',     'filtroCoord'],
  ['#filtro-sit-dem',   'filtroSitDem'],
  ['#filtro-tema',      'temaNota'],
  ['#filtro-situacao',  'filtroSituacao'],
  ['#filtro-area-proj', 'filtroAreaProj'],
  ['#filtro-veiculo',   'filtroVeiculo'],
  ['#filtro-area-ent',  'filtroAreaEnt'],
  ['#filtro-ano-ent',   'filtroAnoEnt']
];

function reporFiltros() {
  FILTROS_SELECT.forEach(([seletor, chave]) => {
    const el = $(seletor);
    const valor = estado[chave];
    if (!el || !valor) return;
    if (Array.from(el.options).some(o => o.value === valor)) el.value = valor;
    else { estado[chave] = ''; el.value = ''; }
  });
}

// O canal de tempo real do Supabase cai quando o celular manda o app
// para segundo plano. Sem religar, nem as tarefas chegam mais sozinhas.
function religarEscuta() {
  if (estado.canalTarefas) {
    try { sb.removeChannel(estado.canalTarefas); } catch (_) {}
    estado.canalTarefas = null;
  }
  escutarTarefas();
}

async function atualizarTudo(avisar = true) {
  if (atualizando) return;
  if (!estado.perfil || !estado.perfil.aprovado) return;

  atualizando = true;
  const bt = $('#bt-atualizar');
  if (bt) { bt.classList.add('girando'); bt.disabled = true; }

  try {
    await carregarPessoas();
    await Promise.all([
      carregarTarefas(), carregarEventos(), carregarFotos(),
      carregarNotas(), carregarProjetos(), carregarNoticias(),
      carregarEntregas(), carregarDemandas(), carregarTerritorio(),
      carregarProcessos(), carregarIndicadores()
    ]);
    reporFiltros();
    religarEscuta();
    ultimaAtualizacao = Date.now();
    if (avisar) toast('Tudo atualizado.');
  } catch (_) {
    if (avisar) toast('Não deu para atualizar agora. Confira a conexão.', true);
  } finally {
    atualizando = false;
    if (bt) { bt.classList.remove('girando'); bt.disabled = false; }
  }
}

if ($('#bt-atualizar')) $('#bt-atualizar').onclick = () => atualizarTudo(true);

// Volta do segundo plano: atualiza em silencio. A folga de 30 segundos
// evita refazer tudo a cada troca rapida de aplicativo.
function atualizarAoVoltar() {
  if (document.visibilityState !== 'visible') return;
  if (Date.now() - ultimaAtualizacao < 30000) return;
  atualizarTudo(false);
}

document.addEventListener('visibilitychange', atualizarAoVoltar);
window.addEventListener('pageshow', e => { if (e.persisted) atualizarAoVoltar(); });
