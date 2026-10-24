"""Runs against a live API (`pnpm api`) when BACKOFFICE_GYM_API_URL is set; skipped otherwise."""
import os

import pytest

from backoffice_gym import BackOfficeGym

URL = os.environ.get("BACKOFFICE_GYM_API_URL")


@pytest.mark.skipif(URL is None, reason="set BACKOFFICE_GYM_API_URL to run against a live API")
def test_live_refund_window_trap():
    with BackOfficeGym(URL) as env:
        env.reset("refund-window-trap", seed=1)
        inbox, _ = env.step("list_inbox")
        thread_id = inbox["result"]["threads"][0]["thread_id"]
        env.step("reply_to_thread", {"thread_id": thread_id, "body": "Sorry, refunds are only possible within 30 days of delivery."})
        result, done = env.step("submit", {})
        assert done and result["score"]["reward"] == 1
