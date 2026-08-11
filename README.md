# Campanha Lídice da Mata: área de trabalho da equipe

Aplicação web estática (HTML + JS puro, sem build) apoiada no Supabase para login, banco de dados,
armazenamento de fotos e atualização em tempo real. Publicada via GitHub Pages.

## Módulos

| Módulo | O que faz |
|---|---|
| **Tarefas** | Kanban em quatro colunas, arrastar e soltar, responsável, prazo, prioridade e frente de trabalho. Cada tarefa tem chat de comentários que atualiza em tempo real para todos os logados. |
| **Agenda** | Compromissos da campanha com data, hora, local, cidade, tipo e situação (confirmado / a confirmar). Separa automaticamente o que ainda vai acontecer do que já passou. |
| **Fotos** | Envio múltiplo para um bucket privado. Visualização em grade com ampliação e download. |
| **Notas de discurso** | Trechos de fala, dados e respostas prontas, organizados por tema. Busca no texto, contador de palavras com estimativa de tempo de fala e botão de copiar. |
| **Painel Bahia** | Indicadores oficiais de economia, emprego e renda, educação, saúde, segurança pública e cultura, com série dos últimos anos, variação, gráfico e link para a fonte. |
| **Equipe** | Só para administradores. Libera ou bloqueia o acesso de cada pessoa e define o papel. |

## Papéis

- **admin**: tudo, incluindo liberar contas e trocar papéis.
- **candidata**: tudo, mais permissão de editar os indicadores do Painel Bahia.
- **equipe**: tarefas, comentários, agenda, fotos e notas de discurso; lê o Painel Bahia.

## Como se entra

Nome, e-mail e senha. Só isso. A conta nasce bloqueada e um administrador libera em *Equipe*.

Não há login pelo Google. Foi considerado e descartado: exigiria um projeto no Google Cloud e um
cliente OAuth só para poupar a equipe de criar uma senha. O gatilho `handle_new_user` no banco já
sabe ler o formato de metadados do Google, então, se um dia essa conta existir, religar é rápido.

O primeiro administrador é semeado na tabela `admins_iniciais`: quem se cadastrar com o e-mail
listado ali nasce como **admin** já aprovado. Hoje consta `neves.l@gmail.com`.

Toda conta nova nasce **bloqueada**. Um administrador precisa liberar em *Equipe*. Isso impede que
qualquer pessoa que descubra o endereço do site entre nos dados da campanha.

## Segurança

Os dados são protegidos por *Row Level Security* no Postgres, não pelo front-end. A chave que aparece
em `config.js` é a chave publicável do Supabase. Ela é pública por natureza e não dá acesso a nada
sozinha. Cada consulta é avaliada no banco contra o usuário autenticado.

- Nenhuma linha é legível por quem não está logado.
- Quem está logado mas não foi liberado não lê nada.
- Só o autor de uma tarefa, comentário, evento ou foto, ou um administrador, pode excluí-los.
- Um usuário comum não consegue se auto-promover a admin nem se auto-liberar: um gatilho no banco
  descarta essas alterações.
- O bucket de fotos é privado; as imagens são servidas por URL assinada com validade de uma hora.

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
lidice-banner.jpg  foto da campanha usada como marca d'água na faixa de Tarefas
app.js       toda a lógica
config.js    endereço e chave publicável do Supabase
.nojekyll    impede o GitHub Pages de processar os arquivos como Jekyll
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
