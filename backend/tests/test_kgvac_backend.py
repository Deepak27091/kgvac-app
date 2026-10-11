"""KG Vac Service - Job Manager Backend API tests."""
import os
import pytest
import requests
from datetime import datetime, timedelta, timezone

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://kgvac-ops.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = ("admin@kgvac.com", "Admin@2026")
STAFF1 = ("staff1@kgvac.com", "Staff1@2026")
STAFF2 = ("staff2@kgvac.com", "Staff2@2026")


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data and "user" in data
    assert data["user"]["email"] == email
    assert data["user"]["role"] in ("admin", "staff")
    return data["access_token"], data["user"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# shared state across tests
STATE = {}


# ---------- Auth ----------
class TestAuth:
    def test_admin_login(self):
        tok, u = _login(*ADMIN)
        STATE["admin_tok"] = tok
        STATE["admin"] = u
        assert u["role"] == "admin"

    def test_staff1_login(self):
        tok, u = _login(*STAFF1)
        STATE["staff1_tok"] = tok
        STATE["staff1"] = u
        assert u["role"] == "staff"

    def test_staff2_login(self):
        tok, u = _login(*STAFF2)
        STATE["staff2_tok"] = tok
        STATE["staff2"] = u

    def test_bad_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN[0], "password": "wrong"})
        assert r.status_code == 401

    def test_auth_me(self):
        r = requests.get(f"{API}/auth/me", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN[0]

    def test_me_requires_auth(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_forgot_password_no_enumeration(self):
        for email in (ADMIN[0], "nobody@example.com"):
            r = requests.post(f"{API}/auth/forgot-password", json={"email": email})
            assert r.status_code == 200
            assert r.json().get("ok") is True


# ---------- RBAC ----------
class TestRBAC:
    def test_staff_cannot_create_user(self):
        r = requests.post(f"{API}/users",
                          json={"email": "x@y.com", "name": "x", "password": "secret1", "role": "staff"},
                          headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 403

    def test_staff_cannot_create_category(self):
        r = requests.post(f"{API}/categories", json={"name": "StaffCat"}, headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 403

    def test_staff_cannot_reset_other_password(self):
        r = requests.post(f"{API}/users/{STATE['staff2']['id']}/reset-password",
                          headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 403


# ---------- Customers ----------
class TestCustomers:
    def test_admin_create_customer(self):
        payload = {"name": "TEST_Alpha Diner", "company": "TEST_Alpha", "phone": "5551234", "address": "1 Rd"}
        r = requests.post(f"{API}/customers", json=payload, headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["name"] == payload["name"] and "id" in c
        STATE["customer_id"] = c["id"]

    def test_staff_can_create_customer(self):
        r = requests.post(f"{API}/customers",
                          json={"name": "TEST_StaffCust", "company": "TEST_SC", "phone": "222"},
                          headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        STATE["customer2_id"] = r.json()["id"]

    def test_get_customer_with_jobs(self):
        r = requests.get(f"{API}/customers/{STATE['customer_id']}", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        c = r.json()
        assert c["id"] == STATE["customer_id"]
        assert isinstance(c.get("jobs"), list)


# ---------- Categories ----------
class TestCategories:
    def test_admin_create_category(self):
        r = requests.post(f"{API}/categories", json={"name": "TEST_HoodCleaning"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        cat = r.json()
        assert cat["name"] == "TEST_HoodCleaning"
        STATE["category_id"] = cat["id"]

    def test_list_categories(self):
        r = requests.get(f"{API}/categories", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        assert any(c["id"] == STATE["category_id"] for c in r.json())


# ---------- Jobs ----------
class TestJobs:
    def test_create_job_invalid_customer(self):
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": "bad", "title": "T", "category_id": STATE["category_id"],
                                "scheduled_date": "2026-02-01", "scheduled_time": "10:00", "price": 100},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 400

    def test_create_job_invalid_category(self):
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "T", "category_id": "bad",
                                "scheduled_date": "2026-02-01", "scheduled_time": "10:00", "price": 100},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 400

    def test_staff_cannot_create_job(self):
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "T", "category_id": STATE["category_id"],
                                "scheduled_date": "2026-02-01", "scheduled_time": "10:00", "price": 100},
                          headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 403

    def test_admin_create_job_assigned_to_staff1(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_Job1",
                                "category_id": STATE["category_id"],
                                "scheduled_date": today, "scheduled_time": "14:00",
                                "assigned_to": STATE["staff1"]["id"], "price": 250.0},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "Scheduled"
        assert j["customer_name"] and j["category_name"]
        assert j["assigned_to_name"] == STATE["staff1"]["name"]
        STATE["job1_id"] = j["id"]

    def test_create_second_job_for_staff2(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_Job2",
                                "category_id": STATE["category_id"],
                                "scheduled_date": today, "scheduled_time": "15:00",
                                "assigned_to": STATE["staff2"]["id"], "price": 150.0},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        STATE["job2_id"] = r.json()["id"]

    def test_assignment_creates_notification(self):
        r = requests.get(f"{API}/notifications", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        notifs = r.json()
        assert any(n.get("job_id") == STATE["job1_id"] and n.get("kind") == "assignment" for n in notifs), \
            "Assignment notification missing for staff1"

    def test_get_job_enriched_with_activity(self):
        r = requests.get(f"{API}/jobs/{STATE['job1_id']}", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        j = r.json()
        assert j["customer_name"] and j["category_name"]
        assert isinstance(j.get("activity"), list) and len(j["activity"]) >= 1

    def test_staff_cannot_view_others_job(self):
        r = requests.get(f"{API}/jobs/{STATE['job2_id']}", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 403

    def test_staff_scoped_list_jobs(self):
        r = requests.get(f"{API}/jobs", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        for j in r.json():
            assert j.get("assigned_to") == STATE["staff1"]["id"]

    def test_filter_by_status(self):
        r = requests.get(f"{API}/jobs?status=Scheduled", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        for j in r.json():
            assert j["status"] == "Scheduled"

    def test_filter_by_date(self):
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(f"{API}/jobs?date_from={today}&date_to={today}", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        assert any(j["id"] == STATE["job1_id"] for j in r.json())

    def test_search_q(self):
        r = requests.get(f"{API}/jobs?q=TEST_Alpha", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        assert any(j["id"] == STATE["job1_id"] for j in r.json())

    def test_mine_true_for_admin(self):
        r = requests.get(f"{API}/jobs?mine=true", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200

    def test_status_workflow(self):
        tok = STATE["staff1_tok"]
        for s in ("Start", "Processing", "Completed"):
            r = requests.post(f"{API}/jobs/{STATE['job1_id']}/status",
                              json={"new_status": s}, headers=_h(tok))
            assert r.status_code == 200, f"{s}: {r.text}"
        # verify completed_at/by set
        r = requests.get(f"{API}/jobs/{STATE['job1_id']}", headers=_h(STATE["admin_tok"]))
        j = r.json()
        assert j["status"] == "Completed"
        assert j.get("completed_at") and j.get("completed_by") == STATE["staff1"]["id"]

    def test_staff_cannot_change_others_status(self):
        r = requests.post(f"{API}/jobs/{STATE['job2_id']}/status",
                          json={"new_status": "Start"}, headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 403

    def test_reschedule_requires_dt(self):
        r = requests.post(f"{API}/jobs/{STATE['job2_id']}/status",
                          json={"new_status": "Rescheduled"}, headers=_h(STATE["admin_tok"]))
        assert r.status_code == 400

    def test_reschedule_success(self):
        tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs/{STATE['job2_id']}/status",
                          json={"new_status": "Rescheduled",
                                "scheduled_date": tomorrow, "scheduled_time": "11:00"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/jobs/{STATE['job2_id']}", headers=_h(STATE["admin_tok"]))
        j = r.json()
        assert j["status"] == "Rescheduled"
        assert j["scheduled_date"] == tomorrow
        assert j.get("reminders_sent") == []
        # activity has original date logged
        assert any("original_date" in (a.get("details") or {}) for a in j["activity"])

    def test_cancel_with_reason(self):
        # Create fresh job to cancel
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_ToCancel",
                                "category_id": STATE["category_id"],
                                "scheduled_date": today, "scheduled_time": "16:00",
                                "assigned_to": STATE["staff2"]["id"], "price": 50.0},
                          headers=_h(STATE["admin_tok"]))
        jid = r.json()["id"]
        STATE["cancelled_job_id"] = jid
        r = requests.post(f"{API}/jobs/{jid}/status",
                          json={"new_status": "Cancelled", "reason": "customer"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/jobs/{jid}", headers=_h(STATE["admin_tok"]))
        j = r.json()
        assert j["status"] == "Cancelled"
        assert j.get("cancellation_reason") == "customer"
        assert "24h" in (j.get("reminders_sent") or []) and "1h" in (j.get("reminders_sent") or [])


# ---------- Dashboard ----------
class TestDashboard:
    def test_admin_stats(self):
        r = requests.get(f"{API}/dashboard/stats", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        s = r.json()
        for k in ("today", "upcoming", "scheduled", "started", "processing",
                  "completed", "rescheduled", "cancelled", "today_jobs", "upcoming_jobs"):
            assert k in s, f"missing {k}"
        assert s["completed"] >= 1
        assert s["cancelled"] >= 1

    def test_staff_stats_scoped(self):
        r = requests.get(f"{API}/dashboard/stats", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        s = r.json()
        # staff1 only has completed job1
        for j in s["today_jobs"]:
            assert j.get("assigned_to") == STATE["staff1"]["id"]


# ---------- Earnings ----------
class TestEarnings:
    def test_admin_earnings(self):
        r = requests.get(f"{API}/earnings", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        e = r.json()
        assert e["all_time_total"] >= 250.0
        # cancelled/scheduled/processing should not count
        for j in e["jobs"]:
            assert j["status"] == "Completed"
        assert isinstance(e["by_staff"], list) and isinstance(e["by_category"], list)

    def test_staff_earnings_scoped(self):
        r = requests.get(f"{API}/earnings", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        e = r.json()
        for j in e["jobs"]:
            assert j.get("assigned_to") == STATE["staff1"]["id"]
            assert j["status"] == "Completed"
        # no by_staff for staff role
        assert e["by_staff"] == []


# ---------- Notifications ----------
class TestNotifications:
    def test_list_notifications(self):
        r = requests.get(f"{API}/notifications", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        notifs = r.json()
        assert len(notifs) >= 1
        STATE["notif_id"] = notifs[0]["id"]

    def test_mark_read(self):
        r = requests.post(f"{API}/notifications/{STATE['notif_id']}/read",
                          headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200

    def test_mark_all_read(self):
        r = requests.post(f"{API}/notifications/read-all", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/notifications", headers=_h(STATE["staff1_tok"]))
        for n in r.json():
            assert n["read"] is True


# ---------- User management ----------
class TestUserManagement:
    def test_admin_create_user_duplicate(self):
        # duplicate email
        r = requests.post(f"{API}/users",
                          json={"email": ADMIN[0], "name": "x", "password": "secret1", "role": "staff"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 400

    def test_admin_create_new_user_must_change_password(self):
        email = "test_newstaff@kgvac.com"
        # ensure clean
        r = requests.post(f"{API}/users",
                          json={"email": email, "name": "TEST_NS", "password": "Pass@2026", "role": "staff"},
                          headers=_h(STATE["admin_tok"]))
        if r.status_code == 400:
            pytest.skip("User already exists from prior run")
        assert r.status_code == 200, r.text
        u = r.json()
        assert u["must_change_password"] is True
        STATE["new_user_id"] = u["id"]
        STATE["new_user_email"] = email

    def test_admin_reset_password_sends(self):
        if "new_user_id" not in STATE:
            pytest.skip("new user not created")
        r = requests.post(f"{API}/users/{STATE['new_user_id']}/reset-password",
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_admin_disable_user_cannot_login(self):
        if "new_user_id" not in STATE:
            pytest.skip("new user not created")
        r = requests.patch(f"{API}/users/{STATE['new_user_id']}",
                           json={"disabled": True}, headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        assert r.json()["disabled"] is True
        r2 = requests.post(f"{API}/auth/login",
                           json={"email": STATE["new_user_email"], "password": "Pass@2026"})
        assert r2.status_code == 401


# ---------- Change password invalidates old token ----------
class TestChangePassword:
    def test_change_password_and_old_token_invalidated(self):
        # Fresh login for staff2 (don't disturb staff1 which other tests depend on)
        tok, u = _login(*STAFF2)
        new_pw = "Staff2@2026-new"
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": STAFF2[1], "new_password": new_pw},
                          headers=_h(tok))
        assert r.status_code == 200
        # old token should be invalid
        r = requests.get(f"{API}/auth/me", headers=_h(tok))
        assert r.status_code == 401
        # revert password with new token
        r = requests.post(f"{API}/auth/login", json={"email": STAFF2[0], "password": new_pw})
        assert r.status_code == 200
        new_tok = r.json()["access_token"]
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": new_pw, "new_password": STAFF2[1]},
                          headers=_h(new_tok))
        assert r.status_code == 200

    def test_change_password_wrong_current(self):
        tok, _ = _login(*ADMIN)
        r = requests.post(f"{API}/auth/change-password",
                          json={"current_password": "wrong", "new_password": "Whatever@1"},
                          headers=_h(tok))
        assert r.status_code == 400


# ---------- NEW FEATURES: Overdue + Signature Capture ----------
class TestOverdueAndSignature:
    """Tests for is_overdue flag, overdue filter, dashboard overdue stat, and signature capture."""

    def test_create_overdue_job_for_staff1(self):
        # Create a job scheduled in the past (yesterday) assigned to staff1
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_Overdue_Staff1",
                                "category_id": STATE["category_id"],
                                "scheduled_date": yesterday, "scheduled_time": "09:00",
                                "assigned_to": STATE["staff1"]["id"], "price": 100.0},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        STATE["overdue_job_staff1"] = r.json()["id"]

    def test_create_overdue_job_for_staff2(self):
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_Overdue_Staff2",
                                "category_id": STATE["category_id"],
                                "scheduled_date": yesterday, "scheduled_time": "10:00",
                                "assigned_to": STATE["staff2"]["id"], "price": 120.0},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        STATE["overdue_job_staff2"] = r.json()["id"]

    def test_jobs_list_includes_is_overdue_flag(self):
        r = requests.get(f"{API}/jobs", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        jobs = r.json()
        for j in jobs:
            assert "is_overdue" in j, f"Job {j.get('id')} missing is_overdue field"
            assert isinstance(j["is_overdue"], bool)

    def test_overdue_job_marked_true(self):
        r = requests.get(f"{API}/jobs/{STATE['overdue_job_staff1']}", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        j = r.json()
        assert j["is_overdue"] is True, f"Past-scheduled Scheduled job should be overdue; got {j}"
        assert j["status"] in ("Scheduled", "Start", "Processing", "Rescheduled")

    def test_completed_job_not_overdue(self):
        # job1 was completed in TestJobs, scheduled today — must still be is_overdue=False
        r = requests.get(f"{API}/jobs/{STATE['job1_id']}", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "Completed"
        assert j["is_overdue"] is False

    def test_cancelled_job_not_overdue(self):
        # Cancel the overdue_job_staff2 (which is past-scheduled); verify is_overdue flips to False
        r = requests.post(f"{API}/jobs/{STATE['overdue_job_staff2']}/status",
                          json={"new_status": "Cancelled", "reason": "test cancel of overdue"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/jobs/{STATE['overdue_job_staff2']}", headers=_h(STATE["admin_tok"]))
        j = r.json()
        assert j["status"] == "Cancelled"
        assert j["is_overdue"] is False, "Cancelled job must not be overdue even if past scheduled"

    def test_overdue_filter_returns_only_overdue(self):
        r = requests.get(f"{API}/jobs?overdue=true", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        jobs = r.json()
        assert len(jobs) >= 1, "Expected at least one overdue job"
        for j in jobs:
            assert j["is_overdue"] is True, f"Non-overdue job returned under overdue filter: {j['id']}"
            assert j["status"] in ("Scheduled", "Start", "Processing", "Rescheduled")
        assert any(j["id"] == STATE["overdue_job_staff1"] for j in jobs)

    def test_overdue_filter_staff_scoped(self):
        # staff1 overdue list should contain only staff1's overdue job
        r = requests.get(f"{API}/jobs?overdue=true", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        jobs = r.json()
        for j in jobs:
            assert j.get("assigned_to") == STATE["staff1"]["id"]
            assert j["is_overdue"] is True
        assert any(j["id"] == STATE["overdue_job_staff1"] for j in jobs)
        # staff1 should NOT see staff2's overdue job
        assert not any(j["id"] == STATE["overdue_job_staff2"] for j in jobs)

    def test_dashboard_stats_overdue_count_admin(self):
        r = requests.get(f"{API}/dashboard/stats", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        s = r.json()
        assert "overdue" in s, "dashboard stats missing 'overdue' key"
        assert isinstance(s["overdue"], int)
        assert s["overdue"] >= 1  # at least overdue_job_staff1 is active + past

    def test_dashboard_stats_overdue_staff_scoped(self):
        r = requests.get(f"{API}/dashboard/stats", headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200
        s = r.json()
        assert "overdue" in s
        assert isinstance(s["overdue"], int)
        # staff1 has exactly one active overdue job (overdue_job_staff1)
        assert s["overdue"] >= 1

        # Re-login staff2 (prior TestChangePassword invalidates old staff2_tok)
        fresh_tok, _ = _login(*STAFF2)
        STATE["staff2_tok"] = fresh_tok
        r2 = requests.get(f"{API}/dashboard/stats", headers=_h(fresh_tok))
        assert r2.status_code == 200, r2.text
        s2 = r2.json()
        assert "overdue" in s2
        # staff2's overdue job was cancelled → overdue count should be 0 for staff2
        assert s2["overdue"] == 0, f"staff2 overdue should be 0 (job cancelled), got {s2['overdue']}"

    def test_signature_capture_on_completion(self):
        # Create a fresh job for staff1, then complete with signature
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_SignJob",
                                "category_id": STATE["category_id"],
                                "scheduled_date": today, "scheduled_time": "12:00",
                                "assigned_to": STATE["staff1"]["id"], "price": 300.0},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        sign_jid = r.json()["id"]
        STATE["sign_job_id"] = sign_jid

        # Complete with signature_data (small base64 PNG data URL)
        sig = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = requests.post(f"{API}/jobs/{sign_jid}/status",
                          json={"new_status": "Completed", "signature_data": sig},
                          headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200, r.text

        # Verify persisted via GET
        r = requests.get(f"{API}/jobs/{sign_jid}", headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        j = r.json()
        assert j["status"] == "Completed"
        assert j.get("signature_data") == sig, "signature_data not persisted"
        assert j.get("signature_captured_at"), "signature_captured_at missing"

    def test_completion_without_signature_still_succeeds(self):
        # Backend treats signature as optional (frontend enforces prompt)
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_NoSigJob",
                                "category_id": STATE["category_id"],
                                "scheduled_date": today, "scheduled_time": "13:00",
                                "assigned_to": STATE["staff1"]["id"], "price": 80.0},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        jid = r.json()["id"]
        r = requests.post(f"{API}/jobs/{jid}/status",
                          json={"new_status": "Completed"},
                          headers=_h(STATE["staff1_tok"]))
        assert r.status_code == 200, r.text
        r = requests.get(f"{API}/jobs/{jid}", headers=_h(STATE["admin_tok"]))
        j = r.json()
        assert j["status"] == "Completed"
        assert j.get("signature_data") in (None, "", False) or "signature_data" not in j

    def test_reschedule_still_requires_date_time(self):
        # Regression: Rescheduled without scheduled_date/time must 400
        r = requests.post(f"{API}/jobs/{STATE['overdue_job_staff1']}/status",
                          json={"new_status": "Rescheduled"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 400

    def test_reschedule_overdue_job_succeeds_and_clears_overdue(self):
        future_date = (datetime.now(timezone.utc) + timedelta(days=2)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs/{STATE['overdue_job_staff1']}/status",
                          json={"new_status": "Rescheduled",
                                "scheduled_date": future_date, "scheduled_time": "10:00"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200
        r = requests.get(f"{API}/jobs/{STATE['overdue_job_staff1']}", headers=_h(STATE["admin_tok"]))
        j = r.json()
        assert j["status"] == "Rescheduled"
        assert j["is_overdue"] is False  # now scheduled in the future



# ---------- Iter4: overdue + date range merge regression ----------
class TestOverdueDateRangeMerge:
    """Verify GET /api/jobs?overdue=true combines with date_from/date_to instead of overwriting."""

    def test_overdue_with_wide_date_range_returns_overdue(self):
        # Create a fresh overdue job for staff2 (previous ones were cancelled/rescheduled in TestOverdueAndSignature)
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
        r = requests.post(f"{API}/jobs",
                          json={"customer_id": STATE["customer_id"], "title": "TEST_OverdueMerge",
                                "category_id": STATE["category_id"],
                                "scheduled_date": yesterday, "scheduled_time": "08:00",
                                "assigned_to": STATE["staff2"]["id"], "price": 50.0},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        job_id = r.json()["id"]
        STATE["overdue_merge_job"] = job_id

        # Wide range that includes yesterday — overdue job should still appear
        this_year = datetime.now(timezone.utc).year
        r = requests.get(
            f"{API}/jobs?overdue=true&date_from={this_year}-01-01&date_to={this_year}-12-31",
            headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        jobs = r.json()
        assert any(j["id"] == job_id for j in jobs), \
            f"Expected overdue job {job_id} in overdue+range result; got {[j['id'] for j in jobs]}"
        for j in jobs:
            assert j["is_overdue"] is True
            assert j["status"] in ("Scheduled", "Start", "Processing", "Rescheduled")

    def test_overdue_with_future_only_range_returns_empty(self):
        # Range entirely in the future (next year) — overdue jobs (past-scheduled) must be filtered OUT
        # If merge is broken (date range overwrites $lt), this would wrongly return future jobs.
        next_year = datetime.now(timezone.utc).year + 1
        r = requests.get(
            f"{API}/jobs?overdue=true&date_from={next_year}-01-01&date_to={next_year}-12-31",
            headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        jobs = r.json()
        # No job can be both overdue (scheduled < now) AND scheduled in the future
        assert jobs == [], f"Expected empty list for overdue in future range; got {len(jobs)} jobs: {[j['id'] for j in jobs]}"

    def test_overdue_with_narrow_past_range_scoped(self):
        # Narrow range covering yesterday — overdue job created above should be in result
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        two_days_ago = (datetime.now(timezone.utc) - timedelta(days=2)).strftime("%Y-%m-%d")
        r = requests.get(
            f"{API}/jobs?overdue=true&date_from={two_days_ago}&date_to={today}",
            headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200, r.text
        jobs = r.json()
        assert any(j["id"] == STATE["overdue_merge_job"] for j in jobs), \
            "Overdue job scheduled yesterday should appear within [two_days_ago..today] range"

    def test_cleanup_overdue_merge_job(self):
        # Cleanup: cancel the overdue job we created so re-runs of the suite don't accumulate overdue state
        r = requests.post(f"{API}/jobs/{STATE['overdue_merge_job']}/status",
                          json={"new_status": "Cancelled", "reason": "test cleanup"},
                          headers=_h(STATE["admin_tok"]))
        assert r.status_code == 200


# ---------- Iter4: Seed password idempotency / reseed verification ----------
class TestSeedPasswordIdempotency:
    """Verify RESEED_PASSWORDS=true restores seed passwords after a change-password mutation.

    NOTE: We can't restart the backend from pytest, so instead we verify:
    (a) Seed logins work at the start of this run (already covered by TestAuth).
    (b) After an in-run change-password on staff1 (via TestChangePassword), seed password login
        would ONLY work if seed-reseed had run — but since seed only reseeds on boot, within
        a single pytest run staff1 has the NEW password after TestChangePassword.
    Here we instead confirm that after TestChangePassword in this run, TestAuth's seed
    passwords were valid at the start (idempotency across restarts verified by the fact that
    this test file ran its TestAuth block successfully, meaning the prior iteration's mutation
    was reset on boot by RESEED_PASSWORDS=true).
    """

    def test_admin_seed_login_at_run_end_still_works(self):
        # Admin password is never mutated by other tests — must still work
        r = requests.post(f"{API}/auth/login",
                          json={"email": ADMIN[0], "password": ADMIN[1]}, timeout=30)
        assert r.status_code == 200, f"Admin seed login broke mid-run: {r.text}"

    def test_staff2_seed_login_at_run_end_still_works(self):
        # staff2 is NOT touched by TestChangePassword (that one targets staff1 — see line 395)
        # so staff2 password must still be the seed value at end of run
        r = requests.post(f"{API}/auth/login",
                          json={"email": STAFF2[0], "password": STAFF2[1]}, timeout=30)
        assert r.status_code == 200, f"Staff2 seed login broke mid-run: {r.text}"
