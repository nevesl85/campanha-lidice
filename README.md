# Campanha Lídice da Mata — área de trabalho da equipe

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

- **admin** — tudo, incluindo liberar contas e trocar papéis.
- **candidata** — tudo, mais permissão de editar os indicadores do Painel Bahia.
- **equipe** — tarefas, comentários, agenda, fotos e notas de discurso; lê o Painel Bahia.

O primeiro administrador é semeado na tabela `admins_iniciais`: quem se cadastrar com o e-mail
listado ali nasce como **admin** já aprovado. Hoje consta `neves.l@gmail.com`.

Toda conta nova nasce **bloqueada**. Um administrador precisa liberar em *Equipe*. Isso impede que
qualquer pessoa que descubra o endereço do site entre nos dados da campanha.

## Segurança

Os dados são protegidos por *Row Level Security* no Postgres, não pelo front-end. A chave que aparece
em `config.js` é a chave publicável do Supabase — ela é pública por natureza e não dá acesso a nada
sozinha. Cada consulta é avaliada no banco contra o usuário autenticado.

- Nenhuma linha é legível por quem não está logado.
- Quem está logado mas não foi liberado não lê nada.
- Só o autor de uma tarefa, comentário, evento ou foto — ou um administrador — pode excluí-los.
- Um usuário comum não consegue se auto-promover a admin nem se auto-liberar: um gatilho no banco
  descarta essas alterações.
- O bucket de fotos é privado; as imagens são servidas por URL assinada com validade de uma hora.

## Estrutura

```
index.html   marcação e estilos
app.js       toda a lógica
config.js    endereço e chave publicável do Supabase
.nojekyll    impede o GitHub Pages de processar os arquivos como Jekyll
```

## Publicação

1. Crie o repositório no GitHub.
2. Suba estes arquivos na raiz do `main`.
3. Em *Settings → Pages*, escolha `Deploy from a branch`, branch `main`, pasta `/ (root)`.
4. No painel do Supabase, em *Authentication → URL Configuration*, adicione o endereço do
   GitHub Pages em **Site URL** e em **Redirect URLs**.

## Manutenção

**Trocar de projeto Supabase:** edite apenas `config.js`.

**Atualizar os indicadores da Bahia:** os dados vivem na tabela `indicadores`. Cada linha tem `area`,
`indicador`, `unidade`, `ano`, `valor`, `melhor` (`maior` ou `menor`, direção desejável), `fonte`,
`url_fonte`, `confianca` (`oficial` ou `parcial`), `nota` e `ordem`. Adicionar um ano novo é inserir
uma linha; o gráfico e a variação se ajustam sozinhos.

**Sobre o selo "parcial":** marca números que vieram de veículos que citam o órgão oficial, ou de
estimativas, em vez do documento primário. Antes de usar um desses em debate, vale conferir no link
da fonte.
