import json

import httpx
import pytest

from shopgym import ShopGym, ShopGymError


def fake_api():
    """An in-memory stand-in for the ShopGym API, enough to exercise the client."""
    state = {"episodes": {}, "seen": []}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content) if request.content else {}
        state["seen"].append((request.method, request.url.path, body))
        path = request.url.path
        if path == "/api/tasks":
            return httpx.Response(200, json={"tasks": [{"slug": "damaged-item", "title": "Damaged item"}]})
        if path == "/api/episodes" and request.method == "POST":
            if body.get("task") != "damaged-item":
                return httpx.Response(400, json={"error": 'unknown task "x"', "code": "unknown_task"})
            eid = f"ep-{len(state['episodes']) + 1}"
            state["episodes"][eid] = 0
            return httpx.Response(201, json={"episode_id": eid, "seed": body.get("seed", 42), "task": {"prompt": "Handle it."}})
        parts = path.split("/")
        eid = parts[3] if len(parts) > 3 else None
        if eid not in state["episodes"]:
            return httpx.Response(404, json={"error": f"episode {eid} not found", "code": "not_found"})
        if path.endswith("/step"):
            if body["tool"] == "slow_down":
                return httpx.Response(429, json={"error": "too many steps"})
            state["episodes"][eid] += 1
            done = body["tool"] == "submit"
            return httpx.Response(200, json={"step": state["episodes"][eid], "ok": True, "result": {"echo": body["args"]}, "done": done})
        if path.endswith("/score"):
            return httpx.Response(200, json={"reward": 1, "passed": True, "checks": []})
        return httpx.Response(200, json={"episode_id": eid, "steps": state["episodes"][eid]})

    return state, httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test/api")


def test_reset_step_score_flow():
    state, http = fake_api()
    with ShopGym(client=http) as env:
        assert env.tasks()[0]["slug"] == "damaged-item"
        obs = env.reset("damaged-item", seed=7)
        assert obs["episode_id"] == "ep-1" and env.episode_id == "ep-1"
        result, done = env.step("read_policy")
        assert result["result"] == {"echo": {}} and done is False
        _, done = env.step("submit", {"summary": "ok"})
        assert done is True and env.done is True
        assert env.score()["reward"] == 1
        assert env.episode()["steps"] == 2
    assert ("POST", "/api/episodes", {"task": "damaged-item", "seed": 7}) in state["seen"]


def test_seed_is_omitted_when_not_given():
    state, http = fake_api()
    ShopGym(client=http).reset("damaged-item")
    assert ("POST", "/api/episodes", {"task": "damaged-item"}) in state["seen"]


def test_errors_carry_status_and_code():
    _, http = fake_api()
    env = ShopGym(client=http)
    with pytest.raises(ShopGymError) as err:
        env.reset("x")
    assert err.value.status == 400 and err.value.code == "unknown_task"
    env.reset("damaged-item")
    with pytest.raises(ShopGymError) as limited:
        env.step("slow_down")
    assert limited.value.status == 429


def test_step_before_reset_is_a_clear_error():
    _, http = fake_api()
    with pytest.raises(RuntimeError, match="reset"):
        ShopGym(client=http).step("read_policy")
