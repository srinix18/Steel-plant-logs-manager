"""About 250 employees for the demo, spread over every department, shift and role.

The rows are written as an Excel file and loaded through the same upload the company's HR uses, so the
demo also exercises that feature end to end.
"""

from __future__ import annotations

import random
from datetime import date
from io import BytesIO

from openpyxl import Workbook

PASSWORD = "Welcome@123"
UID_PREFIX = "CS-"

# department code -> {role: count}. The existing demo accounts already cover one HoD per production
# department and a few supervisors, so those are not repeated here.
DEPARTMENT_PLAN: dict[str, dict[str, int]] = {
    "SMS": {"supervisor": 3, "worker": 50},
    "ROLLING": {"supervisor": 3, "worker": 35},
    "WIRE": {"supervisor": 3, "worker": 25},
    "BBD": {"supervisor": 2, "worker": 20},
    "FORGE": {"supervisor": 2, "worker": 16},
    "QUAL": {"hod": 1, "worker": 12},
    "UTIL": {"hod": 1, "worker": 11},
    "MAINT": {"hod": 1, "maintenance": 34},
}
HR_COUNT = 6

FIRST = ["Aarav", "Vivaan", "Rohit", "Amit", "Suresh", "Ramesh", "Mahesh", "Dinesh", "Rajesh", "Naresh", "Anil", "Sunil", "Vikram", "Manoj",
         "Sanjay", "Deepak", "Prakash", "Ashok", "Mohan", "Kiran", "Arjun", "Karthik", "Sandeep", "Pradeep", "Harish", "Yogesh", "Nitin", "Gopal",
         "Imran", "Salim", "Farhan", "Gurpreet", "Harpreet", "Joseph", "Thomas", "Venkat", "Srinivas", "Mukesh", "Lokesh", "Bharat",
         "Sunita", "Anita", "Kavita", "Rekha", "Meena", "Lakshmi", "Pooja", "Neha", "Priya", "Savita", "Geeta", "Radha", "Sangeeta", "Usha"]
LAST = ["Sharma", "Verma", "Patil", "Kulkarni", "Deshmukh", "Joshi", "Reddy", "Naidu", "Rao", "Iyer", "Nair", "Menon", "Singh", "Yadav",
        "Gupta", "Mishra", "Pandey", "Tiwari", "Chauhan", "Thakur", "Jadhav", "Pawar", "More", "Shinde", "Gaikwad", "Khan", "Ansari", "Shaikh",
        "Das", "Ghosh", "Banerjee", "Mukherjee", "Bhatt", "Desai", "Patel", "Shah", "Mehta", "Kapoor", "Malhotra", "Bose"]

DESIGNATION = {
    ("SMS", "worker"): ["Furnace operator", "Melter", "Crane operator", "Ladle man", "Helper", "Sampler"],
    ("ROLLING", "worker"): ["Mill operator", "Roller", "Furnace pusher", "Cooling bed operator", "Helper", "Shear operator"],
    ("WIRE", "worker"): ["Drawing operator", "Annealing operator", "Coil handler", "Die setter", "Helper"],
    ("BBD", "worker"): ["Peeling operator", "Straightener operator", "Packer", "Inspector", "Helper"],
    ("FORGE", "worker"): ["Grinding operator", "Forge operator", "Heat treater", "Helper"],
    ("QUAL", "worker"): ["Lab chemist", "Sample preparer", "Quality inspector", "Lab assistant"],
    ("UTIL", "worker"): ["Boiler operator", "Compressor operator", "Water plant operator", "Electrician"],
}
SUPERVISOR_TITLE = "Shift in-charge"
# A supervisor runs one process; these are the processes each department has.
PROCESSES = {"SMS": ["IAF", "AOD", "CCM"], "ROLLING": ["RMILL"], "WIRE": ["WFURN", "WDRAW"], "BBD": ["BBAR"], "FORGE": ["GRIND"]}
MAINTENANCE_TITLE = {"quality": "Instrument technician", "safety": "Safety technician", "energy": "Electrician",
                     "equipment": "Fitter", "process": "Process technician"}
DIVISIONS = ["quality", "safety", "energy", "equipment", "process"]
SHIFT_WEIGHTS = (["A"] * 40) + (["B"] * 35) + (["C"] * 25)


def _salary(rng: random.Random, role: str) -> tuple[int, int, int, int, int]:
    lo, hi = {"worker": (14000, 24000), "supervisor": (28000, 38000), "hod": (50000, 65000),
              "maintenance": (18000, 30000), "hr": (30000, 42000)}[role]
    basic = round(rng.randint(lo, hi), -2)
    hra = round(basic * 0.3, -2)
    allowances = round(rng.randint(1000, 3000), -2)
    pf = round(basic * 0.12)
    esi = 0 if basic + hra + allowances > 21000 else round((basic + hra + allowances) * 0.0075)
    return basic, int(hra), int(allowances), pf, esi


def build_rows(seed: int = 250) -> list[list]:
    """One row per employee, in the column order of the HR upload template."""
    rng = random.Random(seed)
    rows: list[list] = []
    used_emails: set[str] = set()
    counter = 0

    def person(role: str, dept: str | None, shift: str, designation: str, division: str = "", process: str = "") -> None:
        nonlocal counter
        counter += 1
        first, last = rng.choice(FIRST), rng.choice(LAST)
        email = f"{first}.{last}{counter}@chandansteel.com".lower()
        while email in used_emails:  # cannot happen with the counter, kept as a guard
            email = f"{first}.{last}{counter}x@chandansteel.com".lower()
        used_emails.add(email)
        basic, hra, allowances, pf, esi = _salary(rng, role)
        joined = date(rng.randint(2012, 2026), rng.randint(1, 12), rng.randint(1, 28))
        if joined > date(2026, 8, 31):
            joined = date(2026, 8, 1)
        kind = "permanent" if rng.random() < 0.8 else ("contract" if rng.random() < 0.75 else "temporary")
        rows.append([
            f"{UID_PREFIX}{counter:04d}", f"{first} {last}", email, PASSWORD, role, dept or "", process, division, shift,
            designation, f"9{rng.randint(100000000, 999999999)}", kind, "active", joined.isoformat(),
            basic, hra, allowances, pf, esi,
        ])

    for dept, plan in DEPARTMENT_PLAN.items():
        for role, count in plan.items():
            for i in range(count):
                if role == "supervisor":
                    person(role, dept, "ABC"[i % 3], SUPERVISOR_TITLE, process=PROCESSES[dept][i % len(PROCESSES[dept])])
                elif role == "hod":
                    person(role, dept, "A", "Head of department")
                elif role == "maintenance":
                    division = DIVISIONS[i % len(DIVISIONS)]
                    person(role, dept, rng.choice(["A", "A", "B", "C"]), MAINTENANCE_TITLE[division], division)
                else:
                    person(role, dept, rng.choice(SHIFT_WEIGHTS), rng.choice(DESIGNATION[(dept, "worker")]))
    for i in range(HR_COUNT):
        person("hr", None, "", ["HR executive", "Payroll officer", "Recruitment officer", "Welfare officer", "Training coordinator", "Records clerk"][i % 6])
    return rows


def build_workbook(rows: list[list]) -> bytes:
    from app.services.import_engine.handlers.employees import COLUMNS

    wb = Workbook()
    ws = wb.active
    ws.title = "Employees"
    ws.append(COLUMNS)
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()
