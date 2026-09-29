# WCR Pessoas

Sistema de RH da WCR Saneamento em Next.js, React, TypeScript e Tailwind CSS. Roda no computador e compartilha dados e documentos pelo mesmo projeto Supabase. Preparado para publicação futura na Vercel.

## Estado da entrega

- Interface, formulários, SQL, importador e exportações implementados.
- Sem configuração do Supabase, o aplicativo abre uma demonstração identificada com dados fictícios. A demonstração permite consultar telas e formulários, mas não salva informações.
- Nenhum documento real nem cadastro da planilha de Santos foi enviado para a nuvem.
- O banco compartilhado, o login real e os uploads dependem da criação e conexão do seu projeto. O envio e download no Storage precisam ser validados nessa conexão.

## 1. Criar o projeto gratuito

1. Entre em https://supabase.com/dashboard e crie sua conta.
2. Crie uma organização e um projeto no plano **Free**. Use uma região próxima aos usuários.
3. Guarde a senha do banco em um gerenciador de senhas. Não coloque essa senha no código nem no chat.
4. No **SQL Editor**, execute uma vez todo o arquivo `supabase/migrations/001_wcr.sql` em um projeto novo. Ele cria as tabelas, funções, regras de acesso e o bucket privado `wcr-documents` numa transação.
5. Em **Authentication → Providers → Email**, desative novos cadastros públicos. O sistema não tem tela de cadastro de contas.
6. Em **Authentication → Users → Add user**, crie seu usuário de e-mail e senha. Se houver a opção, confirme o e-mail administrativamente.
7. Copie o UUID do usuário e execute no SQL Editor, substituindo o texto pelo UUID real:

```sql
insert into public.wcr_members (user_id)
values ('UUID-DO-USUARIO');
```

Somente usuários incluídos em `wcr_members` acessam pessoas e documentos. Ser autenticado no Supabase, por si só, não concede acesso. Todos os membros WCR têm as mesmas permissões. Cadastre os demais usuários da equipe da mesma forma. Nunca abra as tabelas ou o bucket para acesso público.

## 2. Conectar e executar

Instale Node.js 22 LTS ou superior compatível. Abra um terminal nesta pasta:

```powershell
npm install
Copy-Item .env.example .env.local
```

Em **Project Settings → API / API Keys**, copie a URL e a chave **publishable** (ou a chave legada **anon**, se aplicável). Preencha `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SUA-CHAVE-PUBLICA
```

Essas duas variáveis são públicas por definição: a proteção dos dados está nas políticas RLS e na lista de membros. **Nunca use `service_role`, secret key ou senha do banco nessas variáveis.** `.env.local` está excluído do Git.

```powershell
npm run dev
```

Abra http://127.0.0.1:3000 e entre com o usuário criado. Para outro computador, instale este mesmo repositório, preencha as mesmas duas variáveis e entre com um usuário autorizado. O banco e os arquivos serão compartilhados. É necessário acesso à internet. O programa escuta apenas no próprio computador por padrão.

Para executar uma versão compilada:

```powershell
npm run build
npm start
```

Não execute `next build` simultaneamente com o servidor de desenvolvimento usando o mesmo diretório `.next`.

## 3. Começar a operação

1. Crie um **contrato**, com nome, cliente e localização.
2. Personalize o **modelo de checklist**: vínculo CLT/PJ/Estágio, função, orientação, ordem e aplicabilidade. O catálogo inicial reúne os modelos enviados; revise as exigências antes de usar em um contrato real.
3. Crie as **equipes** e funções. Informe a previsão de vagas e ajuste quando necessário.
4. Cadastre ou importe **pessoas**. Nome e CPF são obrigatórios para novos cadastros manuais; telefone é opcional. Pessoas importadas sem CPF ficam identificadas para preenchimento posterior.
5. Crie um **vínculo** com contrato, função, CLT/PJ/Estágio e equipes. É possível cadastrar a pessoa diretamente nesse formulário.
6. Abra a **admissão** e acompanhe os itens e documentos.

Uma pessoa tem um vínculo por contrato e pode participar de várias equipes desse contrato. Em outros contratos, o status, a função e o checklist são independentes. Alterações nos modelos valem imediatamente para os vínculos existentes. As marcações dos itens mantidos são preservadas; documentos e marcações de itens desativados podem ser consultados no histórico do checklist. O sistema nunca muda o status da pessoa com base no checklist.

### Situações

- Pessoa no contrato: Pendente, Em admissão, Ativo ou Removido. Sempre manual.
- Item: Pendente, Recebido, Enviado ao cliente, Aprovado, Recusado ou Não se aplica.
- Recusa exige motivo. A equipe WCR registra a resposta recebida do cliente; o sistema não envia mensagens nem concede acesso ao cliente.
- O progresso conta itens aprovados ou não aplicáveis. Arquivos enviados não geram aprovação automática.
- Uma pessoa removida permanece na base. Seu vínculo deixa de ocupar vagas. A retirada de uma equipe é feita editando o vínculo.

### Planilha de Santos

Em **Pessoas → Importar**, selecione o arquivo original `.xlsx`. O importador lê a primeira aba, reconhece o cabeçalho abaixo da primeira linha e mostra uma prévia.

- `OK` na coluna CPF é situação do documento, não o número do CPF.
- `OK` vira Recebido. `NSA` vira Não se aplica. Aprovação do cliente não é presumida.
- Escolha um contrato para importar funções, equipes e checklists. Sem contrato, os registros entram no banco de candidatos.
- Vínculos importados começam como Pendente. As vagas começam com previsão zero e devem ser ajustadas.
- Numeração de bota, blusa, calça, VT, e-mail e observações são preservados. O texto do cargo é preservado, inclusive eventuais informações de PJ/remuneração.
- CPFs duplicados ou inválidos são bloqueados na prévia. Nomes sem CPF já encontrados também ficam para conferência. Cadastros existentes não são sobrescritos.
- Marcações sem item compatível no modelo escolhido ficam registradas nas observações.
- A confirmação salva todas as linhas selecionadas em uma transação: um erro desfaz a importação inteira.
- Limites de leitura: 10 MB e 10.000 linhas. O botão de modelo gera uma planilha vazia com as colunas aceitas.

### Documentos

- PDF, JPG, PNG e WebP. Até 50 MB por arquivo, conforme o plano gratuito atual.
- Vários anexos por item. Novos envios preservam os anteriores.
- Bucket privado. Visualização usa links válidos por cinco minutos; não compartilhe esses links.
- Download individual ou ZIP por admissão. ZIP no navegador limitado a 200 MB por operação; acima disso, use downloads individuais.
- Excluir um arquivo exige confirmação na interface e é permanente. Isso não altera o status do item.
- Se um envio múltiplo falhar após alguns arquivos, os que já foram concluídos permanecem listados. Reenvie apenas os que faltarem.

## 4. Publicar na Vercel no futuro

1. Suba o projeto para um repositório privado, sem `.env.local`, arquivos de funcionários ou dumps do banco.
2. Importe o repositório na Vercel como Next.js.
3. Configure as mesmas duas variáveis `NEXT_PUBLIC_SUPABASE_*` no ambiente de produção.
4. Use `npm run build` como comando de build. O diretório de saída permanece no padrão do Next.js.
5. Configure a URL publicada em Authentication → URL Configuration no Supabase para futuros fluxos de e-mail. O login por senha atual não depende de callback.
6. Confirme que o cadastro público está desativado, que o bucket permanece privado e que usuários não autorizados não conseguem ler os dados.
7. Faça um teste com usuário interno e arquivo fictício: cadastrar pessoa, criar vínculo, enviar PDF, visualizar, baixar e excluir o arquivo de teste.

O banco e o Storage permanecem no Supabase. Nenhum arquivo depende do disco da Vercel. O plano Hobby da Vercel não é apropriado ao uso comercial da WCR; avalie o Pro ou outra hospedagem antes de publicar. Este projeto não foi publicado.

## Custos e comparação com Firebase

Rodar o código no seu computador elimina a mensalidade de hospedagem, mas não elimina os limites dos serviços de nuvem.

- **Supabase Free:** 500 MB de banco, 1 GB de arquivos e franquias de transferência. Arquivo individual de até 50 MB. Projetos gratuitos podem ser pausados após inatividade. Confira o painel de uso e os preços atuais.
- **Supabase Pro:** a partir de US$ 25/mês, com franquias maiores e possíveis custos adicionais por uso.
- **Firebase:** Firestore guarda dados estruturados e Cloud Storage guarda arquivos. O Cloud Storage exige Blaze, com conta de faturamento vinculada, inclusive para começar a usar as franquias gratuitas aplicáveis. O valor depende de região, armazenamento, operações e transferência.
- **Recomendação para WCR:** Supabase, porque as relações entre pessoas, contratos, funções, equipes e checklists se encaixam diretamente no PostgreSQL. O plano Free permite começar com arquivos sem contratar Blaze. Gratuidade depende do volume; não há promessa de armazenamento ilimitado.

Fontes oficiais consultadas:

- https://supabase.com/pricing
- https://supabase.com/docs/guides/storage/uploads/file-limits
- https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- https://firebase.google.com/docs/firestore/pricing
- https://vercel.com/docs/plans/hobby

## Cópias de segurança

O repositório contém o programa, não os dados. Exportar a lista de pessoas para Excel não é backup completo. Mantenha cópias do banco e dos objetos do Storage separadamente. Consulte as opções de exportação do Supabase e guarde essas cópias em local restrito. Backups de banco não contêm automaticamente os arquivos do Storage. Teste restauração antes de depender de uma cópia.

## Validação e estrutura

```powershell
npm test
npm run check
npm run build
```

Os testes usam PostgreSQL local via PGlite com schemas mínimos simulando Auth e Storage para validar migrações, políticas de acesso, vínculos, importação e transações. Não substituem o teste final no projeto real do Supabase.

- `app/`: página, identidade visual e configuração Next.js.
- `components/`: telas e formulários em React, estilizados com Tailwind no JSX.
- `lib/model.ts`: regras de checklist, vagas, CPF e catálogo inicial.
- `lib/supabase.ts`: conexão e operações de dados.
- `lib/imports.ts`, `lib/exports.ts`: Excel e PDF.
- `supabase/migrations/001_wcr.sql`: estrutura e regras de acesso.
- `tests/`: verificações de regras e banco.

O carregamento busca dados paginados no Supabase e filtra no navegador para o porte inicial. Para milhares de pessoas e muitos documentos, mova filtros e paginação para consultas específicas antes de ampliar a operação. Edição simultânea do mesmo cadastro segue a última alteração salva; não há histórico de auditoria nesta versão, conforme o escopo.
