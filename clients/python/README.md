# backoffice-gym (Python client)

```python
from backoffice_gym import BackOfficeGym

with BackOfficeGym("http://127.0.0.1:8787") as env:      # start the API with `pnpm api`
    obs = env.reset("refund-window-trap", seed=7)
    print(obs["task"]["prompt"])
    result, done = env.step("read_policy")
    ...
    result, done = env.step("submit", {"summary": "declined per policy"})
    print(result["score"]["reward"])
```

Tests: `uv run pytest` (the live test runs only when `BACKOFFICE_GYM_API_URL` is set).
