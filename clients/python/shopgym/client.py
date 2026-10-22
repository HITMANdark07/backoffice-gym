"""HTTP client for the ShopGym RL API (spec §6)."""
from __future__ import annotations

from typing import Any

import httpx


class ShopGymError(Exception):
    """The API answered with an error status."""

    def __init__(self, status: int, message: str, code: str | None = None) -> None:
        super().__init__(f"{status}: {message}")
        self.status = status
        self.message = message
        self.code = code


class ShopGym:
    """Gymnasium-style client: reset() a task, step() tools, score() the episode."""

    def __init__(self, base_url: str = "http://127.0.0.1:8787", *, timeout: float = 30.0, client: httpx.Client | None = None) -> None:
        self._http = client or httpx.Client(base_url=base_url.rstrip("/") + "/api", timeout=timeout)
        self.episode_id: str | None = None
        self.done = False

    def __enter__(self) -> ShopGym:
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def close(self) -> None:
        self._http.close()

    def tasks(self) -> list[dict[str, Any]]:
        return self._request("GET", "/tasks")["tasks"]

    def reset(self, task: str, seed: int | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {"task": task}
        if seed is not None:
            payload["seed"] = seed
        obs = self._request("POST", "/episodes", payload)
        self.episode_id = obs["episode_id"]
        self.done = False
        return obs

    def step(self, tool: str, args: dict[str, Any] | None = None) -> tuple[dict[str, Any], bool]:
        result = self._request("POST", f"/episodes/{self._require_episode()}/step", {"tool": tool, "args": args or {}})
        self.done = bool(result["done"])
        return result, self.done

    def score(self) -> dict[str, Any]:
        return self._request("POST", f"/episodes/{self._require_episode()}/score", {})

    def episode(self) -> dict[str, Any]:
        return self._request("GET", f"/episodes/{self._require_episode()}")

    def _require_episode(self) -> str:
        if self.episode_id is None:
            raise RuntimeError("call reset() first")
        return self.episode_id

    def _request(self, method: str, path: str, json: dict[str, Any] | None = None) -> dict[str, Any]:
        response = self._http.request(method, path, json=json)
        try:
            body = response.json()
        except ValueError:
            body = {"error": response.text}
        if response.status_code >= 400:
            raise ShopGymError(response.status_code, str(body.get("error", "request failed")), body.get("code"))
        return body
