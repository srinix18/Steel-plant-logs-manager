import pytest

from tests.helpers import ACCOUNTS


@pytest.mark.parametrize("who", list(ACCOUNTS))
async def test_every_demo_user_can_login_and_fetch_me(api, who):
    me = await api.ok(who, "GET", "/auth/me")
    assert me["email"] == ACCOUNTS[who][0]


async def test_wrong_password_rejected(client):
    r = await client.post("/auth/login", json={"email": "ceo@chandansteel.com", "password": "nope"})
    assert r.status_code == 401


async def test_unknown_user_rejected(client):
    r = await client.post("/auth/login", json={"email": "ghost@chandansteel.com", "password": "x"})
    assert r.status_code == 401


async def test_no_token_rejected(client):
    r = await client.get("/auth/me")
    assert r.status_code in (401, 403)


async def test_garbage_token_rejected(client):
    r = await client.get("/auth/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401
