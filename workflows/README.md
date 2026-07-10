# workflows/

Workflows de **n8n** como código TypeScript (`.workflow.ts`), sincronizados con la instancia n8n Cloud mediante `n8n-as-code` / `./n8nac-skills`.

## Estructura

```
workflows/
├── README.md                                           ← este archivo (tracked)
└── desarrolladorfirplak_cloud_desarrolladorfirplak_ /  ← gitignored, sincronizado
    └── personal/
        ├── .n8n-state.json           hashes de sync por workflow
        ├── tsconfig.json             config TS local de la carpeta
        └── *.workflow.ts             fuentes autoritativas
```

> El nombre de la subcarpeta (con espacio final) corresponde al `instanceIdentifier` en `n8nac-instance.json`. **No renombrar**: lo usa la herramienta para resolver la ruta de sync.

## Reglas

- **Editar solo** los `.workflow.ts` dentro de `.../personal/`.
- No duplicar estos archivos en `.agents/workflows/` (esa carpeta es para workflows de Antigravity en `.md`, no n8n).
- Antes de crear o modificar un nodo, seguir el protocolo del `CLAUDE.md` (§ Mandatory Research Protocol): `./n8nac-skills search` → `get` → aplicar schema → `validate`.
- Commits: la subcarpeta está en `.gitignore`; los cambios no se versionan aquí. Se versionan al hacer push a n8n Cloud vía `n8nac-skills`.

## Referencias

- Guía completa en `CLAUDE.md` (sección "Expert n8n Workflow Engineer").
- Para skills/workflows de Antigravity (`.md`), ver [`.agents/workflows/`](../.agents/workflows/).
