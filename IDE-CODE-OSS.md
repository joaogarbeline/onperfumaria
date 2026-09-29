# Executar no Code-OSS

Abra o workspace:

```bash
code-oss onperfumaria.code-workspace
```

No Code-OSS, pressione `Ctrl+Shift+B` e escolha `Site: executar` se a tarefa
não iniciar automaticamente. O ambiente usa Docker e não exige Node.js, Go ou
PostgreSQL instalados diretamente no computador.

Serviços locais:

- Site com atualização automática: http://localhost:5173
- API: http://localhost:8080
- Verificação da API: http://localhost:8080/health

Tarefas disponíveis em **Terminal > Executar tarefa**:

- `Site: executar`: inicia os containers, aguarda os serviços e abre o navegador.
- `Site: verificar`: testa frontend e API.
- `Site: logs`: acompanha os logs dos três serviços.
- `Site: status`: mostra o estado dos containers.
- `Site: parar`: encerra os containers sem apagar o banco local.

Na primeira execução, o Docker baixa as imagens e as dependências, então ela é
mais demorada. As execuções seguintes reutilizam os volumes de cache.

Os dados de desenvolvimento ficam em volumes Docker separados dos serviços de
produção. A tarefa `Site: parar` não remove esses volumes.
