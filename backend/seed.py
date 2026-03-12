import os
import sys
import django
from datetime import date, timedelta
import random

sys.path.insert(0, '.')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sams.settings')
django.setup()

from attendance.models import (
    User, Department, Programme, Course,
    CourseAssignment, Section, Student, AttendanceRecord
)
from decimal import Decimal

print("🌱 Seeding sample data...")

# ── Departments ──────────────────────────────────────
dept_aviation, _ = Department.objects.get_or_create(name="Aviation Technology")
dept_cs, _ = Department.objects.get_or_create(name="Computer Science")
dept_eng, _ = Department.objects.get_or_create(name="Aerospace Engineering")
print("✅ Departments created")

# ── Programmes ───────────────────────────────────────
prog_avionics, _ = Programme.objects.get_or_create(name="BSc Avionics", department=dept_aviation)
prog_cs, _ = Programme.objects.get_or_create(name="BSc Computer Science", department=dept_cs)
prog_aero, _ = Programme.objects.get_or_create(name="BSc Aerospace Engineering", department=dept_eng)
print("✅ Programmes created")

# ── Courses ──────────────────────────────────────────
courses_data = [
    ("Aerodynamics I", 48, prog_aero),
    ("Aviation Safety", 32, prog_avionics),
    ("Flight Navigation", 40, prog_avionics),
    ("Aircraft Systems", 56, prog_aero),
    ("Database Systems", 48, prog_cs),
    ("Software Engineering", 40, prog_cs),
]

courses = []
for name, hours, prog in courses_data:
    c, _ = Course.objects.get_or_create(
        name=name,
        defaults={"total_credit_hours": Decimal(str(hours)), "programme": prog}
    )
    courses.append(c)
print("✅ Courses created")

# ── Teacher users ─────────────────────────────────────
teachers_data = [
    ("teacher1", "Abebe", "Girma"),
    ("teacher2", "Mekdes", "Tadesse"),
    ("teacher3", "Dawit", "Bekele"),
]
teachers = []
for username, first, last in teachers_data:
    t, created = User.objects.get_or_create(username=username)
    if created:
        t.set_password("teacher123")
        t.first_name = first
        t.last_name = last
        t.role = "teacher"
        t.email = f"{username}@eau.edu.et"
        t.save()
    teachers.append(t)
print("✅ Teachers created")

# ── Course Assignments ────────────────────────────────
assignments = [
    (teachers[0], courses[0], "Professor", Decimal("48")),
    (teachers[0], courses[1], "Professor", Decimal("32")),
    (teachers[1], courses[2], "Professor", Decimal("40")),
    (teachers[1], courses[3], "Professor", Decimal("56")),
    (teachers[2], courses[4], "Professor", Decimal("48")),
    (teachers[2], courses[5], "Professor", Decimal("40")),
]
for teacher, course, role, credit_hours in assignments:
    CourseAssignment.objects.get_or_create(
        teacher=teacher,
        course=course,
        defaults={"role": role, "credit_hours": credit_hours}
    )
print("✅ Course assignments created")

# ── Sections ─────────────────────────────────────────
sections = []
for course in courses:
    s, _ = Section.objects.get_or_create(name="A", course=course)
    sections.append(s)
print("✅ Sections created")

# ── Students ─────────────────────────────────────────
# Check actual Student model fields
from django.db import models as dm
student_fields = [f.name for f in Student._meta.get_fields()]
print(f"   Student fields: {student_fields}")

students_data = [
    ("STU001", "Abebe",    "Tadesse",    sections[0]),
    ("STU002", "Hanna",    "Bekele",     sections[0]),
    ("STU003", "Dawit",    "Mekonnen",   sections[1]),
    ("STU004", "Sara",     "Girma",      sections[2]),
    ("STU005", "Yonas",    "Hailu",      sections[3]),
    ("STU006", "Kidist",   "Alemayehu",  sections[4]),
    ("STU007", "Bereket",  "Tesfaye",    sections[0]),
    ("STU008", "Selam",    "Worku",      sections[1]),
    ("STU009", "Natnael",  "Alemu",      sections[3]),
    ("STU010", "Marta",    "Kebede",     sections[4]),
    ("STU011", "Tewodros", "Haile",      sections[0]),
    ("STU012", "Fikirte",  "Assefa",     sections[2]),
    ("STU013", "Robel",    "Desta",      sections[1]),
    ("STU014", "Tigist",   "Mengistu",   sections[3]),
    ("STU015", "Henok",    "Getachew",   sections[5]),
]

students = []
for sid, first, last, section in students_data:
    defaults = {
        "first_name": first,
        "last_name": last,
        "email": f"{sid.lower()}@eau.edu.et",
        "section": section,
    }
    s, _ = Student.objects.get_or_create(student_id=sid, defaults=defaults)
    students.append((s, section))
print("✅ Students created")

# ── Attendance Records ────────────────────────────────
print("⏳ Generating attendance records...")
today = date.today()
admin_user = User.objects.get(username="admin")

absence_patterns = {
    "STU001": 0.85,
    "STU002": 0.90,
    "STU003": 0.78,
    "STU004": 0.72,
    "STU005": 0.60,
    "STU006": 0.55,
    "STU007": 0.95,
    "STU008": 0.88,
    "STU009": 0.65,
    "STU010": 0.82,
    "STU011": 0.75,
    "STU012": 0.91,
    "STU013": 0.58,
    "STU014": 0.80,
    "STU015": 0.70,
}

records_created = 0
for week in range(3):
    for day_offset in range(5):
        session_date = today - timedelta(weeks=week, days=day_offset)
        if session_date.weekday() >= 5:
            continue
        for student, section in students:
            course = section.course
            attendance_rate = absence_patterns.get(student.student_id, 0.80)
            rec_status = "present" if random.random() < attendance_rate else "absent"
            _, created = AttendanceRecord.objects.get_or_create(
                student=student,
                course=course,
                date=session_date,
                defaults={
                    "status": rec_status,
                    "session_type": "theory",
                    "session_hours": Decimal("1.5"),
                    "recorded_by": admin_user,
                }
            )
            if created:
                records_created += 1

print(f"✅ {records_created} attendance records created")
print("\n🎉 Sample data seeding complete!")
print(f"\n📋 Summary:")
print(f"   Departments: {Department.objects.count()}")
print(f"   Programmes:  {Programme.objects.count()}")
print(f"   Courses:     {Course.objects.count()}")
print(f"   Teachers:    {User.objects.filter(role='teacher').count()}")
print(f"   Students:    {Student.objects.count()}")
print(f"   Records:     {AttendanceRecord.objects.count()}")
print(f"\n🔑 Teacher logins — password: teacher123")
print(f"   teacher1, teacher2, teacher3")