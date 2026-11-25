# Expedição — Noite Encanto · GUT Gestão

App web próprio (HTML + JavaScript puro, sem build) para o cronograma de capacidade produtiva da
**Expedição / Suporte Embalagem** da Noite Encanto. Banco no Supabase (projeto **PROJETOS**, esquema `noite_encanto`, tabelas `exp_*`).
É separado do app noiteencanto.gutgestao.com.br: tem link e acessos próprios, só usa o mesmo projeto Supabase.

## Telas
| Menu | Quem vê | O que faz |
|---|---|---|
| Painel | gerência | % produtivo do dia por operador × meta, por horário, últimos dias, pendências e pausas (atualiza a cada minuto) |
| Cronograma do dia / Meu dia | gerência e operador | O operador marca Realizada/Pendente, a quantidade (lotes, peças, fardos) e as pausas. A gerência vê qualquer operador e data |
| Montar cronograma | gerência | Horários do dia, atividades de cada horário e quais operadores fazem cada uma |
| Histórico | gerência | Um registro por dia (finalizado ou aberto) com o % e o detalhe de cada operador; exportação CSV |
| Cadastros e acessos | gerência | Operadores e metas, atividades e tempo padrão, jornada/almoço e quem entra no app |

O operador entra direto no "Meu dia", sem menu.

**Finalizar o dia** (final da tela "Cronograma do dia", gerência): guarda o dia em `noite_encanto.exp_dias` e trava novos lançamentos
(reabrir pelo mesmo lugar). Se o cronograma foi alterado no dia, pergunta se a alteração vira o novo padrão
(`exp_cronograma_padrao`) ou se amanhã volta o cronograma anterior. No dia seguinte o formulário vem zerado.

**% produtivo** = tempo padrão produzido (quantidade × tempo padrão, ou o tempo da tarefa fixa realizada) ÷ (minutos dos horários trabalhados − pausas).

## Dados
- Tabelas `noite_encanto.exp_*`: setores, operadores, atividades, horarios, horario_itens, item_operadores, lancamentos, pausas, acessos. Tudo separado por `setor_id`.
- O lançamento guarda hora, janela e tempo padrão da época, para o histórico não mudar quando o cronograma mudar.
- O site só usa as funções `public.noite_encanto_exp_*`. O operador só lança as próprias tarefas e só no dia de hoje; cronograma e cadastros só a gerência.
- Migrações no Supabase: `noite_encanto_expedicao_tabelas` e `noite_encanto_expedicao_funcoes`.

## Liberar uma pessoa
1. A gerência abre **Cadastros e acessos** → "Quem tem acesso", informa e-mail, perfil (Operador ou Gerência) e, se for operador, qual operador ele é.
2. A pessoa abre o app, toca em **Criar conta** com o mesmo e-mail e confirma pelo link.
Os administradores de `noite_encanto.acessos` já entram como gerência.

## Segurança
No site existe **apenas a chave publicável** do Supabase. Nunca colocar a chave secreta/service_role no repositório.

## Publicar uma alteração
Rodar `python3 ferramentas/versao.py` antes de cada commit que mude `js/` ou `css/` (carimba a versão no `index.html`).
