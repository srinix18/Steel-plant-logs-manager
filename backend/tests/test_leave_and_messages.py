"""Leave has yearly balances and no double-booking; messages can be answered; workers do not see plant cost."""

from datetime import date, timedelta


def _day(offset: int) -> str:
    return (date.today() + timedelta(days=offset)).isoformat()


async def _type(api, who, code):
    types = await api.ok(who, "GET", "/workforce/leave/types")
    return next(t for t in types if t["code"] == code)


async def test_overlapping_leave_is_refused(api):
    cl = await _type(api, "worker_rolling", "CL")
    body = {"leave_type_id": cl["id"], "from_date": _day(120), "to_date": _day(121), "remarks": "a"}
    await api.ok("worker_rolling", "POST", "/workforce/leave/requests", json=body)
    r = await api.post("worker_rolling", "/workforce/leave/requests", json={**body, "from_date": _day(121), "to_date": _day(122)})
    assert r.status_code == 400 and "already have" in r.text


async def test_balance_counts_requests_and_blocks_going_over(api):
    sl = await _type(api, "worker_bbd", "SL")
    assert sl["annual_days"] == 10
    start = date.today().replace(month=1, day=1) + timedelta(days=200)  # a clear stretch within this year
    req = await api.ok("worker_bbd", "POST", "/workforce/leave/requests",
                       json={"leave_type_id": sl["id"], "from_date": start.isoformat(), "to_date": (start + timedelta(days=3)).isoformat(), "remarks": "t"})
    balances = {b["code"]: b for b in await api.ok("worker_bbd", "GET", "/workforce/leave/balances")}
    assert balances["SL"]["pending"] >= 4 and balances["SL"]["remaining"] == 10 - balances["SL"]["used"] - balances["SL"]["pending"]
    assert balances["LOP"]["annual_days"] is None and balances["LOP"]["remaining"] is None  # loss of pay is unlimited

    too_long = await api.post("worker_bbd", "/workforce/leave/requests",
                              json={"leave_type_id": sl["id"], "from_date": (start + timedelta(days=20)).isoformat(),
                                    "to_date": (start + timedelta(days=40)).isoformat(), "remarks": "too long"})
    assert too_long.status_code == 400 and "left" in too_long.text

    await api.ok("hr", "POST", f"/workforce/leave/requests/{req['id']}/reject", json={"remarks": "no"})
    after = {b["code"]: b for b in await api.ok("worker_bbd", "GET", "/workforce/leave/balances")}
    assert after["SL"]["pending"] < balances["SL"]["pending"]  # a rejected request gives the days back


async def test_a_message_can_be_replied_to(api):
    sent = await api.ok("hod_sms", "POST", "/messages",
                        json={"subject": "Review", "body": "Please review", "recipient_ids": [api.user("sup_iaf")["id"]], "is_broadcast": False})
    reply = await api.ok("sup_iaf", "POST", f"/messages/{sent['id']}/reply", json={"body": "Done"})
    assert reply["subject"] == "Re: Review"
    inbox = await api.ok("hod_sms", "GET", "/messages/inbox")
    assert any(m["id"] == reply["id"] for m in inbox)
    # Someone who never received the message cannot answer it.
    stranger = await api.post("worker_forge", f"/messages/{sent['id']}/reply", json={"body": "hi"})
    assert stranger.status_code in (403, 404)


async def test_workers_do_not_see_plant_cost(api):
    plant = api.user("ceo")["plant_id"]
    ceo_view = await api.ok("ceo", "GET", f"/pulse/plant/{plant}")
    worker_view = await api.ok("worker_sms", "GET", f"/pulse/plant/{plant}")
    assert worker_view["today_cost"] is None
    assert ceo_view["today_cost"] is not None
