# Reserva de Salones — UCU DevOps Lab

Aplicación web (usable desde el celular) para consultar qué salones están libres y reservarlos a nombre de un alumno o de un grupo. Corre en el cluster de Kubernetes del laboratorio (namespace del equipo) con URL propia, y se despliega mediante una pipeline de Jenkins.

**Equipo:** team1 · **Proyecto 2** del laboratorio de Kubernetes.

## Stack

| Componente | Tecnología |
|---|---|
| Frontend | React + Vite (build servido por Nginx) |
| Backend | Node.js + Express |
| Base de datos | SQLite (better-sqlite3), archivo en volumen persistente |
| Infra | Kubernetes (Ingress) + Jenkins (CI/CD) + Docker Hub |

## Estructura

```
backend/     API Express + SQLite + tests (node:test + supertest)
frontend/    App React + Vite (6 vistas)
k8s/         Manifests de Kubernetes (namespace, pvc, deployments, ingress)
docs/        Documento de arquitectura (con diagramas Mermaid)
Jenkinsfile  Pipeline CI/CD
docker-compose.yml  Entorno local (backend + frontend + volumen)
```

## Correr en local

```bash
# Backend (puerto 3000)
cd backend
npm install
npm test          # 10 tests, incluye concurrencia y solapamiento
npm start

# Frontend (puerto 5173, proxea /api al backend)
cd frontend
npm install
npm run dev
```

O todo junto con Docker:

```bash
docker compose up --build
# App en http://localhost:8080
```

## Funcionalidad

### Roles
- **Alumno**: ingresa su nombre (sin contraseña), busca disponibilidad, reserva a nombre propio o de un grupo, ve y cancela sus reservas.
- **Administración**: ingresa una clave (`ADMIN_PASSWORD`, por defecto `admin123` en local), carga/edita/borra salones, ve y cancela cualquier reserva y consulta estadísticas agregadas.

### Vistas (frontend)
1. **Login** — selector de rol.
2. **Disponibilidad** — por día y franja horaria, muestra salones libres y permite reservar (propia o de grupo).
3. **Salones** — listado con capacidad y equipamiento.
4. **Calendario semanal** — grilla de 7 días × franjas de 60 min con estado por celda (libre/parcial/lleno).
5. **Mis reservas** — ver y cancelar las propias.
6. **Administración** — CRUD de salones, todas las reservas, panel de stats.

### Regla de no solapamiento
Las franjas son de 60 min (08:00–22:00). Cada reserva ocupa N filas en la tabla `reservation_slots`, con restricción `UNIQUE(room_id, date, slot)` insertadas en una transacción. Si dos personas reservan el mismo salón en el mismo segundo, **solo una** obtiene la reserva; la otra recibe `409 Conflict`. Cubierto por tests.

### Persistencia
La base SQLite vive en `/app/data/app.db`, montada sobre un PVC (`salones-data`). Si el pod o la base se reinicia, los datos siguen ahí.

## API

```
POST   /api/auth/role               login por rol -> JWT
GET    /api/slots                   rango de franjas
GET    /api/rooms                   salones
GET    /api/availability?date=&start=&end=   disponibilidad
POST   /api/reservations            crear reserva
GET    /api/reservations/mine       reservas propias
DELETE /api/reservations/:id        cancelar (propia o admin)
POST   /api/admin/rooms             crear salón (admin)
PUT    /api/admin/rooms/:id         editar salón (admin)
DELETE /api/admin/rooms/:id         borrar salón (admin)
GET    /api/admin/reservations      todas las reservas (admin)
GET    /api/admin/stats             stats agregados (admin)
```

## Despliegue

### 1. Configurar el equipo
El nombre del equipo, el host y el usuario de Docker Hub viven en **`k8s/config.env`** (fuente única de verdad). La pipeline lo lee en la etapa *Load config*, así que no hay que repetir valores en el `Jenkinsfile`.

Antes de desplegar, revisá:
- `k8s/config.env`: `NAMESPACE`, `INGRESS_HOST`, `DOCKERHUB_USER`, `BACKEND_IMAGE`, `FRONTEND_IMAGE`.
- `k8s/*.yaml`: deben reflejar los mismos valores (namespace, host del Ingress, imágenes).
- `k8s/01-secret.yaml`: cambiar `JWT_SECRET` y `ADMIN_PASSWORD`.

### 2. Requisitos de Jenkins
En el Jenkins del laboratorio:
- Plugin **Docker Pipeline** y agentes con `docker` y `kubectl`.
- Credenciales:
  - `dockerhub-credentials` (username/password de Docker Hub).
  - `kubeconfig-ucu` (archivo kubeconfig del equipo, kind *Secret file*).
- Crear un job tipo **Pipeline from SCM** apuntando a este repositorio, rama `main`.
- La pipeline (`Jenkinsfile`) corre: **Load config** (`source` de `k8s/config.env`) → tests → build/push a Docker Hub (tag = commit) → `kubectl apply` + `set image` + `rollout status`. Nada de `kubectl` a mano.

### 3. Ejecutar manualmente (opcional)
```bash
export KUBECONFIG=$HOME/.kube/ucu.yaml
kubectl apply -f k8s/
```

## Documentación
Ver [`docs/arquitectura.md`](docs/arquitectura.md): arquitectura, diagramas, decisiones y estado final.
