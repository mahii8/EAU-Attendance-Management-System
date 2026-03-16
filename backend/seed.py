import os
import django
import random
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sams.settings')
django.setup()

from django.contrib.auth.hashers import make_password
from attendance.models import (
    User, Department, Programme, Course, Section,
    Student, CourseAssignment, AttendanceRecord, Notification
)

print("Clearing old data...")
AttendanceRecord.objects.all().delete()
Notification.objects.all().delete()
Student.objects.all().delete()
CourseAssignment.objects.all().delete()
Section.objects.all().delete()
Course.objects.all().delete()
Programme.objects.all().delete()
Department.objects.all().delete()
User.objects.filter(is_superuser=False).delete()

print("Creating departments...")
dept_aerospace = Department.objects.create(name="School of Aerospace Engineering")
dept_aviation = Department.objects.create(name="School of Aviation Management")
dept_maintenance = Department.objects.create(name="School of Aircraft Maintenance")

print("Creating programmes...")
prog_aero = Programme.objects.create(
    name="BSc Aeronautical Engineering",
    duration_years=5,
    department=dept_aerospace
)
prog_maintenance = Programme.objects.create(
    name="BSc Aircraft Maintenance Engineering",
    duration_years=4,
    department=dept_maintenance
)
prog_management = Programme.objects.create(
    name="BSc Aviation Management & Operations",
    duration_years=4,
    department=dept_aviation
)

print("Creating teachers...")
teachers = []
teacher_data = [
    ("Abebe", "Girma", "teacher1"),
    ("Mekdes", "Tadesse", "teacher2"),
    ("Dawit", "Bekele", "teacher3"),
    ("Tigist", "Haile", "teacher4"),
    ("Samuel", "Tesfaye", "teacher5"),
]
for fn, ln, un in teacher_data:
    t = User.objects.create(
        username=un,
        first_name=fn,
        last_name=ln,
        email=f"{un}@eau.edu.et",
        role='teacher',
        password=make_password('teacher123')
    )
    teachers.append(t)

print("Creating courses...")
# BSc Aeronautical Engineering courses
aero_courses = [
    ("Mathematics I", "AERO101", 1, 1, 48.0),
    ("Physics I", "AERO102", 1, 1, 48.0),
    ("Introduction to Aviation", "AERO103", 1, 1, 32.0),
    ("Mathematics II", "AERO104", 1, 2, 48.0),
    ("Physics II", "AERO105", 1, 2, 48.0),
    ("Aerodynamics I", "AERO201", 2, 1, 48.0),
    ("Thermodynamics", "AERO202", 2, 1, 48.0),
    ("Aircraft Structures I", "AERO203", 2, 1, 40.0),
    ("Aerodynamics II", "AERO204", 2, 2, 48.0),
    ("Aircraft Structures II", "AERO205", 2, 2, 40.0),
    ("Flight Mechanics", "AERO301", 3, 1, 48.0),
    ("Propulsion Systems", "AERO302", 3, 1, 48.0),
    ("Aviation Safety", "AERO303", 3, 2, 32.0),
    ("Flight Navigation", "AERO401", 4, 1, 40.0),
    ("Aircraft Systems", "AERO402", 4, 1, 56.0),
    ("Final Year Project", "AERO501", 5, 1, 64.0),
]

# BSc Aircraft Maintenance Engineering courses
maintenance_courses = [
    ("Engineering Mathematics", "MAINT101", 1, 1, 48.0),
    ("Basic Electricity", "MAINT102", 1, 1, 40.0),
    ("Aircraft Materials", "MAINT201", 2, 1, 40.0),
    ("Airframe Maintenance", "MAINT202", 2, 2, 48.0),
    ("Engine Maintenance", "MAINT301", 3, 1, 48.0),
    ("Avionics Systems", "MAINT302", 3, 2, 40.0),
    ("Aircraft Inspection", "MAINT401", 4, 1, 48.0),
    ("Maintenance Management", "MAINT402", 4, 2, 40.0),
]

# BSc Aviation Management courses
management_courses = [
    ("Introduction to Management", "MGMT101", 1, 1, 40.0),
    ("Aviation Economics", "MGMT102", 1, 2, 40.0),
    ("Airport Operations", "MGMT201", 2, 1, 40.0),
    ("Airline Management", "MGMT202", 2, 2, 40.0),
    ("Aviation Law", "MGMT301", 3, 1, 32.0),
    ("Air Traffic Management", "MGMT302", 3, 2, 40.0),
    ("Strategic Management", "MGMT401", 4, 1, 40.0),
    ("Aviation Safety Management", "MGMT402", 4, 2, 32.0),
]

created_courses = {"aero": {}, "maint": {}, "mgmt": {}}

for name, code, year, sem, hours in aero_courses:
    c = Course.objects.create(
        name=name, code=code, programme=prog_aero,
        year=year, semester=sem, total_credit_hours=hours
    )
    created_courses["aero"][(year, sem, code)] = c

for name, code, year, sem, hours in maintenance_courses:
    c = Course.objects.create(
        name=name, code=code, programme=prog_maintenance,
        year=year, semester=sem, total_credit_hours=hours
    )
    created_courses["maint"][(year, sem, code)] = c

for name, code, year, sem, hours in management_courses:
    c = Course.objects.create(
        name=name, code=code, programme=prog_management,
        year=year, semester=sem, total_credit_hours=hours
    )
    created_courses["mgmt"][(year, sem, code)] = c

print("Creating sections...")
# Current: Year 2, Semester 2, Academic Year 2024/25
CURRENT_YEAR = 2
CURRENT_SEM = 2
ACADEMIC_YEAR = "2024/25"

sections = {}
for prog, prog_obj in [("aero", prog_aero), ("maint", prog_maintenance), ("mgmt", prog_management)]:
    for section_name in ["A", "B"]:
        s = Section.objects.create(
            name=section_name,
            programme=prog_obj,
            year=CURRENT_YEAR,
            semester=CURRENT_SEM,
            academic_year=ACADEMIC_YEAR
        )
        sections[(prog, section_name)] = s

print("Creating course assignments...")
# Assign Year 2 Sem 2 courses to sections
aero_y2s2_courses = [
    c for (y, s, code), c in created_courses["aero"].items()
    if y == CURRENT_YEAR and s == CURRENT_SEM
]
maint_y2s2_courses = [
    c for (y, s, code), c in created_courses["maint"].items()
    if y == CURRENT_YEAR and s == CURRENT_SEM
]
mgmt_y2s2_courses = [
    c for (y, s, code), c in created_courses["mgmt"].items()
    if y == CURRENT_YEAR and s == CURRENT_SEM
]

def assign_courses(course_list, section_a, section_b, teacher_list):
    for i, course in enumerate(course_list):
        teacher = teacher_list[i % len(teacher_list)]
        for section in [section_a, section_b]:
            CourseAssignment.objects.create(
                course=course,
                teacher=teacher,
                section=section,
                role='professor',
                credit_hours=course.total_credit_hours
            )

assign_courses(
    aero_y2s2_courses,
    sections[("aero", "A")],
    sections[("aero", "B")],
    teachers[:2]
)
assign_courses(
    maint_y2s2_courses,
    sections[("maint", "A")],
    sections[("maint", "B")],
    teachers[2:4]
)
assign_courses(
    mgmt_y2s2_courses,
    sections[("mgmt", "A")],
    sections[("mgmt", "B")],
    [teachers[4]]
)

print("Creating students...")
ethiopian_names = [
    ("Abebe", "Girma"), ("Tigist", "Haile"), ("Dawit", "Bekele"),
    ("Sara", "Tadesse"), ("Yonas", "Tesfaye"), ("Kidist", "Alemayehu"),
    ("Bereket", "Wolde"), ("Marta", "Kebede"), ("Solomon", "Desta"),
    ("Hanna", "Mekonnen"), ("Tewodros", "Alemu"), ("Selam", "Girma"),
    ("Natnael", "Tekle"), ("Bethlehem", "Hailu"), ("Robel", "Yosef"),
    ("Abrham", "Mulugeta"), ("Tigist", "Assefa"), ("Kaleb", "Negash"),
    ("Eden", "Teshome"), ("Mikias", "Worku"), ("Lidya", "Getnet"),
    ("Henok", "Desta"), ("Rahel", "Tsegaye"), ("Fitsum", "Bekele"),
    ("Mahlet", "Girma"), ("Yared", "Haile"), ("Saron", "Tadesse"),
    ("Biruk", "Mekonnen"), ("Azeb", "Alemu"), ("Daniel", "Kebede"),
]

student_counter = 1

def create_students(section, programme_code, count=10):
    global student_counter
    students = []
    for i in range(count):
        fn, ln = ethiopian_names[(student_counter - 1) % len(ethiopian_names)]
        reg_no = f"UGR/{10000 + student_counter}/24"
        email = f"ugr{10000 + student_counter}@eau.edu.et"
        st = Student.objects.create(
            first_name=fn,
            last_name=ln,
            student_id=reg_no,
            email=email,
            parent_email=f"parent{student_counter}@gmail.com",
            parent_telegram="",
            section=section
        )
        students.append(st)
        student_counter += 1
    return students

aero_a_students = create_students(sections[("aero", "A")], "AERO", 10)
aero_b_students = create_students(sections[("aero", "B")], "AERO", 10)
maint_a_students = create_students(sections[("maint", "A")], "MAINT", 10)
maint_b_students = create_students(sections[("maint", "B")], "MAINT", 10)
mgmt_a_students = create_students(sections[("mgmt", "A")], "MGMT", 10)
mgmt_b_students = create_students(sections[("mgmt", "B")], "MGMT", 10)

print("Creating attendance records...")

def create_attendance(students, courses, weeks=3):
    today = date.today()
    records_created = 0
    for week in range(weeks):
        for day_offset in [0, 2, 4]:  # Mon, Wed, Fri
            record_date = today - timedelta(weeks=week, days=day_offset)
            if record_date > today:
                continue
            for course in courses:
                for student in students:
                    # Make some students at-risk
                    if student.student_id in [
                        "UGR/10005/24", "UGR/10006/24",
                        "UGR/10015/24", "UGR/10025/24"
                    ]:
                        status = random.choices(
                            ['present', 'unexcused', 'excused', 'late'],
                            weights=[30, 40, 20, 10]
                        )[0]
                    else:
                        status = random.choices(
                            ['present', 'late', 'excused', 'unexcused'],
                            weights=[75, 10, 10, 5]
                        )[0]

                    hours = float(course.total_credit_hours) / 30
                    AttendanceRecord.objects.create(
                        student=student,
                        course=course,
                        date=record_date,
                        status=status,
                        session_type='theory',
                        hours_attended=round(hours, 1),
                        recorded_by=teachers[0]
                    )
                    records_created += 1
    return records_created

total_records = 0
total_records += create_attendance(aero_a_students, aero_y2s2_courses)
total_records += create_attendance(aero_b_students, aero_y2s2_courses)
total_records += create_attendance(maint_a_students, maint_y2s2_courses)
total_records += create_attendance(maint_b_students, maint_y2s2_courses)
total_records += create_attendance(mgmt_a_students, mgmt_y2s2_courses)
total_records += create_attendance(mgmt_b_students, mgmt_y2s2_courses)

print(f"""
✅ Seeding complete!
   Departments:  3
   Programmes:   3
   Courses:      {Course.objects.count()}
   Sections:     {Section.objects.count()} (Year 2, Sem 2, A & B per programme)
   Teachers:     {User.objects.filter(role='teacher').count()}
   Students:     {Student.objects.count()} (10 per section)
   Attendance:   {total_records} records
   
   Teacher logins: teacher1-5 / teacher123
   Admin login:    admin / admin123
""")