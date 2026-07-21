# Contributing to FinFlow

Thank you for your interest in contributing to FinFlow! This guide will help you get started.

---

## Development Setup

### Prerequisites

- **Go** 1.24+ ([download](https://go.dev/dl/))
- **Node.js** 20+ ([download](https://nodejs.org))
- **Python** 3.11+ ([download](https://python.org))
- **Docker** & Docker Compose ([download](https://docker.com))
- **Git** ([download](https://git-scm.com))

### Quick Start

```bash
# 1. Fork and clone
git clone https://github.com/YOUR_USERNAME/finflow.git
cd finflow

# 2. Set up environment
cp .env.example .env
# Edit .env with your credentials (see Environment Setup below)

# 3. Start infrastructure
docker compose up postgres redis -d

# 4. Start API
cd api
go mod tidy
go run ./cmd/main.go

# 5. Start ML Service (new terminal)
cd ml-service
pip install -r requirements.txt
python main.py

# 6. Start Frontend (new terminal)
cd frontend
npm install
npm run dev
```

### Environment Setup

You'll need these services configured:

| Service | Free Tier | Purpose |
|---------|-----------|---------|
| [Supabase](https://supabase.com) | ✅ | Authentication |
| [Lemon Squeezy](https://lemonsqueezy.com) | ✅ | Billing (optional) |
| [OpenAI](https://platform.openai.com) | Credits | AI Copilot (optional) |

Minimum viable `.env`:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finflow
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-change-in-production-64-chars-minimum-length!!
ML_API_KEY=dev-ml-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:3000
```

---

## Project Structure

```
finflow/
├── api/                     # Go API server
│   ├── cmd/main.go          # Entry point + route definitions
│   ├── internal/
│   │   ├── aiops/           # Self-healing AIOps subsystem
│   │   ├── config/          # Environment configuration
│   │   ├── db/              # PostgreSQL repositories
│   │   ├── handlers/        # HTTP handlers
│   │   ├── middleware/       # Auth, CSRF, rate limiting
│   │   ├── models/          # Shared data types
│   │   └── services/        # Business logic services
│   └── tests/               # Stress tests
│
├── frontend/                # Next.js 14 frontend
│   ├── app/                 # Pages (App Router)
│   ├── components/          # React components
│   ├── lib/                 # Utilities, auth, constants
│   └── tests/               # Playwright E2E tests
│
├── ml-service/              # Python ML service
│   ├── main.py              # FastAPI entry point
│   ├── models/              # Pydantic schemas
│   ├── routes/              # API endpoints
│   ├── services/            # ML models (categorizer, forecaster)
│   └── tests/               # Unit tests
│
├── infra/                   # Infrastructure
│   ├── db/migrations/       # SQL migrations
│   └── nginx/               # Reverse proxy config
│
└── docs/                    # Documentation
```

---

## Code Standards

### Go (API)

```go
// Follow standard Go conventions
// - gofmt for formatting (run before commit)
// - go vet for static analysis
// - Short variable names in small scopes, descriptive in large
// - Error handling: always check errors, use fmt.Errorf with %w

// Good:
if err != nil {
    return fmt.Errorf("fetching transactions: %w", err)
}

// Bad:
if err != nil {
    return err  // loses context
}
```

**Run before commit:**
```bash
cd api
gofmt -w .
go vet ./...
go test ./... -count=1
```

### TypeScript (Frontend)

```typescript
// Follow Next.js conventions
// - Use 'use client' for client components
// - Prefer server components when possible
// - Use Tailwind CSS for styling
// - Name files in kebab-case: metric-card.tsx
// - Export components as default: export default MetricCard

// Components should be self-contained
// with props interface defined above the component
interface MetricCardProps {
  title: string
  value: number
  trend?: 'up' | 'down'
}

export default function MetricCard({ title, value, trend }: MetricCardProps) {
  // ...
}
```

**Run before commit:**
```bash
cd frontend
npm run lint
npm run build
```

### Python (ML Service)

```python
# Follow PEP 8
# - Type hints on all function signatures
# - Docstrings for public functions
# - Use Pydantic models for request/response validation
# - Keep services stateless where possible

def categorize(descriptions: list[str]) -> list[str]:
    """Classify transaction descriptions into categories."""
    if not descriptions:
        return []
    # ...
```

**Run before commit:**
```bash
cd ml-service
python -m pytest tests/ -v
```

---

## Pull Request Process

### 1. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feat/` — New features
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `refactor/` — Code refactoring (no behavior change)
- `test/` — Adding or updating tests

### 2. Make Changes

- Keep changes focused (one feature/fix per PR)
- Write tests for new functionality
- Update documentation if adding public APIs or features

### 3. Verify

```bash
# API
cd api && go vet ./... && go test ./... -count=1

# Frontend
cd frontend && npm run lint && npm run build

# ML Service
cd ml-service && python -m pytest tests/ -v
```

### 4. Commit

Write clear, descriptive commit messages:

```
feat(api): add batch transaction export endpoint

- Add GET /api/v1/transactions/export endpoint
- Supports CSV and JSON formats
- Includes date range and category filters
- Caches results for 5 minutes
```

Format: `<type>(<scope>): <description>`

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`

### 5. Open PR

- Title should be concise and descriptive
- Include a summary of changes
- Reference any related issues
- Ensure CI passes before requesting review

---

## Testing

### Go API Tests

```bash
cd api
go test ./... -v                    # Run all tests
go test ./internal/handlers/...     # Run specific package
go test -bench=. ./internal/middleware/...  # Run benchmarks
```

### Python ML Tests

```bash
cd ml-service
python -m pytest tests/ -v          # Run all tests
python -m pytest tests/test_categorizer.py -v  # Run specific file
```

### Frontend E2E Tests

```bash
cd frontend
npx playwright install --with-deps chromium  # Install browser
npx playwright test                             # Run tests
npx playwright test --ui                        # Open test UI
```

### Writing Tests

**Go handler test example:**
```go
func TestGetTransactions(t *testing.T) {
    router := setupTestRouter()
    
    w := httptest.NewRecorder()
    req, _ := http.NewRequest("GET", "/api/v1/transactions?page=1&limit=10", nil)
    req.AddCookie(&http.Cookie{Name: "finflow_access_token", Value: validJWT})
    
    router.ServeHTTP(w, req)
    
    assert.Equal(t, 200, w.Code)
    
    var resp map[string]interface{}
    json.Unmarshal(w.Body.Bytes(), &resp)
    assert.NotNil(t, resp["data"])
}
```

**Python test example:**
```python
def test_classify_known_description():
    result = categorize(["AWS Monthly Bill"])
    assert len(result) == 1
    assert result[0] in VALID_CATEGORIES
```

---

## Architecture Decisions

When contributing, respect these architectural principles:

1. **Separation of concerns** — Each service has a single responsibility
2. **Defense in depth** — Security is layered, not centralized
3. **Fail gracefully** — Services degrade gracefully when dependencies are unavailable
4. **Stateless where possible** — API and ML service are stateless; Redis holds ephemeral state
5. **Plan-gated features** — New features should respect the free/pro/max tier model

---

## Common Tasks

### Adding a New API Endpoint

1. Define the handler in `api/internal/handlers/`
2. Add the route in `api/cmd/main.go`
3. Add middleware (auth, CSRF, rate limit) as needed
4. Write tests in `api/internal/handlers/`
5. Update `docs/API.md`

### Adding a New Frontend Page

1. Create the page in `frontend/app/`
2. Use the `(dashboard)` layout group for authenticated pages
3. Add navigation link in `components/layout/sidebar.tsx`
4. Ensure responsive design
5. Add loading and error states

### Adding a New ML Feature

1. Add Pydantic schemas in `ml-service/models/schemas.py`
2. Implement the service in `ml-service/services/`
3. Add the route in `ml-service/routes/`
4. Register the router in `ml-service/main.py`
5. Write tests in `ml-service/tests/`

### Adding a New Migration

1. Create `infra/db/migrations/005_your_migration.sql`
2. Use `CREATE TABLE IF NOT EXISTS` for idempotency
3. Add indexes for query patterns
4. Update `docs/Architecture.md` schema section

---

## Getting Help

- **Issues**: Check existing issues before creating new ones
- **Discussions**: Use GitHub Discussions for questions
- **Code Review**: All PRs require review before merge

---

## Code of Conduct

- Be respectful and constructive
- Focus on the code, not the person
- Welcome newcomers and help them learn
- Give credit where it's due

---

## License

By contributing to FinFlow, you agree that your contributions will be licensed under the MIT License.
