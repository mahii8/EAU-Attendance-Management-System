from decimal import Decimal

from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.utils import timezone


def get_current_semester():
    month = timezone.now().month
    # Sep-Jan = Semester 1, Feb-Aug = Semester 2
    return 1 if month >= 9 or month == 1 else 2


def get_current_academic_year():
    now = timezone.now()
    if now.month >= 9:
        return f"{now.year}/{str(now.year + 1)[2:]}"
    else:
        return f"{now.year - 1}/{str(now.year)[2:]}"


class User(AbstractUser):
    ROLE_CHOICES = (
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
        ('student', 'Student'),
        ('parent', 'Parent'),
    )
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default='teacher'
    )
    title = models.CharField(max_length=20, blank=True, default='')
    has_logged_in_before = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.get_full_name()} ({self.role})"


class Department(models.Model):
    name = models.CharField(max_length=100)
    head = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_departments'
    )

    def __str__(self):
        return self.name


class Programme(models.Model):
    name = models.CharField(max_length=100)
    duration_years = models.IntegerField(default=4)  # 4 or 5
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='programmes'
    )

    def __str__(self):
        return self.name


class Course(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True, default='')
    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        related_name='courses'
    )
    year = models.IntegerField(default=1)       # which year this course is taught
    semester = models.IntegerField(default=1)   # which semester
    total_credit_hours = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        validators=[MinValueValidator(1)]
    )

    @property
    def minimum_required_hours(self):
        from decimal import Decimal
        return Decimal(str(self.total_credit_hours)) * Decimal('0.15')

    def __str__(self):
        return f"{self.name} (Year {self.year} Sem {self.semester})"


class Section(models.Model):
    """
    A section is a group of students in a specific
    programme, year, semester and academic year.
    e.g. BSc Aeronautical Eng, Year 2, Semester 2, Section A, 2024/25
    """
    SECTION_CHOICES = (
        ('A', 'Section A'),
        ('B', 'Section B'),
        ('C', 'Section C'),
        ('D', 'Section D'),
    )
    name = models.CharField(max_length=5, choices=SECTION_CHOICES)
    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        related_name='sections'
    )
    year = models.IntegerField()        # 1, 2, 3, 4, 5
    semester = models.IntegerField()    # 1 or 2
    academic_year = models.CharField(
        max_length=10,
        default=get_current_academic_year
    )

    class Meta:
        unique_together = ('name', 'programme', 'year', 'semester', 'academic_year')

    def __str__(self):
        return (
            f"{self.programme.name} — "
            f"Year {self.year} Sem {self.semester} "
            f"Section {self.name} ({self.academic_year})"
        )


class CourseAssignment(models.Model):
    """
    A teacher is assigned to teach a specific course
    to a specific section.
    """
    ROLE_CHOICES = (
        ('professor', 'Professor'),
        ('pip', 'PIP / Lab Instructor'),
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='assignments'
    )
    teacher = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='course_assignments'
    )
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='course_assignments',
        null=True,
        blank=True
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    credit_hours = models.DecimalField(max_digits=5, decimal_places=1)

    class Meta:
        unique_together = ('course', 'teacher', 'section', 'role')

    def __str__(self):
        return f"{self.teacher} — {self.course} — {self.section} ({self.role})"


class Student(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    student_id = models.CharField(max_length=20, unique=True)
    email = models.EmailField(unique=True)
    parent_email = models.EmailField(blank=True, default='')
    parent_telegram = models.CharField(max_length=100, blank=True, default='')
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='students'
    )
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='student_profile'
    )
    parent_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='children'
    )

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return f"{self.full_name} ({self.student_id})"


class AttendanceRecord(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
        ('late', 'Late'),
        ('exempted', 'Exempted'),
        ('absent', 'Absent'),
    )
    SESSION_TYPE_CHOICES = (
        ('theory', 'Theory'),
        ('practical', 'Practical'),
    )
    student = models.ForeignKey(
        Student,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='attendance_records'
    )
    date = models.DateField()
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    session_type = models.CharField(
        max_length=15,
        choices=SESSION_TYPE_CHOICES,
        default='theory'
    )
    hours_attended = models.DecimalField(
        max_digits=4,
        decimal_places=1,
        default=1.0
    )
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_attendance'
    )

    class Meta:
        unique_together = ('student', 'course', 'date', 'session_type')

    def __str__(self):
        return f"{self.student} — {self.course} — {self.date} — {self.status}"


class Notification(models.Model):
    TYPE_CHOICES = (
        ('absence', 'Absence Alert'),
        ('threshold', 'Threshold Warning'),
        ('info', 'Information'),
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications',
        null=True,
        blank=True
    )
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient} — {self.notification_type}"


class SystemSettings(models.Model):
    email_alerts_enabled = models.BooleanField(default=True)
    telegram_alerts_enabled = models.BooleanField(default=False)
    threshold_warnings_enabled = models.BooleanField(default=True)
    weekly_reports_enabled = models.BooleanField(default=False)
    current_semester = models.IntegerField(default=get_current_semester)
    current_academic_year = models.CharField(
        max_length=10,
        default=get_current_academic_year
    )

    class Meta:
        verbose_name = "System Settings"

    def save(self, *args, **kwargs):
        self.pk = 1  # singleton
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return "System Settings"