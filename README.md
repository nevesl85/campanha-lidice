# Campanha Lídice da Mata: área de trabalho da equipe

Aplicação web estática (HTML + JS puro, sem build) apoiada no Supabase para login, banco de dados,
armazenamento de fotos e atualização em tempo real. Publicada via GitHub Pages.

## Módulos

| Módulo | O que faz |
|---|---|
| **Tarefas** | Kanban em quatro colunas, arrastar e soltar, responsável, prazo, prioridade e frente de trabalho. Cada tarefa tem chat de comentários que atualiza em tempo real para todos os logados. |
| **Agenda** | Compromissos com data, hora, local, cidade, tipo, situação e lista de participantes escolhidos entre os cadastrados. Compromisso cumprido ou cancelado continua visível, com o registro de quem esteve presente. Botão *Assinar no celular* gera um link secreto por pessoa que o calendário do telefone lê sozinho. |
| **Demandas** | Registro do que as lideranças pedem: quem pediu, organização, município, contato, o pedido nas palavras da pessoa, o que a campanha prometeu, área, prioridade, prazo, responsável e o compromisso da agenda em que o pedido surgiu. Situação em cinco estágios, da entrada ao atendimento. |
| **Território** | Votação nominal de 2022 por município, cruzada com onde a agenda está indo e de onde vêm as demandas. Aponta os municípios que deram voto e ainda não aparecem na agenda. |
| **Fotos** | Envio múltiplo para um bucket privado. Visualização em grade com ampliação e download. |
| **Notas de discurso** | Trechos de fala, dados e respostas prontas, organizados por tema. Busca no texto, contador de palavras com estimativa de tempo de fala e botão de copiar. |
| **Projetos de Lei** | Proposições da deputada que viraram norma ou foram aprovadas, direto dos dados abertos da Câmara, classificadas nas áreas do Painel Bahia. |
| **Notícias** | Coleta automática de hora em hora nos feeds do Metrópoles, Bahia Notícias, A Tarde e Correio, filtrada por assunto eleitoral. Matérias que citam o Governador, os candidatos ao Senado ou a deputada ganham etiqueta de destaque. |
| **Entregas do Estado** | Grandes obras e serviços entregues pelo Governo da Bahia nos últimos doze anos, com o que é, números, por que importa e link para a fonte oficial. |
| **Painel Bahia** | Indicadores oficiais de economia, emprego e renda, educação, saúde, segurança pública e cultura, com série dos últimos anos, variação, gráfico e link para a fonte. |
| **Equipe** | Só para administradores. Libera ou bloqueia o acesso de cada pessoa e define o papel. |

### Alerta de prazo

Uma faixa fixa no topo, acima de qualquer tela, junta tarefas e demandas que vencem hoje ou já
venceram. Fica amarela quando é só o vencimento de hoje e vermelha quando há atraso. Cada item leva
direto à ficha. O menu lateral mostra a contagem ao lado de *Tarefas* e *Demandas*.

## Papéis

- **admin**: tudo, incluindo liberar contas e trocar papéis.
- **candidata**: tudo, mais permissão de editar os indicadores do Painel Bahia.
- **equipe**: tarefas, comentários, agenda, demandas, fotos e notas; lê os painéis.

## Como se entra

Nome, e-mail e senha. Só isso. A conta nasce bloqueada e um administrador libera em *Equipe*.

Não há login pelo Google. Foi considerado e descartado: exigiria um projeto no Google Cloud e um
cliente OAuth só para poupar a equipe de criar uma senha. O gatilho `handle_new_user` no banco já
sabe ler o formato de metadados do Google, então, se um dia essa conta existir, religar é rápido.

O primeiro administrador é semeado na tabela `admins_iniciais`: quem se cadastrar com o e-mail
listado ali nasce como **admin** já aprovado. Hoje consta `neves.l@gmail.com`.

## Segurança

Os dados são protegidos por *Row Level Security* no Postgres, não pelo front-end. A chave que aparece
em `config.js` é a chave publicável do Supabase. Ela é pública por natureza e não dá acesso a nada
sozinha. Cada consulta é avaliada no banco contra o usuário autenticado.

- Nenhuma linha é legível por quem não está logado.
- Quem está logado mas não foi liberado não lê nada.
- Só o autor de uma tarefa, comentário, evento, foto ou demanda, ou um administrador, pode excluí-los.
- Um usuário comum não consegue se auto-promover a admin nem se auto-liberar: um gatilho no banco
  descarta essas alterações.
- O bucket de fotos é privado; as imagens são servidas por URL assinada com validade de uma hora.

### O link da agenda

O calendário do celular não sabe enviar cabeçalho de autorização, então a agenda assinável usa um
token secreto na própria URL. Cada pessoa tem o seu, guardado em `assinaturas_agenda`, e pode trocar
por um novo a qualquer momento, o que derruba o anterior. Quem perder o acesso à equipe também perde
o feed: a função confere se o perfil continua aprovado antes de responder. O link dá acesso de
leitura à agenda inteira, então não deve ser repassado.

## Paleta

Tirada do material de campanha. Vive toda em variáveis CSS no topo do `index.html`. Trocar uma
linha ali repinta o sistema inteiro.

| Papel | Cor | Onde aparece |
|---|---|---|
| Magenta | `#B81E7C` | Barra lateral, botões, marca |
| Magenta claro | `#D62C90` | Foco de campo, links, avatares |
| Rosa clara | `#FCE7F3` | Fundos de destaque, avisos |
| Amarelo | `#F7CE17` | Acentos: sublinhado dos títulos, aba ativa, avatar, grafismo |
| Roxo | `#7B2A8D` | Variação positiva nos gráficos e pastilhas |
| Fundo | `#FBF5F8` | Papel de fundo, levemente rosado |
| Texto | `#2B1226` / `#7B6274` | Corpo e apoio, em ameixa em vez de cinza |

O asterisco amarelo do cartaz virou o favicon e o grafismo do canto da tela de entrada.
Vermelho segue reservado para erro e prazo vencido. É a única cor fora da paleta, e é de propósito.

## Estrutura

```
index.html         marcação e estilos
app.js             toda a lógica
config.js          endereço e chave publicável do Supabase
lidice-banner.jpg  foto da campanha, hoje sem uso: a faixa de Tarefas ficou só com as cores
.nojekyll          impede o GitHub Pages de processar os arquivos como Jekyll
```

Funções no Supabase:

```
agenda-ics     serve a agenda em formato de calendário, autenticada pelo token do link
tse-votacao    desativada; carregou a tabela votacao_2022 a partir dos arquivos do TSE
tse-amostra    desativada; serviu para inspecionar o formato dos arquivos do TSE
```

## Publicação

No ar em **https://nevesl85.github.io/campanha-lidice/**, servido pelo GitHub Pages a partir da
raiz do branch `main` em `github.com/nevesl85/campanha-lidice`. Commitar na `main` republica o site
em cerca de um minuto.

No Supabase, *Authentication → URL Configuration* já aponta para esse endereço, e a confirmação
por e-mail está **desligada**. O controle de entrada é a aprovação do administrador em *Equipe*,
não o e-mail. Se um dia configurar SMTP próprio, vale religar a confirmação.

## Manutenção

**Trocar de projeto Supabase:** edite apenas `config.js`.

**Atualizar os indicadores da Bahia:** os dados vivem na tabela `indicadores`. Cada linha tem `area`,
`indicador`, `unidade`, `ano`, `valor`, `melhor` (`maior` ou `menor`, direção desejável), `fonte`,
`url_fonte`, `confianca` (`oficial` ou `parcial`), `nota` e `ordem`. Adicionar um ano novo é inserir
uma linha; o gráfico e a variação se ajustam sozinhos.

**Sobre o selo "parcial":** marca números que vieram de veículos que citam o órgão oficial, ou de
estimativas, em vez do documento primário. Antes de usar um desses em debate, vale conferir no link
da fonte.

**Notícias:** a coleta roda de hora em hora por `pg_cron`, chamando a função `buscar_noticias()`. Os
feeds ficam na tabela `fontes_noticias`. O filtro combina termos fortes (eleição, pleito, urna),
combinações de nome de figura com contexto político e uma lista de vetos para barrar homônimos.

**Votação de 2022:** a tabela `votacao_2022` guarda, por município, os votos nominais da candidata e
o total de votos válidos para deputado federal, com o percentual. Veio de dois arquivos oficiais do
TSE, `votacao_candidato_munzona_2022` e `detalhe_votacao_munzona_2022`, do
[Portal de Dados Abertos](https://dadosabertos.tse.jus.br/dataset/resultados-2022). São zips de
centenas de megabytes, então a carga não baixou os arquivos inteiros: leu o índice do zip e puxou
por faixa de bytes apenas o CSV da Bahia. O código está no histórico da função `tse-votacao`.
Para 2026, é repetir com os arquivos do ano novo.
