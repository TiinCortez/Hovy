# Convenciones de Uso de GitFlow — Proyecto Hovy

> Última actualización: 30/08/2026


## 1. Objetivo

**Idea central:** lo que está en `main` es lo que se despliega a producción (lo que usa la empresa). Nada llega a `main` sin pasar por revisión y sin que el CI (chequeos automáticos) esté en verde.


## 2. Modelo de ramas (GitFlow ligero)

```
main (producción — protegida)
 │
 ├── develop (integración del sprint — protegida)
 │     ├── feat/US-001-registrar-cliente
 │     ├── feat/US-022-sugerir-asignacion
 │     └── fix/US-043-boton-pagado
 │
 └── hotfix/... (solo errores graves en producción)
```

| Rama | Para qué sirve | ¿Push directo? | ¿Cómo se actualiza? |
| - | - | - | - |
| `main` | Producción. Siempre estable y desplegable | NO | Solo mediante Pull Request desde `develop` o `hotfix` |
| `develop` | Integra todo el trabajo del sprint | NO | Solo mediante Pull Request desde ramas de trabajo |
| `feat/...` | Una historia de usuario por rama | Sí | La crea cada desarrollador desde `develop` |
| `fix/...` | Corrección de errores dentro del sprint | Sí | Igual que `feat` |
| `hotfix/...` | Error grave en producción, corrección urgente | Sí | Sale de `main` y vuelve a `main` y `develop` |



## 3. Nomenclatura de ramas

Las ramas de trabajo **siempre** se nombran según la historia de Jira:

```
feat/US-001-registrar-cliente
feat/US-022-sugerir-asignacion-turnos
fix/US-043-boton-pagado
chore/sprint-0-bootstrap
hotfix/error-login-produccion
```

Reglas:

- Prefijo según el tipo: `feat/` (nueva funcionalidad), `fix/` (corrección), `chore/` (infraestructura/ajustes), `hotfix/` (urgencia en producción).

- Después del prefijo va el **código de la historia** (`US-001`) y un nombre corto en minúsculas separado por guiones.

- **Una rama = una historia.** Si la historia se complica, se habla con el equipo; no se mezclan historias en una misma rama.


## 4. Commits

- **Mensajes cortos y descriptivos**, en imperativo: `feat: registrar cliente`, `fix: validar teléfono duplicado`.

- Se puede referenciar el código de Jira al final: `feat: registrar cliente (HOVY-12)`.

- **Un commit = un cambio lógico.** No commitear "todo junto" al final del día; commitear en pasos pequeños.

- No commitear: `.env`, `node_modules`, archivos de build, archivos personales. (tengo que cubrirlo en el `.gitignore`.)


## 5. Flujo de trabajo diario (paso a paso)

**1. Antes de empezar a trabajar, traer la última versión de `develop`:**

```
git checkout develop
git pull origin develop
```

**2. Crear la rama de la historia:**

```
git checkout -b feat/US-001-registrar-cliente
```

**3. Trabajar y commitear en pasos pequeños:**

```
git add .
git commit -m "feat: registrar cliente (HOVY-12)"
```

**4. Subir la rama a GitHub la primera vez:**

```
git push -u origin feat/US-001-registrar-cliente
```

**5. Cuando la historia está terminada y probada localmente:**

- Ir a GitHub → **Pull Request** (base: `develop` ← compare: `feat/US-001-registrar-cliente`)

- Completar la descripción con qué se hizo y cómo se probó

- **Avisar a un compañero** para que la revise (el autor nunca se revisa a sí mismo)

**6. Mientras espera la revisión, el autor arranca otra rama desde `develop` actualizado.**

**7. Si la rama queda atrasada respecto de `develop`** (otro compañero mergeó algo), actualizarla antes del merge:

```
git checkout feat/US-001-registrar-cliente
git pull origin develop
```


## 6. Pull Requests (PR)

Reglas obligatorias:

1. **Base siempre `develop`** (o `main` solo para hotfixes y cierres de sprint).

2. **El CI debe estar en verde** (lint + tests automáticos) — si está rojo, no se mergea.

3. **Al menos 1 revisión de otro integrante.** La revisión busca errores, no aprobar por compromiso.

4. El **autor del PR hace el merge** cuando la revisión está aprobada y el CI pasó.

5. Después del merge, **borrar la rama** (GitHub lo ofrece con un botón).

6. PRs chicos y enfocados. Un PR gigante es difícil de revisar y concentra errores.


## 7. Cierre de sprint

Al final de cada sprint:

1. Verificar que todo lo del sprint esté mergeado a `develop`.

2. Probar en conjunto que `develop` esté estable.

3. Crear PR de `develop` → `main`.

4. Mergear y **crear un tag de versión**:

```
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Sprint 1 - Clientes e inmuebles"
git push origin v1.0.0
```

> `main` con su tag = entregable del sprint. El despliegue automático a producción escucha a `main`.


## 8. Hotfix (emergencia en producción)

Cuando hay un error grave en lo que usa la empresa:

```
git checkout main
git checkout -b hotfix/error-login-produccion
# corregir, commitear, pushear
git push -u origin hotfix/error-login-produccion
```

- El PR del hotfix va a `main` **y también a `develop`** (para que la corrección quede en ambos lados).

- Se despliega con prioridad y después se revisa con calma.


## 9. Qué NO hacer (errores comunes)

- **Nunca pushear directo a `main` ni a `develop`.** Siempre por PR.

- No mergear un PR sin revisión o con el CI en rojo.

- No dejar ramas viejas sin borrar.

- No commitear secretos (contraseñas, claves de API) — el `.env` nunca se sube.

- No usar `git add .` a ciegas: revisar qué se agrega (`git status`).

- No "arreglar a mano" en `main` o `develop` desde GitHub web sin PR.


## 10. Comandos útiles

```
git status                      # qué cambió
git log --oneline -10           # últimos commits
git checkout develop            # cambiar de rama
git branch -a                   # ver todas las ramas
git pull origin develop         # actualizar rama actual con develop
git push origin rama            # subir commits de la rama
git branch -d nombre-rama       # borrar rama local (después del merge)
```


## 11. Roles y responsabilidades

- **Todo integrante:** sigue estas convenciones, revisa PRs de compañeros y mantiene sus ramas limpias.

- **Scrum Master:** vela por que el flujo se cumpla y resuelve dudas de Git.

- **DevOps:** administra el repo (protección de ramas, CI/CD, tags) y el despliegue a producción.

