from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator


class User(AbstractUser):
    ROLE_CHOICES = (
        ('teacher', 'Teacher'),
        ('admin', 'Admin'),
    )
    role = models.CharField(
        max_length=10,
        choices=ROLE_CHOICES,
        default='teacher'
    )

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
    department = models.ForeignKey(
        Department,
        on_delete=models.CASCADE,
        related_name='programmes'
    )

    def __str__(self):
        return self.name


class Course(models.Model):
    name = models.CharField(max_length=100)
    programme = models.ForeignKey(
        Programme,
        on_delete=models.CASCADE,
        related_name='courses'
    )
    total_credit_hours = models.DecimalField(
        max_digits=5,
        decimal_places=1,
        validators=[MinValueValidator(1)]
    )

    @property
    def minimum_required_hours(self):
        from decimal import Decimal
        return self.total_credit_hours * Decimal('0.15')

    def __str__(self):
        return self.name


class CourseAssignment(models.Model):
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
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    credit_hours = models.DecimalField(max_digits=5, decimal_places=1)

    class Meta:
        unique_together = ('course', 'teacher', 'role')

    def __str__(self):
        return f"{self.teacher} - {self.course} ({self.role})"


class Section(models.Model):
    name = models.CharField(max_length=20)
    course = models.ForeignKey(
        Course,
        on_delete=models.CASCADE,
        related_name='sections'
    )

    def __str__(self):
        return f"{self.course.name} - Section {self.name}"


class Student(models.Model):
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50)
    student_id = models.CharField(max_length=20, unique=True)
    email = models.EmailField(unique=True)
    parent_email = models.EmailField()
    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name='students'
    )

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    def __str__(self):
        return self.full_name


class AttendanceRecord(models.Model):
    STATUS_CHOICES = (
        ('present', 'Present'),
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
    session_hours = models.DecimalField(
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
        return f"{self.student} - {self.course} - {self.date} - {self.status}"


class Notification(models.Model):
    TYPE_CHOICES = (
        ('absence', 'Absence Alert'),
        ('threshold', 'Threshold Warning'),
        ('info', 'Information'),
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    notification_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.recipient} - {self.notification_type}"
