"""
0003 – Restore fields removed in 0002 that views/serializers still need.

Fields restored:
  - Enrollment.status
  - AttendanceRecord.session_type
  - AttendanceRecord.recorded_by
  - Notification.notification_type
  - SystemSettings.threshold_warnings_enabled
  - SystemSettings.weekly_reports_enabled
  - SystemSettings.at_risk_threshold
  - SystemSettings.warning_threshold

Related-names added (no DB column change, just Django ORM):
  - Section.semester  → related_name='sections'
  - Section.programme → related_name='sections'
  - Enrollment.student / .section → related_name='enrollments'
  - Student.programme → related_name='students'
"""

import django.db.models.deletion
from decimal import Decimal
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('attendance', '0002_alter_academicyear_options_and_more'),
    ]

    operations = [
        # ── Enrollment.status ────────────────────────────────────────────────
        migrations.AddField(
            model_name='enrollment',
            name='status',
            field=models.CharField(
                choices=[
                    ('active', 'Active'),
                    ('graduated', 'Graduated'),
                    ('withdrawn', 'Withdrawn'),
                    ('transferred', 'Transferred'),
                    ('suspended', 'Suspended'),
                ],
                default='active',
                max_length=15,
            ),
        ),

        # ── AttendanceRecord.session_type ────────────────────────────────────
        migrations.AddField(
            model_name='attendancerecord',
            name='session_type',
            field=models.CharField(
                choices=[('theory', 'Theory'), ('practical', 'Practical')],
                default='theory',
                max_length=15,
            ),
        ),

        # ── AttendanceRecord.recorded_by ─────────────────────────────────────
        migrations.AddField(
            model_name='attendancerecord',
            name='recorded_by',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='recorded_attendance',
                to=settings.AUTH_USER_MODEL,
            ),
        ),

        # ── Notification.notification_type ───────────────────────────────────
        migrations.AddField(
            model_name='notification',
            name='notification_type',
            field=models.CharField(
                choices=[
                    ('absence', 'Absence Alert'),
                    ('threshold', 'Threshold Warning'),
                    ('info', 'Information'),
                ],
                default='info',
                max_length=20,
            ),
        ),

        # ── SystemSettings extra fields ───────────────────────────────────────
        migrations.AddField(
            model_name='systemsettings',
            name='threshold_warnings_enabled',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='weekly_reports_enabled',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='at_risk_threshold',
            field=models.DecimalField(decimal_places=1, default=Decimal('85.0'), max_digits=5),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='warning_threshold',
            field=models.DecimalField(decimal_places=1, default=Decimal('90.0'), max_digits=5),
        ),

        # ── Fix unique_together for AttendanceRecord ─────────────────────────
        # Old constraint was (student, course_offering, date).
        # New constraint adds session_type so theory+practical can both be
        # recorded on the same day.
        migrations.AlterUniqueTogether(
            name='attendancerecord',
            unique_together={('student', 'course_offering', 'date', 'session_type')},
        ),

        # ── Unique together for Enrollment ───────────────────────────────────
        migrations.AlterUniqueTogether(
            name='enrollment',
            unique_together={('student', 'section')},
        ),

        # ── related_name fixes (AlterField – no DB column change) ─────────────
        migrations.AlterField(
            model_name='section',
            name='semester',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='sections',
                to='attendance.semester',
            ),
        ),
        migrations.AlterField(
            model_name='section',
            name='programme',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='sections',
                to='attendance.programme',
            ),
        ),
        migrations.AlterField(
            model_name='enrollment',
            name='student',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='enrollments',
                to='attendance.student',
            ),
        ),
        migrations.AlterField(
            model_name='enrollment',
            name='section',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='enrollments',
                to='attendance.section',
            ),
        ),
        migrations.AlterField(
            model_name='student',
            name='programme',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='students',
                to='attendance.programme',
            ),
        ),
    ]