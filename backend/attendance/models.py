from decimal import Decimal
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.utils import timezone


# ─────────────────────────────────────────
# USER
# ─────────────────────────────────────────
class User(AbstractUser):
    ROLE_CHOICES = (
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
    )
    staff_id = models.CharField(max_length=30, unique=True, blank=True, null=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='teacher')

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"


# ─────────────────────────────────────────
# ACADEMIC STRUCTURE (static — set up once)
# ─────────────────────────────────────────
class Programme(models.Model):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, blank=True, default='')
    duration_years = models.IntegerField(default=4)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class Course(models.Model):
    """
    Course template — reused across semesters.
    Not tied to any specific semester or section.
    """
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=20, blank=True, default='')
    programme = models.ForeignKey(
        Programme, on_delete=models.CASCADE, related_name='courses'
    )
    year = models.IntegerField(default=1)           # which year of study
    total_credit_hours = models.DecimalField(
        max_digits=5, decimal_places=1, validators=[MinValueValidator(1)]
    )
    minimum_attendance_percent = models.DecimalField(
        max_digits=5, decimal_places=1, default=Decimal('85.0')
    )
    is_active = models.BooleanField(default=True)

    @property
    def minimum_required_hours(self):
        return (self.total_credit_hours * self.minimum_attendance_percent / 100).quantize(Decimal('0.1'))

    def __str__(self):
        return f"{self.name} ({self.programme.name} Y{self.year})"


# ─────────────────────────────────────────
# ACADEMIC CALENDAR
# ─────────────────────────────────────────
class AcademicYear(models.Model):
    name = models.CharField(max_length=10, unique=True)  # e.g. "2025/2026"
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        ordering = ['-start_date']

    def save(self, *args, **kwargs):
        # Only one academic year can be current
        if self.is_current:
            AcademicYear.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Semester(models.Model):
    SEMESTER_CHOICES = (
        (1, 'Semester 1'),
        (2, 'Semester 2'),
    )
    academic_year = models.ForeignKey(
        AcademicYear, on_delete=models.CASCADE, related_name='semesters'
    )
    number = models.IntegerField(choices=SEMESTER_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)

    class Meta:
        unique_together = ('academic_year', 'number')
        ordering = ['-academic_year__start_date', '-number']

    def save(self, *args, **kwargs):
        # Only one semester can be current
        if self.is_current:
            Semester.objects.exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.academic_year.name} — Semester {self.number}"


# ─────────────────────────────────────────
# SECTIONS — per semester
# ─────────────────────────────────────────
class Section(models.Model):
    """
    A group of students in a programme, year, and semester.
    Created fresh each semester.
    e.g. Aircraft Maintenance, Year 2, Section A, Semester 1 2025/2026
    """
    name = models.CharField(max_length=10)   # A, B, C, D or any label
    programme = models.ForeignKey(
        Programme, on_delete=models.CASCADE, related_name='sections'
    )
    year = models.IntegerField()             # 1, 2, 3, 4, 5
    semester = models.ForeignKey(
        Semester, on_delete=models.CASCADE, related_name='sections'
    )

    class Meta:
        unique_together = ('name', 'programme', 'year', 'semester')

    def __str__(self):
        return (
            f"{self.programme.name} Y{self.year} "
            f"Sec {self.name} — {self.semester}"
        )


# ─────────────────────────────────────────
# STUDENTS — permanent records
# ─────────────────────────────────────────
class Student(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    student_id = models.CharField(max_length=20, unique=True)
    email = models.EmailField(unique=True)
    parent_email = models.EmailField(blank=True, default='')
    parent_telegram = models.CharField(max_length=100, blank=True, default='')
    programme = models.ForeignKey(
        Programme, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='students'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.full_name} ({self.student_id})"


class Enrollment(models.Model):
    """
    Links a student to a section for a specific semester.
    This is how students 'move up' each semester — a new enrollment is created.
    Old enrollments remain as a historical record.
    """
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('graduated', 'Graduated'),
        ('withdrawn', 'Withdrawn'),
        ('transferred', 'Transferred'),
        ('suspended', 'Suspended'),
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='enrollments'
    )
    section = models.ForeignKey(
        Section, on_delete=models.CASCADE, related_name='enrollments'
    )
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='active')
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('student', 'section')

    def __str__(self):
        return f"{self.student} → {self.section} ({self.status})"


# ─────────────────────────────────────────
# COURSE OFFERINGS — per semester
# ─────────────────────────────────────────
class CourseOffering(models.Model):
    """
    An offering of a course template in a specific semester and section.
    This is what teachers are assigned to teach.
    """
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name='offerings'
    )
    section = models.ForeignKey(
        Section, on_delete=models.CASCADE, related_name='course_offerings'
    )
    teacher = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='course_offerings'
    )

    class Meta:
        unique_together = ('course', 'section')

    @property
    def semester(self):
        return self.section.semester

    def __str__(self):
        return f"{self.course.name} — {self.section} — {self.teacher}"


# ─────────────────────────────────────────
# ATTENDANCE RECORDS
# ─────────────────────────────────────────
class AttendanceRecord(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('late', 'Late'),
        ('excused', 'Excused'),
        ('unexcused', 'Unexcused'),
    )
    SESSION_TYPE_CHOICES = (
        ('theory', 'Theory'),
        ('practical', 'Practical'),
    )
    student = models.ForeignKey(
        Student, on_delete=models.CASCADE, related_name='attendance_records'
    )
    course_offering = models.ForeignKey(
        CourseOffering, on_delete=models.CASCADE, related_name='attendance_records'
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    session_type = models.CharField(
        max_length=15, choices=SESSION_TYPE_CHOICES, default='theory'
    )
    hours_attended = models.DecimalField(
        max_digits=4, decimal_places=1, default=Decimal('1.0')
    )
    recorded_by = models.ForeignKey(
        User, on_delete=models.SET_NULL,
        null=True, related_name='recorded_attendance'
    )

    class Meta:
        unique_together = ('student', 'course_offering', 'date', 'session_type')

    def __str__(self):
        return f"{self.student} — {self.course_offering.course.name} — {self.date} — {self.status}"


# ─────────────────────────────────────────
# NOTIFICATIONS
# ─────────────────────────────────────────
class Notification(models.Model):
    TYPE_CHOICES = (
        ('absence', 'Absence Alert'),
        ('threshold', 'Threshold Warning'),
        ('info', 'Information'),
    )
    recipient = models.ForeignKey(
        User, on_delete=models.CASCADE,
        related_name='notifications', null=True, blank=True
    )
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient} — {self.notification_type}"


# ─────────────────────────────────────────
# SYSTEM SETTINGS
# ─────────────────────────────────────────
class SystemSettings(models.Model):
    email_alerts_enabled = models.BooleanField(default=True)
    telegram_alerts_enabled = models.BooleanField(default=False)
    threshold_warnings_enabled = models.BooleanField(default=True)
    weekly_reports_enabled = models.BooleanField(default=False)
    at_risk_threshold = models.DecimalField(
        max_digits=5, decimal_places=1, default=Decimal('85.0')
    )
    warning_threshold = models.DecimalField(
        max_digits=5, decimal_places=1, default=Decimal('90.0')
    )

    class Meta:
        verbose_name = "System Settings"

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "System Settings"